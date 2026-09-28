"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { money } from "@/lib/finance";
import { saveFaWeightsAction, resetFaWeightsAction, previewFaWeightsAction, type PreviewRow } from "@/app/admin/fa-tuning/actions";
import type { FWeights, DWeights, GWeights } from "@/lib/free-agency";

type Weights = { f: FWeights; d: DWeights; g: GWeights };

const F_FIELDS: Array<{ key: keyof FWeights; label: string }> = [
  { key: "sc", label: "Scoring (SC)" }, { key: "pa", label: "Playmaking (PA)" },
  { key: "df", label: "Defense (DF)" }, { key: "sk", label: "Skating (SK)" },
];
const D_FIELDS: Array<{ key: keyof DWeights; label: string }> = [
  { key: "df", label: "Defense (DF)" }, { key: "pa", label: "Playmaking (PA)" },
  { key: "sc", label: "Scoring (SC)" }, { key: "sk", label: "Skating (SK)" },
];
const G_FIELDS: Array<{ key: keyof GWeights; label: string }> = [
  { key: "ag", label: "Agility (AG)" }, { key: "sc", label: "Positioning (SC)" },
  { key: "rb", label: "Rebound (RB)" }, { key: "hs", label: "Hand Speed (HS)" },
];

export default function FaWeightsForm({ initial }: { initial: Weights }) {
  const [w, setW] = useState<Weights>(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setField = <G extends "f" | "d" | "g">(grp: G, key: keyof Weights[G], v: number) => {
    setW((prev) => ({ ...prev, [grp]: { ...prev[grp], [key]: v } }));
    setSaved(false);
    setPreview(null);
  };

  const sum = (grp: "f" | "d" | "g") => Object.values(w[grp]).reduce((a, b) => a + b, 0);

  const doPreview = () => start(async () => {
    setError(null);
    try { setPreview(await previewFaWeightsAction(w)); }
    catch { setError("Preview failed — try again."); }
  });
  const doSave = () => start(async () => {
    setError(null);
    const r = await saveFaWeightsAction(w);
    if (!r.ok) setError(r.error); else setSaved(true);
  });
  const doReset = () => start(async () => {
    const d = await resetFaWeightsAction();
    setW(d); setSaved(true); setPreview(null);
  });

  const Group = ({ grp, title, fields }: { grp: "f" | "d" | "g"; title: string; fields: Array<{ key: string; label: string }> }) => {
    const s = sum(grp);
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">{title}</h3>
          <span className={`text-xs font-semibold ${Math.abs(s - 1) < 0.01 ? "text-emerald-400" : "text-amber-400"}`}>sum {s.toFixed(2)}</span>
        </div>
        <div className="space-y-1.5">
          {fields.map((f) => (
            <label key={f.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-400">{f.label}</span>
              <input
                type="number" step={0.01} min={0} max={1}
                value={(w[grp] as Record<string, number>)[f.key]}
                onChange={(e) => setField(grp, f.key as never, Number(e.target.value))}
                className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right tabular-nums text-sm"
              />
            </label>
          ))}
        </div>
      </div>
    );
  };

  const Delta = ({ oldV, newV, dollars = false }: { oldV: number; newV: number; dollars?: boolean }) => {
    const diff = newV - oldV;
    const cls = Math.abs(diff) < 1e-9 ? "text-slate-500" : diff > 0 ? "text-emerald-400" : "text-red-400";
    const fmt = (v: number) => (dollars ? money(v) : v.toFixed(1));
    return (
      <span>
        {fmt(oldV)} <span className={cls}>→ {fmt(newV)}</span>
      </span>
    );
  };

  return (
    <Card title="Market Weights — F / D / G" accent="text-blue-400">
      <p className="text-xs text-slate-500 mb-4">
        How raw ratings (CK/PA/SC/DF/SK, or AG/RB/SC/HS for goalies) turn into the "market" score the whole
        demand engine is built on — comps anchor, elite ladder rank, everything downstream. Each group's
        weights don't have to sum to 1.00, but a sum far from 1.00 scales that group's asks relative to the others.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Group grp="f" title="Forwards" fields={F_FIELDS} />
        <Group grp="d" title="Defense" fields={D_FIELDS} />
        <Group grp="g" title="Goalies" fields={G_FIELDS} />
      </div>

      <div className="flex flex-wrap gap-2 mt-5">
        <button onClick={doPreview} disabled={pending}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold disabled:opacity-50">
          {pending ? "…" : "Preview impact"}
        </button>
        <button onClick={doSave} disabled={pending}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold disabled:opacity-50">
          {pending ? "…" : "Save"}
        </button>
        <button onClick={doReset} disabled={pending}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-400">
          Reset to defaults
        </button>
        {saved && <span className="self-center text-sm text-emerald-400">Saved.</span>}
        {error && <span className="self-center text-sm text-red-400">{error}</span>}
      </div>

      {preview && (
        <div className="mt-5 overflow-x-auto">
          <p className="text-xs text-slate-500 mb-2">
            A sample of top-paid signed players — their rating (0-100) and elite-ladder ask (0 = not top-7% of his position) under the CURRENTLY SAVED weights vs. what you've typed above. Nothing is saved yet.
          </p>
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
                <th className="px-3 py-2 text-left font-medium">Player</th>
                <th className="px-3 py-2 text-center font-medium">Pos</th>
                <th className="px-3 py-2 text-right font-medium">Rating</th>
                <th className="px-3 py-2 text-right font-medium">Elite ask</th>
              </tr>
            </thead>
            <tbody>
              {preview.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-500">No comparable sample found.</td></tr>
              ) : preview.map((r) => (
                <tr key={r.id} className="border-b border-slate-800/40 last:border-0">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-center text-slate-400">{r.grp}</td>
                  <td className="px-3 py-2 text-right tabular-nums"><Delta oldV={r.oldMarket} newV={r.newMarket} /></td>
                  <td className="px-3 py-2 text-right tabular-nums"><Delta oldV={r.oldAsk} newV={r.newAsk} dollars /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
