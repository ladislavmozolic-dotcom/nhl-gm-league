"use client";

import { useState } from "react";
import { CURRENT_SEASON_START } from "@/lib/finance";
import { t, type Lang } from "@/lib/i18n";
import { METRICS, OPS, metricLabel, opLabelFor, describeConditionSpec, type Metric, type Op, type ConditionSpec } from "@/lib/trade-conditions-shared";

type PickOption = { id: number; label: string; locked?: boolean };

const sel = "bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200";

function MetricSelect({ lang, value, onChange }: { lang: Lang; value: Metric; onChange: (m: Metric) => void }) {
  return (
    <select className={`${sel} w-full`} value={value} onChange={(e) => onChange(e.target.value as Metric)}>
      {METRICS.map((m) => <option key={m} value={m}>{metricLabel(lang, m)}</option>)}
    </select>
  );
}
function OpSelect({ lang, value, onChange }: { lang: Lang; value: Op; onChange: (o: Op) => void }) {
  return (
    <select className={`${sel} w-full`} value={value} onChange={(e) => onChange(e.target.value as Op)}>
      {OPS.map((o) => <option key={o} value={o}>{opLabelFor(lang, o)}</option>)}
    </select>
  );
}
function LogicSelect({ lang, value, onChange }: { lang: Lang; value: "AND" | "OR"; onChange: (l: "AND" | "OR") => void }) {
  return (
    <select className={sel} value={value} onChange={(e) => onChange(e.target.value as "AND" | "OR")}>
      <option value="AND">{t(lang, "cond.and")}</option>
      <option value="OR">{t(lang, "cond.or")}</option>
    </select>
  );
}

export default function ConditionModal({ player, ownerTeamId, picks, initial, lang = "en", onSave, onRemove, onClose }: {
  player: { id: number; name: string };
  ownerTeamId: number;
  picks: PickOption[];
  initial?: ConditionSpec | null;
  lang?: Lang;
  onSave: (spec: ConditionSpec) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const tt = (key: string) => t(lang, key);
  const [seasonYear, setSeasonYear] = useState(initial?.seasonYear ?? CURRENT_SEASON_START);
  const [metric, setMetric] = useState<Metric>(initial?.metric ?? "PPG");
  const [op, setOp] = useState<Op>(initial?.op ?? "GTE");
  const [threshold, setThreshold] = useState(initial?.threshold ?? 0.6);
  const [metric2, setMetric2] = useState<Metric | "">(initial?.metric2 ?? "");
  const [op2, setOp2] = useState<Op>(initial?.op2 ?? "GTE");
  const [threshold2, setThreshold2] = useState(initial?.threshold2 ?? 60);
  const [logic2, setLogic2] = useState<"AND" | "OR">(initial?.logic2 ?? "AND");
  const [metric3, setMetric3] = useState<Metric | "">(initial?.metric3 ?? "");
  const [op3, setOp3] = useState<Op>(initial?.op3 ?? "GTE");
  const [threshold3, setThreshold3] = useState(initial?.threshold3 ?? 0);
  const [logic3, setLogic3] = useState<"AND" | "OR">(initial?.logic3 ?? "AND");
  const available = picks.filter((p) => !p.locked);
  const [pickAId, setPickAId] = useState<number | "">(initial?.pickAId ?? "");
  const [pickBId, setPickBId] = useState<number | "">(initial?.pickBId ?? "");
  const [error, setError] = useState<string | null>(null);

  const removeClause2 = () => { setMetric2(""); setMetric3(""); };
  const removeClause3 = () => setMetric3("");

  const buildSpec = (): ConditionSpec => ({
    ownerTeamId, playerId: player.id, playerName: player.name, seasonYear,
    metric, op, threshold,
    metric2: metric2 || undefined, op2: metric2 ? op2 : undefined, threshold2: metric2 ? threshold2 : undefined, logic2: metric2 ? logic2 : undefined,
    metric3: metric2 && metric3 ? metric3 : undefined, op3: metric2 && metric3 ? op3 : undefined, threshold3: metric2 && metric3 ? threshold3 : undefined, logic3: metric2 && metric3 ? logic3 : undefined,
    pickAId: Number(pickAId), pickALabel: picks.find((p) => p.id === pickAId)?.label ?? "?",
    pickBId: Number(pickBId), pickBLabel: picks.find((p) => p.id === pickBId)?.label ?? "?",
  });

  const save = () => {
    if (!pickAId || !pickBId) { setError(tt("cond.errBothPicks")); return; }
    if (pickAId === pickBId) { setError(tt("cond.errSamePick")); return; }
    const pickA = picks.find((p) => p.id === pickAId), pickB = picks.find((p) => p.id === pickBId);
    if (!pickA || !pickB) { setError(tt("cond.errPickNotFound")); return; }
    onSave(buildSpec());
  };

  const preview = pickAId && pickBId ? describeConditionSpec(buildSpec(), lang) : null;

  const clauseCount = 1 + (metric2 ? 1 : 0) + (metric2 && metric3 ? 1 : 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-slate-100">{tt("cond.modalTitle")} — {player.name}</h3>
        <p className="text-xs text-slate-500">{tt("cond.desc")}</p>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-xs text-slate-500">{tt("cond.season")}</span>
            <input type="number" className={`${sel} w-full`} value={seasonYear} onChange={(e) => setSeasonYear(Number(e.target.value))} />
          </label>
        </div>

        {/* Clause 1 — always present */}
        <div className="grid grid-cols-3 gap-2 items-end">
          <label className="space-y-1">
            <span className="text-xs text-slate-500">{tt("cond.metricLabel")}</span>
            <MetricSelect lang={lang} value={metric} onChange={setMetric} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-500">{tt("cond.opLabel")}</span>
            <OpSelect lang={lang} value={op} onChange={setOp} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-500">{tt("cond.thresholdLabel")}</span>
            <input type="number" step={0.01} className={`${sel} w-full`} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
          </label>
        </div>

        {/* Clause 2 — optional */}
        {metric2 && (
          <div className="space-y-2 border-t border-slate-800 pt-2">
            <div className="flex items-center gap-2">
              <LogicSelect lang={lang} value={logic2} onChange={setLogic2} />
              <button type="button" onClick={removeClause2} className="text-xs text-slate-500 hover:text-rose-400 ml-auto">✕ {tt("cond.removeCondition")}</button>
            </div>
            <div className="grid grid-cols-3 gap-2 items-end">
              <label className="space-y-1">
                <span className="text-xs text-slate-500">{tt("cond.metricLabel")}</span>
                <MetricSelect lang={lang} value={metric2} onChange={setMetric2} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">{tt("cond.opLabel")}</span>
                <OpSelect lang={lang} value={op2} onChange={setOp2} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">{tt("cond.thresholdLabel")}</span>
                <input type="number" step={0.01} className={`${sel} w-full`} value={threshold2} onChange={(e) => setThreshold2(Number(e.target.value))} />
              </label>
            </div>
          </div>
        )}

        {/* Clause 3 — optional, only once clause 2 exists */}
        {metric2 && metric3 && (
          <div className="space-y-2 border-t border-slate-800 pt-2">
            <div className="flex items-center gap-2">
              <LogicSelect lang={lang} value={logic3} onChange={setLogic3} />
              <button type="button" onClick={removeClause3} className="text-xs text-slate-500 hover:text-rose-400 ml-auto">✕ {tt("cond.removeCondition")}</button>
            </div>
            <div className="grid grid-cols-3 gap-2 items-end">
              <label className="space-y-1">
                <span className="text-xs text-slate-500">{tt("cond.metricLabel")}</span>
                <MetricSelect lang={lang} value={metric3} onChange={setMetric3} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">{tt("cond.opLabel")}</span>
                <OpSelect lang={lang} value={op3} onChange={setOp3} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">{tt("cond.thresholdLabel")}</span>
                <input type="number" step={0.01} className={`${sel} w-full`} value={threshold3} onChange={(e) => setThreshold3(Number(e.target.value))} />
              </label>
            </div>
          </div>
        )}

        {clauseCount < 3 && (
          <button type="button"
            onClick={() => { if (!metric2) setMetric2(METRICS.find((m) => m !== metric) ?? METRICS[0]); else setMetric3(METRICS.find((m) => m !== metric && m !== metric2) ?? METRICS[0]); }}
            className="text-xs px-2.5 py-1 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600">
            {tt("cond.addCondition")}
          </button>
        )}

        <div className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-3">
          <label className="space-y-1">
            <span className="text-xs text-slate-500">{tt("cond.pickA")}</span>
            <select className={`${sel} w-full`} value={pickAId} onChange={(e) => setPickAId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">{tt("cond.selectPlaceholder")}</option>
              {available.map((p) => <option key={p.id} value={p.id} disabled={p.id === pickBId}>{p.label}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-500">{tt("cond.pickB")}</span>
            <select className={`${sel} w-full`} value={pickBId} onChange={(e) => setPickBId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">{tt("cond.selectPlaceholder")}</option>
              {available.map((p) => <option key={p.id} value={p.id} disabled={p.id === pickAId}>{p.label}</option>)}
            </select>
          </label>
        </div>

        {preview && <p className="text-xs text-slate-400 bg-slate-950/50 rounded-lg p-2.5">{preview}</p>}
        {error && <p className="text-xs text-rose-400">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          <button onClick={save} className="text-sm px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 font-semibold text-white">{tt("cond.save")}</button>
          {onRemove && <button onClick={onRemove} className="text-sm px-3 py-1.5 rounded-lg bg-red-900/40 border border-red-800/50 text-red-300">{tt("cond.remove")}</button>}
          <button onClick={onClose} className="text-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400">{tt("cond.cancel")}</button>
        </div>
      </div>
    </div>
  );
}
