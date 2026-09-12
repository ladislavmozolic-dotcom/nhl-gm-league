"use client";

import { useState, useTransition } from "react";
import { updateRetentionPct } from "@/app/admin/salary-retention/actions";

export default function RetentionPctEditor({ buyoutId, currentPct, maxPct }: { buyoutId: number; currentPct: number; maxPct: number }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(currentPct));
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const pct = Number(value);
    setError(null);
    start(async () => {
      const r = await updateRetentionPct(buyoutId, pct);
      if (r.ok) setEditing(false);
      else setError(r.error);
    });
  };

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 text-xs font-semibold" title="Change the retained percentage">
        Modify
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <input
        type="number" min={0} max={maxPct} step={0.5} value={value} autoFocus
        onChange={(e) => setValue(e.target.value)}
        className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-white text-xs"
      />
      <button onClick={save} disabled={pending} className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50">{pending ? "…" : "Save"}</button>
      <button onClick={() => { setEditing(false); setError(null); setValue(String(currentPct)); }} className="px-2 py-1 rounded-lg bg-slate-700 text-xs">Cancel</button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  );
}
