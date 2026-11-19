// The business's look: initials mark and brand color. Shared by screens and PDFs.

/** "The Green Bowl" -> "GB": up to two initials, skipping little words. */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => w && !/^(the|a|an|of|and|&)$/i.test(w));
  return (words.length ? words : name.split(/\s+/))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * CSS that sets the brand color for the whole app. Light mode uses the color
 * as is; dark mode mixes it with white so it stays readable on a dark page.
 * Only a validated #rrggbb value is ever written into the style.
 */
export function brandCss(color: string | null | undefined): string {
  if (!color || !HEX.test(color)) return "";
  return `:root{--brand:${color}}@media (prefers-color-scheme: dark){:root{--brand:color-mix(in srgb, ${color} 45%, white)}}`;
}
