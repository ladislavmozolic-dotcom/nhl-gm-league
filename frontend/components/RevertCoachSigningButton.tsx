"use client";

import { useState, useTransition } from "react";
import { revertCoachSigningAction } from "@/app/admin/coach-signings/actions";

export default function RevertCoachSigningButton({ logId, name, kind }: { logId: number; name: string; kind: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        disabled={pending}
        onClick={() => {
          if (!confirm(`Revert the ${kind === "FIRE" ? "firing" : "hiring"} of ${name}?`)) return;
          start(async () => { const r = await revertCoachSigningAction(logId); if (!r.ok) setErr(r.error ?? "Failed"); });
        }}
        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap"
      >
        {pending ? "Reverting…" : "Revert"}
      </button>
      {err && <span className="text-[10px] text-rose-400">{err}</span>}
    </span>
  );
}
