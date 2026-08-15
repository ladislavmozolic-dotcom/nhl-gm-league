"use client";

import { useState, useTransition } from "react";
import { applyAllElcAction } from "@/app/free-agents/actions";

export default function ElcApplyAllButton({ count }: { count: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const apply = () => start(async () => {
    const r = await applyAllElcAction();
    setMsg(r.ok ? `✓ ${r.signed} entry-level contracts assigned.` : r.error);
  });
  return (
    <div className="flex items-center gap-3">
      <button onClick={apply} disabled={pending}
        className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-sm font-semibold">
        {pending ? "Signing…" : `Auto-assign all ${count} ELCs`}
      </button>
      {msg && <span className="text-sm text-green-300">{msg}</span>}
    </div>
  );
}
