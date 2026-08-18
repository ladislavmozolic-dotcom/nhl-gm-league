"use client";

import { useState, useTransition } from "react";
import { revertSigningAction } from "@/app/admin/signings/actions";

export default function RevertSigningButton({ logId, name }: { logId: number; name: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        disabled={pending}
        onClick={() => {
          if (!confirm(`Revert the signing of ${name} to his previous contract?`)) return;
          start(async () => { const r = await revertSigningAction(logId); if (!r.ok) setErr(r.error ?? "Failed"); });
        }}
        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap"
      >
        {pending ? "Reverting…" : "Revert"}
      </button>
      {err && <span className="text-[10px] text-rose-400">{err}</span>}
    </span>
  );
}
