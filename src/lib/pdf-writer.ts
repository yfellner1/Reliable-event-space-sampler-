// A small text layout helper for PDFs (US Letter, standard fonts).

import { rgb, type PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";
import { initials } from "./brand";

export const PAGE = { w: 612, h: 792 }; // US Letter
export const M = 54; // margin
export const GREEN = rgb(0.17, 0.37, 0.25);
export const INK = rgb(0.11, 0.16, 0.13);
export const MUTED = rgb(0.36, 0.42, 0.38);
export const LINE = rgb(0.8, 0.84, 0.8);

/** A "#1F4D2E" brand color as a PDF color (falls back to green). */
export function hexColor(hex: string | null | undefined) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? "");
  if (!m) return GREEN;
  return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255);
}

/** A rounded square with the business's initials, in place of a logo image. */
export function drawMark(page: PDFPage, bold: PDFFont, name: string, color: ReturnType<typeof rgb>, x: number, y: number, size: number) {
  page.drawRectangle({ x, y, width: size, height: size, color });
  const text = clean(initials(name));
  const fs = size * 0.42;
  page.drawText(text, {
    x: x + (size - bold.widthOfTextAtSize(text, fs)) / 2,
    y: y + (size - fs * 0.72) / 2,
    size: fs,
    font: bold,
    color: rgb(1, 1, 1),
  });
}

/** The standard PDF fonts only cover Latin-1; replace anything else. */
export function clean(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/•/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
}

export class Writer {
  page!: PDFPage;
  y = 0;
  pages: PDFPage[] = [];

  constructor(
    private doc: PDFDocument,
    private font: PDFFont,
    private bold: PDFFont,
    private footer: string,
    private accent = GREEN,
  ) {
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE.w, PAGE.h]);
    this.pages.push(this.page);
    this.y = PAGE.h - M;
  }

  ensure(height: number) {
    if (this.y - height < M + 24) this.newPage();
  }

  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const out: string[] = [];
    for (const para of clean(text).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        if (!word) continue;
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > width && line) {
          out.push(line);
          line = word;
        } else {
          line = next;
        }
      }
      out.push(line);
    }
    return out;
  }

  text(t: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.font;
    const x = M + (opts.indent ?? 0);
    const lead = size * 1.35;
    for (const line of this.wrap(t, font, size, PAGE.w - M - x)) {
      this.ensure(lead);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: opts.color ?? INK });
      this.y -= lead;
    }
    this.y -= opts.gap ?? 0;
  }

  heading(t: string) {
    this.ensure(40);
    this.y -= 10;
    this.page.drawRectangle({ x: M, y: this.y - 14, width: 3, height: 15, color: this.accent });
    this.page.drawText(clean(t.toUpperCase()), { x: M + 10, y: this.y - 12, size: 11, font: this.bold, color: this.accent });
    this.y -= 24;
  }

  /** Label and value pairs, two per row. */
  fields(pairs: [string, string][]) {
    const colW = (PAGE.w - 2 * M) / 2;
    for (let i = 0; i < pairs.length; i += 2) {
      this.ensure(30);
      const row = pairs.slice(i, i + 2);
      let lowest = this.y;
      row.forEach(([label, value], j) => {
        const x = M + j * colW;
        this.page.drawText(clean(label), { x, y: this.y - 8, size: 8, font: this.font, color: MUTED });
        let y = this.y - 21;
        for (const line of this.wrap(value || " ", this.bold, 10.5, colW - 12)) {
          this.page.drawText(line, { x, y, size: 10.5, font: this.bold, color: INK });
          y -= 14;
        }
        this.page.drawLine({ start: { x, y: y + 9 }, end: { x: x + colW - 12, y: y + 9 }, thickness: 0.5, color: LINE });
        lowest = Math.min(lowest, y);
      });
      this.y = lowest - 6;
    }
  }

  /** Two-column money table. */
  table(rows: { label: string; value: string; bold?: boolean; rule?: boolean }[]) {
    const right = PAGE.w - M;
    for (const r of rows) {
      this.ensure(18);
      if (r.rule) {
        this.page.drawLine({ start: { x: M, y: this.y + 2 }, end: { x: right, y: this.y + 2 }, thickness: 0.6, color: LINE });
        this.y -= 4;
      }
      const font = r.bold ? this.bold : this.font;
      const value = clean(r.value);
      const lines = this.wrap(r.label, font, 10, right - M - 90);
      lines.forEach((line, i) => {
        this.page.drawText(line, { x: M, y: this.y - 10, size: 10, font, color: INK });
        if (i === 0) {
          this.page.drawText(value, { x: right - font.widthOfTextAtSize(value, 10), y: this.y - 10, size: 10, font, color: INK });
        }
        this.y -= 14;
      });
    }
  }

  signature(label: string) {
    this.ensure(56);
    this.y -= 30;
    const w = (PAGE.w - 2 * M - 24) / 2;
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: M + w, y: this.y }, thickness: 0.8, color: INK });
    this.page.drawLine({ start: { x: M + w + 24, y: this.y }, end: { x: PAGE.w - M, y: this.y }, thickness: 0.8, color: INK });
    this.page.drawText(clean(label), { x: M, y: this.y - 12, size: 8.5, font: this.font, color: MUTED });
    this.page.drawText("Date", { x: M + w + 24, y: this.y - 12, size: 8.5, font: this.font, color: MUTED });
    this.y -= 22;
  }

  /** A table with several columns; widths are fractions of the page width. */
  columns(
    header: string[],
    rows: string[][],
    widths: number[],
    align: ("left" | "right")[] = [],
    opts: { size?: number; boldLast?: boolean } = {},
  ) {
    const size = opts.size ?? 8.5;
    const full = PAGE.w - 2 * M;
    const xs: number[] = [];
    let x = M;
    for (const w of widths) {
      xs.push(x);
      x += w * full;
    }
    const draw = (cells: string[], font: PDFFont, color = INK) => {
      this.ensure(size * 1.6);
      cells.forEach((cell, i) => {
        const w = widths[i] * full - 6;
        let t = clean(cell);
        if (font.widthOfTextAtSize(t, size) > w) {
          while (t.length > 1 && font.widthOfTextAtSize(`${t}..`, size) > w) t = t.slice(0, -1);
          t = `${t.trimEnd()}..`;
        }
        const tx = align[i] === "right" ? xs[i] + widths[i] * full - 6 - font.widthOfTextAtSize(t, size) : xs[i];
        this.page.drawText(t, { x: tx, y: this.y - size, size, font, color });
      });
      this.y -= size * 1.55;
    };
    draw(header, this.bold, MUTED);
    this.page.drawLine({ start: { x: M, y: this.y + 3 }, end: { x: PAGE.w - M, y: this.y + 3 }, thickness: 0.5, color: LINE });
    rows.forEach((r, i) => draw(r, opts.boldLast && i === rows.length - 1 ? this.bold : this.font));
    this.y -= 4;
  }

  finish() {
    this.pages.forEach((p, i) => {
      const t = clean(`${this.footer} - Page ${i + 1} of ${this.pages.length}`);
      p.drawText(t, { x: M, y: M - 20, size: 8, font: this.font, color: MUTED });
    });
  }
}

