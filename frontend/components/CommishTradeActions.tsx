"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { commishRespondTrade } from "@/app/trades/build/actions";

export default function CommishTradeActions({ tradeId, status }: { tradeId: number; status: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  // Modify is offered on the first review only; once the GM has modified, it's Accept/Decline.
  const canModify = status === "AWAITING_COMMISH";
  const waitingOnGm = status === "MODIFY";

  const act = (action: "accept" | "decline" | "modify") => {
    let note: string | undefined;
    if (action === "modify") {
      const n = window.prompt("What should the GM change to balance this deal? (optional note)");
      if (n === null) return; // cancelled
      note = n.trim() || undefined;
    } else if (action === "decline") {
      const n = window.prompt("Reason to decline? (optional)");
      if (n === null) return;
      note = n.trim() || undefined;
    } else if (!window.confirm("Approve and execute this trade now?")) return;
    start(async () => {
      setErr(null);
      try { await commishRespondTrade(tradeId, action, note); router.refresh(); }
      catch (e) { setErr((e as Error).message); }
    });
  };

  if (waitingOnGm) return <p className="text-xs text-sky-300">Sent back to the GM to modify — waiting on their resubmission.</p>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={() => act("accept")} disabled={pending}
        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50">Accept</button>
      <button onClick={() => act("decline")} disabled={pending}
        className="px-4 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-sm font-semibold disabled:opacity-50">Decline</button>
      {canModify && (
        <button onClick={() => act("modify")} disabled={pending}
          className="px-4 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-sm font-semibold disabled:opacity-50">Modify</button>
      )}
      {pending && <span className="text-xs text-slate-400">…</span>}
      {err && <span className="text-xs text-rose-400">{err}</span>}
    </div>
  );
}
