"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelQualifyingOfferAction } from "@/app/admin/agent/actions";
import { friendlyActionError } from "@/lib/client/action-error";

export default function CancelQoButton({ caseId, name, deadlinePassed }: { caseId: number; name: string; deadlinePassed: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const run = () => {
    const warn = deadlinePassed ? "\n\nWarning: the QO deadline has already passed — after cancelling, the club cannot file the QO again and the rights to the player may lapse." : "";
    if (!confirm(`Cancel the submitted QO for ${name}? The case returns to the "QO due" state.${warn}`)) return;
    setErr(null);
    start(async () => {
      try {
        const r = await cancelQualifyingOfferAction(caseId);
        if (!r.ok) setErr(r.error ?? "Failed");
        else router.refresh();
      } catch (e) {
        const msg = friendlyActionError(e);
        if (/out of date/i.test(msg)) window.location.reload(); else setErr(msg);
      }
    });
  };

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button disabled={pending} onClick={run}
        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap shadow-sm transition">
        {pending ? "Cancelling…" : "Cancel QO"}
      </button>
      {err && <span className="text-[10px] text-rose-400 font-medium">{err}</span>}
    </span>
  );
}
