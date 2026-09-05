"use client";

import { useState, useTransition } from "react";
import { respondToTradeGroupAction, commishRespondTradeGroupAction } from "@/app/trades/build3/actions";

export default function TradeGroupActions({ groupId, canRespond, isCommishReview }: {
  groupId: number; canRespond: boolean; isCommishReview?: boolean;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>) => start(async () => {
    setErr(null);
    try { await fn(); } catch (e) { setErr((e as Error).message); }
  });
  if (!canRespond) return err ? <span className="text-red-400 text-xs">{err}</span> : null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => run(() => isCommishReview ? commishRespondTradeGroupAction(groupId, "accept") : respondToTradeGroupAction(groupId, true))}
        disabled={pending}
        className="px-4 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold disabled:opacity-40">
        {pending ? "…" : isCommishReview ? "★ Approve (Comish)" : "Accept"}
      </button>
      <button
        onClick={() => run(() => isCommishReview ? commishRespondTradeGroupAction(groupId, "decline") : respondToTradeGroupAction(groupId, false))}
        disabled={pending}
        className="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold disabled:opacity-40">
        Decline
      </button>
      {err && <span className="text-red-400 text-xs">{err}</span>}
    </div>
  );
}
