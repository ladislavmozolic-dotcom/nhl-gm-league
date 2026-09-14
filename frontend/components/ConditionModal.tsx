"use client";

import { useState } from "react";
import { CURRENT_SEASON_START } from "@/lib/finance";
import { t, type Lang } from "@/lib/i18n";
import {
  METRICS, OPS, PLAYOFF_ROUNDS, LOTTERY_THRESHOLDS, metricLabel, opLabelFor, roundLabel, describeConditionSpec,
  type Metric, type Op, type PlayoffRound, type ConditionSpec, type ConditionClause, type StatClause,
} from "@/lib/trade-conditions-shared";

type PickOption = { id: number; label: string; locked?: boolean };

const sel = "bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200";

function LogicSelect({ lang, value, onChange }: { lang: Lang; value: "AND" | "OR"; onChange: (l: "AND" | "OR") => void }) {
  return (
    <select className={sel} value={value} onChange={(e) => onChange(e.target.value as "AND" | "OR")}>
      <option value="AND">{t(lang, "cond.and")}</option>
      <option value="OR">{t(lang, "cond.or")}</option>
    </select>
  );
}

function defaultStatClause(logic?: "AND" | "OR"): StatClause {
  return { kind: "STAT", source: "REAL_NHL", seasonYear: CURRENT_SEASON_START, metric: "PPG", op: "GTE", threshold: 0.6, logic };
}

/** One clause's editor. `source` is a UI-only concept: Real NHL always means
 *  kind STAT/source REAL_NHL; UNHL additionally offers Playoff Round and
 *  Contract Extension, neither of which has a real-NHL equivalent. */
function ClauseEditor({ lang, clause, onChange, onRemove }: {
  lang: Lang; clause: ConditionClause; onChange: (c: ConditionClause) => void; onRemove?: () => void;
}) {
  const tt = (key: string) => t(lang, key);
  const source: "REAL_NHL" | "UNHL" = clause.kind === "STAT" ? clause.source : "UNHL";

  const setSource = (s: "REAL_NHL" | "UNHL") => {
    if (s === "REAL_NHL") { onChange({ ...defaultStatClause(clause.logic), source: "REAL_NHL" }); return; }
    if (clause.kind === "STAT") onChange({ ...clause, source: "UNHL" });
    else onChange({ ...defaultStatClause(clause.logic), source: "UNHL" });
  };
  const setKind = (kind: ConditionClause["kind"]) => {
    if (kind === "STAT") { onChange({ ...defaultStatClause(clause.logic), source: "UNHL" }); return; }
    if (kind === "PLAYOFF_ROUND") { onChange({ kind: "PLAYOFF_ROUND", seasonYear: CURRENT_SEASON_START, round: "MADE_PLAYOFFS", logic: clause.logic }); return; }
    onChange({ kind: "CONTRACT_EXT", extended: true, logic: clause.logic });
  };

  return (
    <div className="space-y-2 border-t border-slate-800 pt-3">
      <div className="flex items-center gap-2 flex-wrap">
        {clause.logic && <LogicSelect lang={lang} value={clause.logic} onChange={(l) => onChange({ ...clause, logic: l })} />}
        <label className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">{tt("cond.sourceLabel")}</span>
          <select className={sel} value={source} onChange={(e) => setSource(e.target.value as "REAL_NHL" | "UNHL")}>
            <option value="REAL_NHL">{tt("cond.source.REAL_NHL")}</option>
            <option value="UNHL">{tt("cond.source.UNHL")}</option>
          </select>
        </label>
        {source === "UNHL" && (
          <label className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">{tt("cond.kindLabel")}</span>
            <select className={sel} value={clause.kind} onChange={(e) => setKind(e.target.value as ConditionClause["kind"])}>
              <option value="STAT">{tt("cond.kind.STAT")}</option>
              <option value="PLAYOFF_ROUND">{tt("cond.kind.PLAYOFF_ROUND")}</option>
              <option value="CONTRACT_EXT">{tt("cond.kind.CONTRACT_EXT")}</option>
            </select>
          </label>
        )}
        {onRemove && <button type="button" onClick={onRemove} className="text-xs text-slate-500 hover:text-rose-400 ml-auto">✕ {tt("cond.removeCondition")}</button>}
      </div>

      {clause.kind === "STAT" && (
        <div className="grid grid-cols-4 gap-2 items-end">
          <label className="space-y-1">
            <span className="text-xs text-slate-500">{tt("cond.season")}</span>
            <input type="number" className={`${sel} w-full`} value={clause.seasonYear} onChange={(e) => onChange({ ...clause, seasonYear: Number(e.target.value) })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-500">{tt("cond.metricLabel")}</span>
            <select className={`${sel} w-full`} value={clause.metric} onChange={(e) => onChange({ ...clause, metric: e.target.value as Metric })}>
              {METRICS.map((m) => <option key={m} value={m}>{metricLabel(lang, m)}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-500">{tt("cond.opLabel")}</span>
            <select className={`${sel} w-full`} value={clause.op} onChange={(e) => onChange({ ...clause, op: e.target.value as Op })}>
              {OPS.map((o) => <option key={o} value={o}>{opLabelFor(lang, o)}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-500">{tt("cond.thresholdLabel")}</span>
            <input type="number" step={0.01} className={`${sel} w-full`} value={clause.threshold} onChange={(e) => onChange({ ...clause, threshold: Number(e.target.value) })} />
          </label>
        </div>
      )}

      {clause.kind === "PLAYOFF_ROUND" && (
        <div className="grid grid-cols-2 gap-2 items-end">
          <label className="space-y-1">
            <span className="text-xs text-slate-500">{tt("cond.season")}</span>
            <input type="number" className={`${sel} w-full`} value={clause.seasonYear} onChange={(e) => onChange({ ...clause, seasonYear: Number(e.target.value) })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-500">{tt("cond.roundLabel")}</span>
            <select className={`${sel} w-full`} value={clause.round} onChange={(e) => onChange({ ...clause, round: e.target.value as PlayoffRound })}>
              {PLAYOFF_ROUNDS.map((r) => <option key={r} value={r}>{roundLabel(lang, r)}</option>)}
            </select>
          </label>
        </div>
      )}

      {clause.kind === "CONTRACT_EXT" && (
        <label className="space-y-1 block">
          <span className="text-xs text-slate-500">{tt("cond.extendedLabel")}</span>
          <select className={`${sel} w-full`} value={clause.extended ? "yes" : "no"} onChange={(e) => onChange({ ...clause, extended: e.target.value === "yes" })}>
            <option value="yes">{tt("cond.contractExtYes")}</option>
            <option value="no">{tt("cond.contractExtNo")}</option>
          </select>
        </label>
      )}
    </div>
  );
}

export default function ConditionModal({ player, ownerTeamId, picks, presetPickBId, initial, lang = "en", onSave, onRemove, onClose }: {
  /** null = no tracked player at all — this is a pick-level protected-pick
   *  condition (LOTTERY_PROTECTION), opened from a Draft Pick row instead of
   *  a player row. */
  player: { id: number; name: string } | null;
  ownerTeamId: number;
  picks: PickOption[];
  /** Set when opened from a specific pick's own protect toggle — that pick
   *  IS Pick B (the one being protected) and can't be changed here. */
  presetPickBId?: number;
  initial?: ConditionSpec | null;
  lang?: Lang;
  onSave: (spec: ConditionSpec) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const tt = (key: string) => t(lang, key);
  const lotteryMode = player == null;
  const [clauses, setClauses] = useState<ConditionClause[]>(
    initial?.clauses ?? (lotteryMode ? [{ kind: "LOTTERY_PROTECTION", threshold: 10 }] : [defaultStatClause()])
  );
  const available = picks.filter((p) => !p.locked);
  const [pickAId, setPickAId] = useState<number | "">(initial?.pickAId ?? "");
  const [pickBId, setPickBId] = useState<number | "">(initial?.pickBId ?? presetPickBId ?? "");
  const [error, setError] = useState<string | null>(null);

  const updateClause = (i: number, c: ConditionClause) => setClauses((cs) => cs.map((x, idx) => (idx === i ? c : x)));
  const addClause = () => setClauses((cs) => [...cs, defaultStatClause("AND")]);
  const removeLastClause = () => setClauses((cs) => cs.slice(0, -1));

  const buildSpec = (): ConditionSpec => ({
    ownerTeamId,
    playerId: player?.id, playerName: player?.name,
    clauses,
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
  const pickBLabelText = picks.find((p) => p.id === pickBId)?.label ?? "?";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-slate-100">{lotteryMode ? tt("cond.modalTitleLottery") : `${tt("cond.modalTitle")} — ${player!.name}`}</h3>
        <p className="text-xs text-slate-500">{lotteryMode ? tt("cond.descLottery") : tt("cond.desc")}</p>

        {lotteryMode ? (
          <label className="space-y-1 block max-w-xs">
            <span className="text-xs text-slate-500">{tt("cond.lotteryThresholdLabel")}</span>
            <select className={`${sel} w-full`} value={(clauses[0] as { threshold: number }).threshold}
              onChange={(e) => setClauses([{ kind: "LOTTERY_PROTECTION", threshold: Number(e.target.value) as 10 | 15 }])}>
              {LOTTERY_THRESHOLDS.map((n) => <option key={n} value={n}>TOP {n}</option>)}
            </select>
          </label>
        ) : (
          <>
            {clauses.map((c, i) => (
              <ClauseEditor key={i} lang={lang} clause={c} onChange={(nc) => updateClause(i, nc)}
                onRemove={i > 0 && i === clauses.length - 1 ? removeLastClause : undefined} />
            ))}
            {clauses.length < 3 && (
              <button type="button" onClick={addClause}
                className="text-xs px-2.5 py-1 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600">
                {tt("cond.addCondition")}
              </button>
            )}
          </>
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
            {presetPickBId != null ? (
              <div className={`${sel} w-full opacity-70`}>{pickBLabelText}</div>
            ) : (
              <select className={`${sel} w-full`} value={pickBId} onChange={(e) => setPickBId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">{tt("cond.selectPlaceholder")}</option>
                {available.map((p) => <option key={p.id} value={p.id} disabled={p.id === pickAId}>{p.label}</option>)}
              </select>
            )}
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
