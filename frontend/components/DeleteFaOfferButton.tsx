"use client";

import { useState, useTransition } from "react";
import { deleteFaOfferAction } from "@/app/admin/agent/actions";

export default function DeleteFaOfferButton({ offerId, name }: { offerId: number; name: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        disabled={pending}
        onClick={() => {
          if (!confirm(`Delete this offer on ${name}?`)) return;
          start(async () => { const r = await deleteFaOfferAction(offerId); if (!r.ok) setErr(r.error ?? "Failed"); });
        }}
        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {err && <span className="text-[10px] text-rose-400">{err}</span>}
    </span>
  );
}
