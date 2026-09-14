"use client";

import { useState, useTransition } from "react";
import { restoreDeclinedTradeAction } from "@/app/trades/build/actions";

export default function RestoreTradeButton({ tradeId }: { tradeId: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const go = () => start(async () => {
    const r = await restoreDeclinedTradeAction(tradeId);
    setMsg(r.ok ? "↩ Restored to pending." : r.error);
  });
  if (msg) return <span className="text-xs text-slate-400">{msg}</span>;
  return (
    <button onClick={go} disabled={pending} className="px-3 py-1.5 rounded-lg bg-sky-900/40 border border-sky-800/50 hover:bg-sky-900/60 text-sky-300 text-xs font-semibold disabled:opacity-50" title="Put this declined trade back to pending — no assets moved yet">
      {pending ? "…" : "↩ Restore"}
    </button>
  );
}
