"use client";

import { useState, useTransition } from "react";
import { attachStructuredCondition } from "@/app/admin/conditions/actions";
import { METRICS, METRIC_LABELS, OPS, OP_LABELS, type Metric, type Op } from "@/lib/trade-conditions-server";

type Option = { id: number; label: string };
type PickOption = { id: number; label: string; locked: boolean };

export default function AttachConditionTracking({ conditionId, skaterOptions, picks, defaultSeasonYear }: {
  conditionId: number; skaterOptions: Option[]; picks: PickOption[]; defaultSeasonYear: number;
}) {
  const [open, setOpen] = useState(false);
  const [playerId, setPlayerId] = useState<number | "">("");
  const [seasonYear, setSeasonYear] = useState(defaultSeasonYear);
  const [metric, setMetric] = useState<Metric>("PPG");
  const [op, setOp] = useState<Op>("GTE");
  const [threshold, setThreshold] = useState(0.6);
  const [metric2, setMetric2] = useState<Metric | "">("GAMES_PLAYED");
  const [op2, setOp2] = useState<Op>("GTE");
  const [threshold2, setThreshold2] = useState(60);
  const [logic2, setLogic2] = useState<"AND" | "OR">("AND");
  const [pickAId, setPickAId] = useState<number | "">("");
  const [pickBId, setPickBId] = useState<number | "">("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const availablePicks = picks.filter((p) => !p.locked);

  const submit = () => start(async () => {
    if (!playerId || !pickAId || !pickBId) { setMsg("Pick a player and both picks."); return; }
    const r = await attachStructuredCondition({
      conditionId, playerId: Number(playerId), seasonYear,
      metric, op, threshold,
      metric2: metric2 || "", op2, threshold2: metric2 ? threshold2 : null, logic2: metric2 ? logic2 : "",
      pickAId: Number(pickAId), pickBId: Number(pickBId),
    });
    setMsg(r.ok ? "Attached — both picks are now locked." : r.error);
  });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold">
        + Attach stat tracking
      </button>
    );
  }

  const sel = "bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200";

  return (
    <div className="mt-3 bg-slate-950/50 rounded-lg p-3 space-y-3 text-sm">
      <div className="grid sm:grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-xs text-slate-500">Player</span>
          <select className={`${sel} w-full`} value={playerId} onChange={(e) => setPlayerId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">— select —</option>
            {skaterOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-slate-500">Season (start year)</span>
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
        <select className={sel} value={logic2} onChange={(e) => setLogic2(e.target.value as "AND" | "OR")}>
          <option value="AND">AND also</option>
          <option value="OR">OR</option>
        </select>
        <span>(leave metric below as &quot;none&quot; for a single-clause condition)</span>
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

      <div className="grid sm:grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-xs text-slate-500">Pick A — the upgrade, swaps in INSTEAD if MET</span>
          <select className={`${sel} w-full`} value={pickAId} onChange={(e) => setPickAId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">— select —</option>
            {availablePicks.map((p) => <option key={p.id} value={p.id} disabled={p.id === pickBId}>{p.label}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-slate-500">Pick B — the default, stays as-is if NOT met</span>
          <select className={`${sel} w-full`} value={pickBId} onChange={(e) => setPickBId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">— select —</option>
            {availablePicks.map((p) => <option key={p.id} value={p.id} disabled={p.id === pickAId}>{p.label}</option>)}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={submit} disabled={pending} className="text-xs px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 font-semibold text-white">
          {pending ? "…" : "Attach & lock both picks"}
        </button>
        <button onClick={() => setOpen(false)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400">Cancel</button>
        {msg && <span className="text-xs text-slate-500">{msg}</span>}
      </div>
    </div>
  );
}
