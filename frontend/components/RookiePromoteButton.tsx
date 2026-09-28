"use client";

import { useState, useTransition } from "react";
import { promoteRookieAction } from "@/app/tools/player-calculator/actions";

export default function RookiePromoteButton({ playerId }: { playerId: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; s: string } | null>(null);
  const apply = () => start(async () => {
    const r = await promoteRookieAction(playerId);
    setMsg(r.ok ? { ok: true, s: "Activated ✓" } : { ok: false, s: r.error ?? "Failed" });
  });
  if (msg?.ok) return <span className="text-xs text-green-400 font-semibold">Activated ✓</span>;
  return (
    <span className="flex items-center gap-2">
      {msg && !msg.ok && <span className="text-xs text-red-400">{msg.s}</span>}
      <button onClick={apply} disabled={pending}
        className="px-3 py-1 rounded-md bg-blue-600/80 hover:bg-blue-500 text-white text-xs font-semibold whitespace-nowrap disabled:opacity-50">
        {pending ? "…" : "Activate rating"}
      </button>
    </span>
  );
}
