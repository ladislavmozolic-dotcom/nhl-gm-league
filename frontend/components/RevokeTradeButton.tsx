"use client";

import { useState, useTransition } from "react";
import { revokeTradeAction } from "@/app/trades/build/actions";

export default function RevokeTradeButton({ tradeId }: { tradeId: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const go = () => start(async () => {
    setConfirm(false);
    const r = await revokeTradeAction(tradeId);
    setMsg(r.ok ? `↩ Reverted — ${r.moved} asset(s) returned.` : r.error);
  });
  if (msg) return <span className="text-xs text-slate-400">{msg}</span>;
  return confirm ? (
    <span className="flex items-center gap-1.5">
      <button onClick={go} disabled={pending} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold disabled:opacity-50">{pending ? "…" : "Confirm revoke"}</button>
      <button onClick={() => setConfirm(false)} className="px-2 py-1.5 rounded-lg bg-slate-700 text-xs">Cancel</button>
    </span>
  ) : (
    <button onClick={() => setConfirm(true)} className="px-3 py-1.5 rounded-lg bg-red-900/40 border border-red-800/50 hover:bg-red-900/60 text-red-300 text-xs font-semibold" title="Reverse this completed trade — return all assets">↩ Revoke</button>
  );
}
