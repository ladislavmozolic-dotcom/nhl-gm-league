"use client";

import { useState } from "react";
import { CURRENT_SEASON_START } from "@/lib/finance";
import { METRICS, METRIC_LABELS, OPS, OP_LABELS, describeConditionSpec, type Metric, type Op, type ConditionSpec } from "@/lib/trade-conditions-shared";

type PickOption = { id: number; label: string; locked?: boolean };

export default function ConditionModal({ player, ownerTeamId, picks, selectedPickIds, initial, onSave, onRemove, onClose }: {
  player: { id: number; name: string };
  ownerTeamId: number;
  picks: PickOption[];
  selectedPickIds: Set<number>;
  initial?: ConditionSpec | null;
  onSave: (spec: ConditionSpec) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [seasonYear, setSeasonYear] = useState(initial?.seasonYear ?? CURRENT_SEASON_START);
  const [metric, setMetric] = useState<Metric>(initial?.metric ?? "PPG");
  const [op, setOp] = useState<Op>(initial?.op ?? "GTE");
  const [threshold, setThreshold] = useState(initial?.threshold ?? 0.6);
  const [metric2, setMetric2] = useState<Metric | "">(initial?.metric2 ?? "GAMES_PLAYED");
  const [op2, setOp2] = useState<Op>(initial?.op2 ?? "GTE");
  const [threshold2, setThreshold2] = useState(initial?.threshold2 ?? 60);
  const [logic2, setLogic2] = useState<"AND" | "OR">(initial?.logic2 ?? "AND");
  const availableA = picks.filter((p) => !p.locked && selectedPickIds.has(p.id));
  const availableB = picks.filter((p) => !p.locked);
  const [pickAId, setPickAId] = useState<number | "">(initial?.pickAId ?? (availableA.length === 1 ? availableA[0].id : ""));
  const [pickBId, setPickBId] = useState<number | "">(initial?.pickBId ?? "");
  const [error, setError] = useState<string | null>(null);

  const sel = "bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200";

  const save = () => {
    if (!pickAId || !pickBId) { setError("Pick both Pick A and Pick B."); return; }
    if (pickAId === pickBId) { setError("Pick A and Pick B must be different picks."); return; }
    if (!selectedPickIds.has(Number(pickAId))) { setError("Pick A must already be checked in this trade's Draft Picks."); return; }
    const pickA = picks.find((p) => p.id === pickAId), pickB = picks.find((p) => p.id === pickBId);
    if (!pickA || !pickB) { setError("Pick not found."); return; }
    onSave({
      ownerTeamId, playerId: player.id, playerName: player.name, seasonYear,
      metric, op, threshold,
      metric2: metric2 || undefined, op2: metric2 ? op2 : undefined, threshold2: metric2 ? threshold2 : undefined, logic2: metric2 ? logic2 : undefined,
      pickAId: Number(pickAId), pickALabel: pickA.label,
      pickBId: Number(pickBId), pickBLabel: pickB.label,
    });
  };

  const preview = pickAId && pickBId ? describeConditionSpec({
    ownerTeamId, playerId: player.id, playerName: player.name, seasonYear,
    metric, op, threshold,
    metric2: metric2 || undefined, op2: metric2 ? op2 : undefined, threshold2: metric2 ? threshold2 : undefined, logic2: metric2 ? logic2 : undefined,
    pickAId: Number(pickAId), pickALabel: picks.find((p) => p.id === pickAId)?.label ?? "?",
    pickBId: Number(pickBId), pickBLabel: picks.find((p) => p.id === pickBId)?.label ?? "?",
  }) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-lg w-full space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-slate-100">Conditional pick — {player.name}</h3>
        <p className="text-xs text-slate-500">Judged on his REAL NHL production (not this league&apos;s sims). Pick A conveys as-is unless he clears the bar below, in which case Pick B conveys instead.</p>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-xs text-slate-500">Real NHL season (start year)</span>
            <input type="number" className={`${sel} w-full`} value={seasonYear} onChange={(e) => setSeasonYear(Number(e.target.value))} />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2 items-end">
          <label className="space-y-1">
            <span className="text-xs text-slate-500">Metric</span>
            <select className={`${sel} w-full`} value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
              {METRICS.map((m) => <option key={m} value={m}>{METRIC_LABELS[m]}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-500">Op</span>
            <select className={`${sel} w-full`} value={op} onChange={(e) => setOp(e.target.value as Op)}>
              {OPS.map((o) => <option key={o} value={o}>{OP_LABELS[o]}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-500">Threshold</span>
            <input type="number" step={0.01} className={`${sel} w-full`} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
          </label>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <select className={sel} value={logic2} onChange={(e) => setLogic2(e.target.value as "AND" | "OR")} disabled={!metric2}>
            <option value="AND">AND also</option>
            <option value="OR">OR</option>
          </select>
          <span>(set metric below to &quot;none&quot; for a single-clause condition)</span>
        </div>

        <div className="grid grid-cols-3 gap-2 items-end">
          <label className="space-y-1">
            <span className="text-xs text-slate-500">Metric 2</span>
            <select className={`${sel} w-full`} value={metric2} onChange={(e) => setMetric2(e.target.value as Metric | "")}>
              <option value="">— none —</option>
              {METRICS.map((m) => <option key={m} value={m}>{METRIC_LABELS[m]}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-500">Op</span>
            <select className={`${sel} w-full`} value={op2} onChange={(e) => setOp2(e.target.value as Op)} disabled={!metric2}>
              {OPS.map((o) => <option key={o} value={o}>{OP_LABELS[o]}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-500">Threshold</span>
            <input type="number" step={0.01} className={`${sel} w-full`} value={threshold2} onChange={(e) => setThreshold2(Number(e.target.value))} disabled={!metric2} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-xs text-slate-500">Pick A — conveys as-is if NOT met</span>
            <select className={`${sel} w-full`} value={pickAId} onChange={(e) => setPickAId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">— select —</option>
              {availableA.map((p) => <option key={p.id} value={p.id} disabled={p.id === pickBId}>{p.label}</option>)}
            </select>
            {availableA.length === 0 && <p className="text-[11px] text-amber-400">Check a pick in Draft Picks first — that becomes Pick A.</p>}
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-500">Pick B — conveys INSTEAD if MET</span>
            <select className={`${sel} w-full`} value={pickBId} onChange={(e) => setPickBId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">— select —</option>
              {availableB.map((p) => <option key={p.id} value={p.id} disabled={p.id === pickAId}>{p.label}</option>)}
            </select>
          </label>
        </div>

        {preview && <p className="text-xs text-slate-400 bg-slate-950/50 rounded-lg p-2.5">{preview}</p>}
        {error && <p className="text-xs text-rose-400">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          <button onClick={save} className="text-sm px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 font-semibold text-white">Save condition</button>
          {onRemove && <button onClick={onRemove} className="text-sm px-3 py-1.5 rounded-lg bg-red-900/40 border border-red-800/50 text-red-300">Remove</button>}
          <button onClick={onClose} className="text-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400">Cancel</button>
        </div>
      </div>
    </div>
  );
}
