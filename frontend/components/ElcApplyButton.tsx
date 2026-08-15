"use client";

import { useState, useTransition } from "react";
import { applyElcAction } from "@/app/free-agents/actions";

export default function ElcApplyButton({ playerId }: { playerId: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; s: string } | null>(null);
  const apply = () => start(async () => {
    const r = await applyElcAction(playerId);
    setMsg(r.ok ? { ok: true, s: "Signed ✓" } : { ok: false, s: r.error });
  });
  if (msg?.ok) return <span className="text-xs text-green-400 font-semibold">Signed ✓</span>;
  return (
    <span className="flex items-center gap-2">
      {msg && !msg.ok && <span className="text-xs text-red-400">{msg.s}</span>}
      <button onClick={apply} disabled={pending}
        className="px-3 py-1 rounded-md bg-green-600/80 hover:bg-green-500 text-white text-xs font-semibold whitespace-nowrap disabled:opacity-50">
        {pending ? "…" : "Apply ELC"}
      </button>
    </span>
  );
}
