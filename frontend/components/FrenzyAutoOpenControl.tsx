"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFrenzyAutoOpenAction } from "@/app/free-agents/actions";

/** Commissioner-only control: schedule a one-shot real moment for the Free Agent
 *  Frenzy window to auto-open for every GM — the home page's countdown card
 *  switches to counting down to this the moment it's set. Fires once, then clears
 *  itself, so a later manual close of the market sticks. */
export default function FrenzyAutoOpenControl({ at, comish, faOpen }: { at: string | null; comish: boolean; faOpen: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // datetime-local wants "YYYY-MM-DDTHH:mm" in LOCAL time — convert from the stored UTC ISO.
  const toLocalInput = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [val, setVal] = useState(toLocalInput(at));
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!comish) return null;

  const save = () => start(async () => {
    setErr(null); setSaved(false);
    // the <input> value is local wall-clock with no offset — new Date(...) on the
    // client parses it as local time, then .toISOString() carries the real UTC instant.
    const iso = val ? new Date(val).toISOString() : null;
    const r = await setFrenzyAutoOpenAction(iso);
    if (!r.ok) setErr(r.error);
    else { setSaved(true); router.refresh(); }
  });

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-800/30 px-4 py-2.5 text-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Auto-open Frenzy at (for every GM)
          <input type="datetime-local" value={val} onChange={(e) => setVal(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-slate-200" />
        </label>
        <button onClick={save} disabled={pending}
          className="px-3.5 py-1.5 rounded-lg font-semibold text-white text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50">
          {pending ? "…" : "Save"}
        </button>
        {val && (
          <button onClick={() => { setVal(""); start(async () => { await setFrenzyAutoOpenAction(null); router.refresh(); }); }} disabled={pending}
            className="px-3 py-1.5 rounded-lg font-medium text-slate-300 text-sm border border-slate-700 hover:border-slate-500">
            Clear
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">
        {faOpen ? "The market is already open — this has no effect until you close it." : "Checked every ~5 minutes; fires once, then clears itself. Comish/Co-Comish already have access via the toggle above."}
      </p>
      {err && <div className="text-xs text-red-400">{err}</div>}
      {saved && <div className="text-xs text-emerald-400">Saved.</div>}
    </div>
  );
}
