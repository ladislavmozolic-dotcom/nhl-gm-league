"use client";

import { useState, useTransition } from "react";
import { runAiGmAction } from "@/app/admin/season/actions";

export default function RunAiGmButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        disabled={pending}
        onClick={() => start(async () => {
          const r = await runAiGmAction();
          setMsg(`AI GM ran for ${r.managed} club${r.managed === 1 ? "" : "s"}${r.details.some((d) => d.includes("cap")) ? " · shed salary on some over-cap clubs" : ""}.`);
        })}
        className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 font-semibold text-sm whitespace-nowrap"
      >
        {pending ? "Running…" : "Run AI GM now"}
      </button>
      {msg && <span className="text-xs text-cyan-400 max-w-xs text-right">{msg}</span>}
    </div>
  );
}
