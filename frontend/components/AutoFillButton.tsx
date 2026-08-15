"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { autoFillRostersAction } from "@/app/admin/season/actions";

export default function AutoFillButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const run = () => start(async () => {
    setMsg(null);
    try {
      const r = await autoFillRostersAction();
      setMsg(r.promoted ? `Promoted ${r.promoted} player${r.promoted === 1 ? "" : "s"} across ${r.teams} club${r.teams === 1 ? "" : "s"}.` : "Every club already owns a legal roster.");
      router.refresh();
    } catch (e) { setMsg((e as Error).message); }
  });

  return (
    <span className="inline-flex items-center gap-2">
      <button onClick={run} disabled={pending}
        className="px-3 py-1 rounded-md bg-amber-600/90 hover:bg-amber-500 disabled:opacity-50 text-xs font-bold text-white">
        {pending ? "Filling…" : "Auto-fill from farm"}
      </button>
      {msg && <span className="text-xs text-slate-300">{msg}</span>}
    </span>
  );
}
