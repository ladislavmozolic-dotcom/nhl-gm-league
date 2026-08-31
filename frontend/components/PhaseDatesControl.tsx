"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPhaseDatesAction } from "@/app/admin/season/actions";
import { friendlyActionError } from "@/lib/client/action-error";

const toIso = (d: string | null) => (d ? d.slice(0, 10) : "");

/** Admin control for the real calendar dates "Auto (calendar)" mode uses to move
 *  between preseason/regular season — playoffs isn't set here, it always follows
 *  directly from the regular season's last scheduled game. Leave a field blank to
 *  fall back to the generated schedule's own first game (or the old fixed default
 *  if there's no schedule yet). */
export default function PhaseDatesControl({ preseasonAt, regularAt }: { preseasonAt: string | null; regularAt: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pre, setPre] = useState(toIso(preseasonAt));
  const [reg, setReg] = useState(toIso(regularAt));
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = () => start(async () => {
    setErr(null); setSaved(false);
    try {
      const r = await setPhaseDatesAction(pre || null, reg || null);
      if (!r.ok) setErr(r.error);
      else { setSaved(true); router.refresh(); }
    } catch (e) { setErr(friendlyActionError(e)); }
  });

  const input = "bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-slate-200";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Preseason begins
          <input type="date" className={input} value={pre} onChange={(e) => setPre(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Regular season begins
          <input type="date" className={input} value={reg} onChange={(e) => setReg(e.target.value)} />
        </label>
        <button onClick={save} disabled={pending}
          className="px-3.5 py-1.5 rounded-lg font-semibold text-white text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50">
          {pending ? "…" : "Save dates"}
        </button>
      </div>
      <div className="text-xs text-slate-500">
        Only matters in Auto (calendar) mode. Leave blank to fall back to the generated schedule&apos;s own first game. Playoffs always follows the regular season&apos;s last scheduled game — not set here.
      </div>
      {err && <div className="text-xs text-red-400">{err}</div>}
      {saved && <div className="text-xs text-emerald-400">Saved.</div>}
    </div>
  );
}
