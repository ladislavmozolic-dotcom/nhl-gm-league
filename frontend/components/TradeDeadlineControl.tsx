"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTradeDeadlineAction } from "@/app/admin/season/actions";
import { friendlyActionError } from "@/lib/client/action-error";

/** Admin control for the NHL trade deadline (Europe/Bratislava wall-clock). */
export default function TradeDeadlineControl({ local }: { local: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [val, setVal] = useState(local ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = (v: string | null) => start(async () => {
    setErr(null); setSaved(false);
    try {
      const r = await setTradeDeadlineAction(v);
      if (!r.ok) setErr(r.error);
      else { setSaved(true); if (v === null) setVal(""); router.refresh(); }
    } catch (e) { setErr(friendlyActionError(e)); }
  });

  const input = "bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-slate-200";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Trade deadline (Bratislava time)
          <input type="datetime-local" className={input} value={val} onChange={(e) => setVal(e.target.value)} />
        </label>
        <button onClick={() => save(val || null)} disabled={pending}
          className="px-3.5 py-1.5 rounded-lg font-semibold text-white text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50">
          {pending ? "…" : "Save deadline"}
        </button>
        {local && (
          <button onClick={() => save(null)} disabled={pending}
            className="px-3.5 py-1.5 rounded-lg font-semibold text-sm border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50">
            Remove
          </button>
        )}
      </div>
      <div className="text-xs text-slate-500">
        NHL rule: after the deadline no club can trade until its season is over — non-playoff clubs once the regular season ends, playoff clubs once eliminated. Blank = no deadline.
        The countdown appears site-wide 14 days out; on deadline day every page gets a live 🚨 breaking-trades ticker.
      </div>
      {err && <div className="text-xs text-red-400">{err}</div>}
      {saved && <div className="text-xs text-emerald-400">Saved.</div>}
    </div>
  );
}
