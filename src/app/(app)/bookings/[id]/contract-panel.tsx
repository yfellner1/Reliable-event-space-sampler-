"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { attachSignedContract, markContractSent, signedContractFolder } from "../contract-actions";

type Props = {
  bookingId: string;
  sentLabel: string | null;
  signedLabel: string | null;
  hasSignedCopy: boolean;
  cancelled: boolean;
};

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/webp"];

export function ContractPanel({ bookingId, sentLabel, signedLabel, hasSignedCopy, cancelled }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<{ ok?: string; error?: string }>({});
  const [busy, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function markSent() {
    start(async () => {
      const r = await markContractSent(bookingId);
      setStatus(r.ok ? { ok: "Marked as sent today." } : { error: "Couldn't save. Please try again." });
      router.refresh();
    });
  }

  function upload(file: File) {
    if (!TYPES.includes(file.type)) {
      setStatus({ error: "Upload a PDF or a photo (JPG, PNG, HEIC)." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus({ error: "The file is over 10 MB. Try a smaller photo or a PDF." });
      return;
    }
    start(async () => {
      setStatus({ ok: "Uploading…" });
      const folder = await signedContractFolder(bookingId);
      if (!folder) return setStatus({ error: "Unknown booking." });
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
      const path = `${folder}/signed-${Date.now()}.${ext}`;
      const { error } = await createClient()
        .storage.from("contracts")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) return setStatus({ error: "The upload failed. Check the connection and try again." });
      const r = await attachSignedContract(bookingId, path);
      setStatus(r.ok ? { ok: "Signed copy saved. The contract is marked signed." } : { error: r.error });
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3">
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">Sent</dt>
        <dd className="m-0">{sentLabel ?? "Not yet"}</dd>
        <dt className="text-muted">Signed</dt>
        <dd className="m-0">{signedLabel ?? "Not yet"}</dd>
        <dt className="text-muted">Signed copy</dt>
        <dd className="m-0">
          {hasSignedCopy ? (
            <a href={`/bookings/${bookingId}/signed-contract`} target="_blank" rel="noopener" className="font-semibold text-brand">
              View signed copy
            </a>
          ) : (
            "None on file"
          )}
        </dd>
      </dl>

      <div className="flex flex-wrap gap-2">
        <a className="btn btn-primary" href={`/bookings/${bookingId}/contract`} target="_blank" rel="noopener">
          Download contract (PDF)
        </a>
        {!sentLabel && !cancelled ? (
          <button type="button" className="btn" onClick={markSent} disabled={busy}>
            Mark as sent today
          </button>
        ) : null}
      </div>

      {!cancelled ? (
        <label className="field">
          {hasSignedCopy ? "Replace the signed copy" : "Upload the signed contract (PDF or photo)"}
          <input
            ref={fileRef}
            className="input"
            type="file"
            accept="application/pdf,image/*"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
        </label>
      ) : null}

      {status.error ? (
        <div className="box box-err" role="alert">
          {status.error}
        </div>
      ) : status.ok ? (
        <p className="m-0 text-sm font-semibold" role="status">
          {status.ok}
        </p>
      ) : null}
      <p className="m-0 text-xs text-muted">
        The PDF is built from the saved booking, with the terms from Settings. Save changes first. Signed copies are
        private: only the secretary and admins can open them.
      </p>
    </div>
  );
}
