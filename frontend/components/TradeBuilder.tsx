"use client";

import { useState, useTransition, useMemo } from "react";
import PlayerLink from "@/components/PlayerLink";
import Link from "next/link";
import { money } from "@/lib/finance";
import { displayName } from "@/lib/playerName";
import { clauseTermsAction, analyzeTradeAction, type TradePackage } from "@/app/trades/build/actions";
import ConditionModal from "@/components/ConditionModal";
import { describeConditionSpec, type ConditionSpec } from "@/lib/trade-conditions-shared";
import { t, type Lang } from "@/lib/i18n";
import GMAssistModal from "@/components/GMAssistModal";

type Player = {
  id: number;
  name: string;
  position: string;
  capHit: number;
  farm: boolean;
  clause?: string | null;
  noTradeTeams?: number[];
  retainedAmount?: number;
  tradeFreezeDaysLeft?: number;
};

type Pick = {
  id: number;
  round?: number;
  label: string;
  logoUrl?: string | null;
  locked?: boolean;
};

type Assets = {
  players: Player[];
  picks: Pick[];
  prospects: Pick[];
};

type Team = {
  id: number;
  name: string;
  logoUrl?: string | null;
};

type Terms = {
  feeAmount: number;
  feePct: number;
  fullPayout: boolean;
  reason: string;
  payTeamId: number;
};

type CapSnapshot = {
  committed: number;
  ceiling: number;
  strictSpace: number;
  floor: number;
  retentionSlotsOutUsed: number;
  retentionSlotsInUsed: number;
  retentionSlotsMax: number;
  retentionPctUsed: number;
  retentionPctMax: number;
  retentionMaxPct: number;
  capUpper: number;
};

const UI_TEXT = {
  en: {
    backToTrades: "← Back to Trades",
    tradeRoom: "Trade Room",
    changeOpponent: "Change Team",
    sends: "sends",
    capSpaceNow: "Cap space now",
    afterTrade: "After trade",
    difference: "Difference",
    retentionSlots: "Retention Slots",
    retentionPct: "Retention % of Cap",
    retExceeded: "⚠ Exceeds league retention limit",
    searchPlaceholder: "Search player, pick, prospect...",
    filterAll: "All",
    filterF: "Forwards",
    filterD: "Defense",
    filterG: "Goalies",
    filterPicks: "Picks",
    filterProspects: "Prospects",
    rosterPlayers: "Roster Players",
    draftPicks: "Draft Picks",
    prospects: "Prospects",
    cash: "Cash compensation",
    salaryRetention: "Salary Retention",
    retains: "retains",
    lockedPending: "🔒 Locked by pending trade",
    freezeDays: "days trade freeze",
    condPick: "COND Pick",
    checkingAgent: "⚖ Checking with agent...",
    agreeFee: "agree to pay",
    fee: "Fee",
    fullPayout: "Full payout",
    payingToWaive: "Paying to waive",
    tradeSummary: "Trade Summary",
    nothingSelected: "Nothing selected yet",
    proposeTrade: "Propose Trade",
    sending: "Sending...",
    gmAssist: "🤖 GM Assist",
    gmAssistHint: "AI GM Assist — evaluates deal value & team fit",
    analyzing: "Analyzing...",
    capCompliance: "✓ Cap Compliant",
    capWarning: "⚠ Cap Over Limit",
    getsCap: "acquires",
    sendsCap: "sheds",
    capFlowCalc: "Cap Space Flow & Balance",
    rulesTitle: "Trade Rules & Retention Limits",
    rulesBody: "Max salary retention is 50% per contract, with up to 3 total slots and 10% of league cap ceiling. Deals are evaluated and approved by League Commission.",
  },
  sk: {
    backToTrades: "← Späť na Výměny",
    tradeRoom: "Trade Room",
    changeOpponent: "Zmeniť tím",
    sends: "vysiela",
    capSpaceNow: "Miesto pod stropom",
    afterTrade: "Po výmene",
    difference: "Rozdiel",
    retentionSlots: "Retenčné sloty",
    retentionPct: "Retencia zo stropu",
    retExceeded: "⚠ Prekročený povolený retenčný limit",
    searchPlaceholder: "Hľadať hráča, pick, prospekt...",
    filterAll: "Všetko",
    filterF: "Útočníci",
    filterD: "Obrana",
    filterG: "Brankári",
    filterPicks: "Picky",
    filterProspects: "Prospekty",
    rosterPlayers: "Hráči tímu",
    draftPicks: "Draftové voľby",
    prospects: "Prospekty",
    cash: "Finančná kompenzácia",
    salaryRetention: "Retencia platu",
    retains: "ponecháva si",
    lockedPending: "🔒 Uzamknutý v čakajúcej výmene",
    freezeDays: "dní zmrazená výmena",
    condPick: "COND Pick",
    checkingAgent: "⚖ Overujem u agenta...",
    agreeFee: "súhlasiť s úhradou",
    fee: "Poplatok",
    fullPayout: "Celá čiastka",
    payingToWaive: "Úhrada za zrušenie doložky",
    tradeSummary: "Zhrnutie výmeny",
    nothingSelected: "Zatiaľ nič nevybrané",
    proposeTrade: "Podať ponuku na výmenu",
    sending: "Odosielam...",
    gmAssist: "🤖 GM Assist",
    gmAssistHint: "AI GM Assist — vyhodnotí hodnotu a zmysel výmeny",
    analyzing: "Analyzujem...",
    capCompliance: "✓ Cap Compliant",
    capWarning: "⚠ Prekročený platový strop",
    getsCap: "získa",
    sendsCap: "odovzdá",
    capFlowCalc: "Bilancia a dopad na platový strop",
    rulesTitle: "Pravidlá výmen & Retencia",
    rulesBody: "Max. retencia platu je 50% na hráča, celkovo max. 3 sloty a 10% z platového stropu. Výmeny posudzuje a schvaľuje Ligová Komisia.",
  },
};

function getDict(lang: Lang) {
  return lang === "cs" ? UI_TEXT.sk : UI_TEXT.en;
}

function netTransferred(map: Record<number, number>, assets: Assets): number {
  return Object.entries(map).reduce((sum, [id, pct]) => {
    const p = assets.players.find((pl) => pl.id === Number(id));
    if (!p || p.farm) return sum;
    return sum + p.capHit * (1 - pct / 100);
  }, 0);
}

function retentionAdded(map: Record<number, number>, assets: Assets, capUpper: number): { slots: number; pct: number } {
  let slots = 0, dollars = 0;
  for (const [id, pct] of Object.entries(map)) {
    if (pct <= 0) continue;
    const p = assets.players.find((pl) => pl.id === Number(id));
    if (!p || p.farm) continue;
    slots++;
    dollars += (p.capHit * pct) / 100;
  }
  return { slots, pct: capUpper > 0 ? (dollars / capUpper) * 100 : 0 };
}

function retainedInAdded(incomingMap: Record<number, number>, incomingAssets: Assets): { count: number; dollars: number } {
  let count = 0, dollars = 0;
  for (const [id, pct] of Object.entries(incomingMap)) {
    const p = incomingAssets.players.find((pl) => pl.id === Number(id));
    if (!p || p.farm) continue;
    const total = (p.retainedAmount ?? 0) + (pct > 0 ? (p.capHit * pct) / 100 : 0);
    if (total > 0) { count++; dollars += total; }
  }
  return { count, dollars };
}

function retainedInLeaving(pmap: Record<number, number>, assets: Assets): { count: number; dollars: number } {
  let count = 0, dollars = 0;
  for (const id of Object.keys(pmap)) {
    const p = assets.players.find((pl) => pl.id === Number(id));
    if (!p || p.farm || !(p.retainedAmount ?? 0)) continue;
    count++; dollars += p.retainedAmount ?? 0;
  }
  return { count, dollars };
}

const setRet = (map: Record<number, number>, set: (v: Record<number, number>) => void, id: number, pct: number, maxPct: number) =>
  set({ ...map, [id]: Math.max(0, Math.min(maxPct, pct)) });

function CapAndRetentionHUD({
  status,
  delta,
  newOutSlots,
  newOutPct,
  newIn,
  leavingIn,
  lang,
}: {
  status: CapSnapshot;
  delta: number;
  newOutSlots: number;
  newOutPct: number;
  newIn: { count: number; dollars: number };
  leavingIn: { count: number; dollars: number };
  lang: Lang;
}) {
  const tTxt = getDict(lang);
  const spaceNow = status.strictSpace;
  const spaceAfter = spaceNow - delta;
  const color = (v: number) => (v < 0 ? "text-rose-400" : "text-emerald-400");

  const outAfter = status.retentionSlotsOutUsed + newOutSlots;
  const inAfter = status.retentionSlotsInUsed - leavingIn.count + newIn.count;
  const slotsAfter = outAfter + inAfter;
  const newInPct = status.capUpper > 0 ? (newIn.dollars / status.capUpper) * 100 : 0;
  const leavingInPct = status.capUpper > 0 ? (leavingIn.dollars / status.capUpper) * 100 : 0;
  const pctAfter = status.retentionPctUsed - leavingInPct + newOutPct + newInPct;
  const over = slotsAfter > status.retentionSlotsMax || pctAfter > status.retentionPctMax;

  // Cap meter calculation (percentage of ceiling used)
  const ceiling = status.ceiling || 88000000;
  const committedNow = status.committed || ceiling - spaceNow;
  const committedAfter = committedNow + delta;
  const pctUsedNow = Math.min(100, Math.max(0, (committedNow / ceiling) * 100));
  const pctUsedAfter = Math.min(100, Math.max(0, (committedAfter / ceiling) * 100));

  return (
    <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-3 space-y-3 shadow-inner">
      {/* Top row: Cap Space Meter */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">{tTxt.capSpaceNow}</span>
          <span className={`font-mono font-bold ${color(spaceNow)}`}>{money(spaceNow)}</span>
        </div>
        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
          <div
            className={`h-full transition-all duration-300 ${spaceAfter < 0 ? "bg-rose-500" : "bg-emerald-500"}`}
            style={{ width: `${delta !== 0 ? pctUsedAfter : pctUsedNow}%` }}
          />
        </div>
        {delta !== 0 && (
          <div className="flex items-center justify-between text-[11px] pt-0.5">
            <span className="text-slate-400">
              {tTxt.afterTrade}: <span className={`font-mono font-bold ${color(spaceAfter)}`}>{money(spaceAfter)}</span>
            </span>
            <span
              className={`font-mono font-bold px-1.5 py-0.2 rounded text-[10px] ${
                delta > 0 ? "bg-rose-950/40 text-rose-300 border border-rose-800/40" : "bg-emerald-950/40 text-emerald-300 border border-emerald-800/40"
              }`}
            >
              {delta > 0 ? "−" : "+"}{money(Math.abs(delta))}
            </span>
          </div>
        )}
      </div>

      {/* Bottom row: Retention Capacity */}
      <div className="pt-2 border-t border-slate-800/70 flex items-center justify-between text-[11px]">
        <div>
          <span className="text-slate-400 font-medium">{tTxt.retentionSlots}: </span>
          <span className={`font-mono font-semibold ${slotsAfter > status.retentionSlotsMax ? "text-amber-400" : "text-slate-200"}`}>
            {slotsAfter} / {status.retentionSlotsMax}
          </span>
          <span className="text-slate-500 text-[10px] ml-1">({outAfter} out, {inAfter} in)</span>
        </div>
        <div>
          <span className="text-slate-400 font-medium">{tTxt.retentionPct}: </span>
          <span className={`font-mono font-semibold ${pctAfter > status.retentionPctMax ? "text-amber-400" : "text-slate-200"}`}>
            {pctAfter.toFixed(1)}% / {status.retentionPctMax}%
          </span>
        </div>
      </div>

      {over && (
        <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-800/50 text-amber-300 text-[11px] font-medium flex items-center gap-1.5">
          <span>⚠</span>
          <span>{tTxt.retExceeded}</span>
        </div>
      )}
    </div>
  );
}

function PositionBadge({ pos }: { pos: string }) {
  const p = pos.toUpperCase();
  let bg = "bg-blue-500/20 text-blue-300 border-blue-500/30";
  if (p.includes("G")) bg = "bg-amber-500/20 text-amber-300 border-amber-500/30";
  else if (p.includes("D")) bg = "bg-indigo-500/20 text-indigo-300 border-indigo-500/30";
  else if (p.includes("C")) bg = "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
  else if (p.includes("W")) bg = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";

  return <span className={`px-1.5 py-0.2 rounded text-[10px] font-black border ${bg}`}>{pos}</span>;
}

function PlayerTable({
  list,
  pmap,
  setPmap,
  destTeamId,
  ownerTeamId,
  terms,
  fees,
  onToggleClause,
  onAgreeFee,
  maxRetentionPct,
  conditionSpec,
  onOpenCondition,
  onRemoveCondition,
  lang,
  searchQuery,
  posFilter,
}: {
  list: Player[];
  pmap: Record<number, number>;
  setPmap: (v: Record<number, number>) => void;
  destTeamId: number;
  ownerTeamId: number;
  terms: Record<number, Terms | "loading">;
  fees: Record<number, { feeAmount: number; payTeamId: number }>;
  onToggleClause: (map: Record<number, number>, set: (v: Record<number, number>) => void, p: Player, destTeamId: number, ownerTeamId: number) => void;
  onAgreeFee: (id: number, t: Terms) => void;
  maxRetentionPct: number;
  conditionSpec: ConditionSpec | null;
  onOpenCondition: (p: Player) => void;
  onRemoveCondition: () => void;
  lang: Lang;
  searchQuery: string;
  posFilter: string;
}) {
  const tTxt = getDict(lang);

  const filtered = useMemo(() => {
    return list.filter((p) => {
      // Text search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.position.toLowerCase().includes(q)) {
          return false;
        }
      }
      // Position filter
      if (posFilter === "all") return true;
      const pos = p.position.toUpperCase();
      if (posFilter === "F") return pos.includes("C") || pos.includes("W") || pos.includes("F");
      if (posFilter === "D") return pos.includes("D");
      if (posFilter === "G") return pos.includes("G");
      return true;
    });
  }, [list, searchQuery, posFilter]);

  if (filtered.length === 0) {
    return (
      <div className="py-6 text-center text-slate-500 text-xs italic">
        {list.length === 0 ? "No players" : "No players match filter"}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((p) => {
        const on = p.id in pmap;
        const frozen = (p.tradeFreezeDaysLeft ?? 0) > 0;
        const needsWaiver = !!p.clause && (p.clause !== "M_NTC" || (p.noTradeTeams ?? []).includes(destTeamId));

        return (
          <div
            key={p.id}
            className={`p-2.5 rounded-xl border transition-all duration-200 ${
              on
                ? "bg-blue-950/30 border-blue-500/50 shadow-md shadow-blue-950/20"
                : "bg-slate-950/40 border-slate-800/80 hover:border-slate-700/90"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <label
                className={`flex items-center gap-2.5 flex-1 min-w-0 ${
                  frozen ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                }`}
                title={
                  frozen
                    ? `A retention on his contract freezes him from any trade for ${p.tradeFreezeDaysLeft} more in-season day(s).`
                    : undefined
                }
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={frozen}
                  onChange={() => !frozen && onToggleClause(pmap, setPmap, p, destTeamId, ownerTeamId)}
                  className="accent-blue-500 w-4 h-4 rounded cursor-pointer shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-xs text-white truncate">
                      <PlayerLink id={p.id} name={displayName(p.name)} />
                    </span>
                    <PositionBadge pos={p.position} />
                    {p.farm && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-indigo-950/60 text-indigo-300 border border-indigo-800/50">
                        AHL
                      </span>
                    )}
                    {p.clause && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-950/60 text-rose-300 border border-rose-800/50">
                        {p.clause === "NMC" ? "NMC" : "M-NTC"}
                      </span>
                    )}
                  </div>
                </div>
              </label>

              <div className="text-right shrink-0">
                <div className="font-mono text-xs font-bold text-slate-200">{money(p.capHit)}</div>
                <div className="text-[10px] text-slate-500 font-mono">{p.farm ? "Minors" : "Cap Hit"}</div>
              </div>
            </div>

            {frozen && (
              <p className="mt-1.5 ml-6.5 text-[11px] text-amber-400 flex items-center gap-1">
                <span>🔒</span>
                <span>
                  {p.tradeFreezeDaysLeft} {tTxt.freezeDays}
                </span>
              </p>
            )}

            {/* Waiver terms checking / confirmation */}
            {on && needsWaiver && (() => {
              const tTerm = terms[p.id];
              if (!tTerm || tTerm === "loading") {
                return (
                  <p className="mt-2 ml-6.5 text-[11px] text-slate-400 italic flex items-center gap-1">
                    <span>⚖</span> {tTxt.checkingAgent}
                  </p>
                );
              }
              const agreed = p.id in fees;
              return (
                <div className="mt-2 ml-6.5 text-[11px] bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <p className={tTerm.feeAmount === 0 ? "text-emerald-400 font-medium" : "text-amber-300 font-medium"}>
                    ⚖ {tTerm.reason}
                  </p>
                  {tTerm.feeAmount > 0 && (
                    <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreed}
                        onChange={() => onAgreeFee(p.id, tTerm)}
                        className="accent-amber-500 w-3.5 h-3.5 rounded"
                      />
                      <span className={agreed ? "text-amber-300 font-semibold" : "text-rose-400"}>
                        {agreed
                          ? `${tTxt.payingToWaive} ${money(tTerm.feeAmount)}`
                          : `${tTerm.fullPayout ? tTxt.fullPayout : tTxt.fee} ${money(tTerm.feeAmount)} (${tTerm.feePct}%) — ${tTxt.agreeFee}`}
                      </span>
                    </label>
                  )}
                </div>
              );
            })()}

            {/* Retention stepper and Condition Pick launcher */}
            {on && (
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                {p.capHit > 0 && !p.farm ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[11px] text-slate-400 font-medium">{tTxt.salaryRetention}:</span>
                    <div className="flex items-center bg-slate-950 border border-slate-700/80 rounded-lg overflow-hidden shadow-inner">
                      <button
                        type="button"
                        onClick={() => setRet(pmap, setPmap, p.id, (pmap[p.id] || 0) - 5, maxRetentionPct)}
                        className="px-2 py-0.5 hover:bg-slate-800 text-slate-300 font-bold transition-colors"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={maxRetentionPct}
                        step={5}
                        value={pmap[p.id] || 0}
                        onChange={(e) => setRet(pmap, setPmap, p.id, Number(e.target.value), maxRetentionPct)}
                        className="w-11 bg-transparent text-center font-mono text-xs font-bold text-amber-300 outline-none"
                      />
                      <span className="text-slate-500 text-[10px] pr-1.5">%</span>
                      <button
                        type="button"
                        onClick={() => setRet(pmap, setPmap, p.id, (pmap[p.id] || 0) + 5, maxRetentionPct)}
                        className="px-2 py-0.5 hover:bg-slate-800 text-slate-300 font-bold transition-colors"
                      >
                        +
                      </button>
                    </div>
                    {pmap[p.id] > 0 && (
                      <span className="text-[11px] font-mono text-amber-400 font-medium">
                        {tTxt.retains} {money((p.capHit * pmap[p.id]) / 100)}
                      </span>
                    )}
                  </div>
                ) : <div />}

                {/* Conditional pick trigger */}
                <div>
                  <button
                    type="button"
                    onClick={() => (conditionSpec?.playerId === p.id ? onRemoveCondition() : onOpenCondition(p))}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-colors flex items-center gap-1 ${
                      conditionSpec?.playerId === p.id
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                        : "bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-300"
                    }`}
                  >
                    <span>📋</span>
                    <span>{tTxt.condPick}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Condition badge summary if attached */}
            {on && conditionSpec?.playerId === p.id && (
              <div className="mt-2 text-xs bg-amber-950/20 border border-amber-800/40 rounded-lg p-2 text-amber-300/90 flex items-center justify-between gap-2">
                <span className="truncate">📋 {describeConditionSpec(conditionSpec, lang)}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenCondition(p)}
                    className="underline text-amber-200 hover:text-white text-[11px]"
                  >
                    {t(lang, "cond.edit")}
                  </button>
                  <button
                    type="button"
                    onClick={onRemoveCondition}
                    className="text-rose-400 hover:text-rose-200 text-[11px]"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CheckTable({
  title,
  icon,
  list,
  sel,
  setSel,
  onToggle,
  searchQuery,
  lang,
}: {
  title: string;
  icon: string;
  list: Pick[];
  sel: Set<number>;
  setSel: (s: Set<number>) => void;
  onToggle: (sel: Set<number>, setSel: (s: Set<number>) => void, id: number) => void;
  searchQuery: string;
  lang: Lang;
}) {
  const tTxt = getDict(lang);

  const filtered = useMemo(() => {
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((it) => it.label.toLowerCase().includes(q));
  }, [list, searchQuery]);

  if (filtered.length === 0) {
    return (
      <div className="py-4 text-center text-slate-500 text-xs italic">
        {list.length === 0 ? "None" : "No items match filter"}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {filtered.map((it) => {
        const on = sel.has(it.id);
        return (
          <label
            key={it.id}
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs select-none transition-all ${
              it.locked
                ? "cursor-not-allowed opacity-50 bg-slate-950/30 border-slate-900"
                : "cursor-pointer"
            } ${
              on
                ? "bg-blue-950/30 border-blue-500/50 text-white"
                : "bg-slate-950/40 border-slate-800/80 hover:border-slate-700/80 text-slate-300"
            }`}
            title={it.locked ? tTxt.lockedPending : undefined}
          >
            <div className="flex items-center gap-2 min-w-0">
              <input
                type="checkbox"
                checked={on}
                disabled={it.locked}
                onChange={() => !it.locked && onToggle(sel, setSel, it.id)}
                className="accent-blue-500 w-4 h-4 rounded cursor-pointer shrink-0"
              />
              {it.logoUrl && <img src={it.logoUrl} alt="" className="w-4 h-4 object-contain shrink-0" />}
              <span className="truncate">
                {icon} {it.label}
              </span>
            </div>
            {it.locked ? (
              <span className="text-[10px] font-mono text-amber-400 font-bold shrink-0">
                🔒 LOCKED
              </span>
            ) : it.round ? (
              <span className="text-[10px] font-mono text-slate-500 shrink-0">
                R{it.round}
              </span>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}

function Side({
  team,
  assets,
  pmap,
  setPmap,
  pk,
  setPk,
  pro,
  setPro,
  cash,
  setCash,
  destTeamId,
  terms,
  fees,
  onToggleClause,
  onAgreeFee,
  onTogglePick,
  onTogglePickAsset,
  capStatus,
  capDelta,
  incomingAssets,
  incomingPmap,
  conditionSpec,
  onOpenCondition,
  onRemoveCondition,
  lang,
  accentColor,
}: {
  team: Team;
  assets: Assets;
  pmap: Record<number, number>;
  setPmap: (v: Record<number, number>) => void;
  pk: Set<number>;
  setPk: (s: Set<number>) => void;
  pro: Set<number>;
  setPro: (s: Set<number>) => void;
  cash: number;
  setCash: (n: number) => void;
  destTeamId: number;
  terms: Record<number, Terms | "loading">;
  fees: Record<number, { feeAmount: number; payTeamId: number }>;
  onToggleClause: (map: Record<number, number>, set: (v: Record<number, number>) => void, p: Player, destTeamId: number, ownerTeamId: number) => void;
  onAgreeFee: (id: number, t: Terms) => void;
  onTogglePick: (sel: Set<number>, setSel: (s: Set<number>) => void, id: number) => void;
  onTogglePickAsset: (sel: Set<number>, setSel: (s: Set<number>) => void, id: number) => void;
  capStatus: CapSnapshot;
  capDelta: number;
  incomingAssets: Assets;
  incomingPmap: Record<number, number>;
  conditionSpec: ConditionSpec | null;
  onOpenCondition: (p: Player, ownerTeamId: number, picks: Pick[]) => void;
  onRemoveCondition: () => void;
  lang: Lang;
  accentColor: string;
}) {
  const tTxt = getDict(lang);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const added = retentionAdded(pmap, assets, capStatus.capUpper);
  const addedIn = retainedInAdded(incomingPmap, incomingAssets);
  const leavingIn = retainedInLeaving(pmap, assets);

  return (
    <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-3.5 sm:p-4 space-y-3.5 shadow-xl backdrop-blur-md relative overflow-hidden">
      {/* Top Accent Gradient Bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accentColor}`} />

      {/* Team Header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-slate-950/80 border border-slate-800 p-1 flex items-center justify-center shrink-0 shadow-inner">
            {team.logoUrl ? (
              <img src={team.logoUrl} alt={team.name} className="w-8 h-8 object-contain" />
            ) : (
              <span className="text-sm font-black">🏒</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{team.name} {tTxt.sends}</div>
            <h3 className="text-base font-black text-white tracking-tight truncate">{team.name}</h3>
          </div>
        </div>
      </div>

      {/* Cap & Retention HUD */}
      <CapAndRetentionHUD
        status={capStatus}
        delta={capDelta}
        newOutSlots={added.slots}
        newOutPct={added.pct}
        newIn={addedIn}
        leavingIn={leavingIn}
        lang={lang}
      />

      {/* Search Input & Filter Pills */}
      <div className="space-y-2">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tTxt.searchPlaceholder}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
          <span className="absolute left-2.5 top-2 text-slate-500 text-xs">🔍</span>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2 text-slate-500 hover:text-white text-xs"
            >
              ×
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px] custom-scrollbar">
          {[
            { id: "all", label: tTxt.filterAll },
            { id: "F", label: tTxt.filterF },
            { id: "D", label: tTxt.filterD },
            { id: "G", label: tTxt.filterG },
            { id: "picks", label: `${tTxt.filterPicks} (${assets.picks.length})` },
            { id: "prospects", label: `${tTxt.filterProspects} (${assets.prospects.length})` },
          ].map((flt) => (
            <button
              key={flt.id}
              onClick={() => setActiveFilter(flt.id)}
              className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-all ${
                activeFilter === flt.id
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80"
              }`}
            >
              {flt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Assets Scroll Area */}
      <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1 custom-scrollbar">
        {/* PLAYERS SECTION */}
        {(activeFilter === "all" || activeFilter === "F" || activeFilter === "D" || activeFilter === "G") && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
              <span>{tTxt.rosterPlayers}</span>
              <span className="text-slate-500 font-mono text-[10px]">{assets.players.length}</span>
            </div>
            <PlayerTable
              list={assets.players}
              pmap={pmap}
              setPmap={setPmap}
              destTeamId={destTeamId}
              ownerTeamId={team.id}
              terms={terms}
              fees={fees}
              onToggleClause={onToggleClause}
              onAgreeFee={onAgreeFee}
              maxRetentionPct={capStatus.retentionMaxPct}
              conditionSpec={conditionSpec && assets.players.some((pl) => pl.id === conditionSpec.playerId) ? conditionSpec : null}
              onOpenCondition={(p) => onOpenCondition(p, team.id, incomingAssets.picks)}
              onRemoveCondition={onRemoveCondition}
              lang={lang}
              searchQuery={search}
              posFilter={activeFilter}
            />
          </div>
        )}

        {/* DRAFT PICKS SECTION */}
        {(activeFilter === "all" || activeFilter === "picks") && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 pt-1">
              <span>{tTxt.draftPicks}</span>
              <span className="text-slate-500 font-mono text-[10px]">{assets.picks.length}</span>
            </div>
            <CheckTable
              title={tTxt.draftPicks}
              icon="🎫"
              list={assets.picks}
              sel={pk}
              setSel={setPk}
              onToggle={onTogglePickAsset}
              searchQuery={search}
              lang={lang}
            />
          </div>
        )}

        {/* PROSPECTS SECTION */}
        {(activeFilter === "all" || activeFilter === "prospects") && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 pt-1">
              <span>{tTxt.prospects}</span>
              <span className="text-slate-500 font-mono text-[10px]">{assets.prospects.length}</span>
            </div>
            <CheckTable
              title={tTxt.prospects}
              icon="⭐"
              list={assets.prospects}
              sel={pro}
              setSel={setPro}
              onToggle={onTogglePick}
              searchQuery={search}
              lang={lang}
            />
          </div>
        )}

        {/* CASH SECTION */}
        <div className="p-2.5 rounded-xl border border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">{tTxt.cash} ($)</span>
          <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1">
            <span className="text-slate-500 mr-1">$</span>
            <input
              type="number"
              min={0}
              step={100000}
              value={cash}
              onChange={(e) => setCash(Number(e.target.value))}
              className="w-24 bg-transparent text-right font-mono text-xs outline-none text-slate-200"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryBox({
  name,
  logoUrl,
  items,
  accent,
  lang,
  onRemoveItem,
}: {
  name: string;
  logoUrl?: string | null;
  items: { key: string; label: string; onRemove: () => void }[];
  accent: string;
  lang: Lang;
  onRemoveItem?: (key: string) => void;
}) {
  const tTxt = getDict(lang);

  return (
    <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-3 space-y-2">
      <div className={`flex items-center justify-between text-[11px] font-bold uppercase tracking-wide ${accent}`}>
        <div className="flex items-center gap-1.5 truncate">
          {logoUrl && <img src={logoUrl} alt="" className="w-4 h-4 object-contain shrink-0" />}
          <span className="truncate">{name} {tTxt.sends}</span>
        </div>
        <span className="text-[10px] font-mono text-slate-500 font-normal">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="text-slate-500 text-xs italic py-1">{tTxt.nothingSelected}</div>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
          {items.map((it, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs bg-slate-900 border border-slate-700/80 text-slate-200 shadow-sm"
            >
              <span className="truncate max-w-[200px]">{it.label}</span>
              <button
                type="button"
                onClick={it.onRemove}
                className="text-slate-400 hover:text-rose-400 font-bold transition-colors"
                title="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export type TradeBuilderInitial = {
  mineP?: Record<number, number>;
  theirsP?: Record<number, number>;
  minePk?: number[];
  theirsPk?: number[];
  minePro?: number[];
  theirsPro?: number[];
  mineCash?: number;
  theirsCash?: number;
  condition?: string;
};

export default function TradeBuilder({
  me,
  opp,
  mine,
  theirs,
  meCap,
  oppCap,
  onPropose,
  initial,
  submitLabel,
  lang = "en",
}: {
  me: Team;
  opp: Team;
  mine: Assets;
  theirs: Assets;
  meCap: CapSnapshot;
  oppCap: CapSnapshot;
  onPropose: (pkg: TradePackage) => Promise<{ tradeId: number }>;
  initial?: TradeBuilderInitial;
  submitLabel?: string;
  lang?: Lang;
}) {
  const tTxt = getDict(lang);

  const [mineP, setMineP] = useState<Record<number, number>>(initial?.mineP ?? {});
  const [theirsP, setTheirsP] = useState<Record<number, number>>(initial?.theirsP ?? {});
  const [minePk, setMinePk] = useState<Set<number>>(new Set(initial?.minePk ?? []));
  const [theirsPk, setTheirsPk] = useState<Set<number>>(new Set(initial?.theirsPk ?? []));
  const [minePro, setMinePro] = useState<Set<number>>(new Set(initial?.minePro ?? []));
  const [theirsPro, setTheirsPro] = useState<Set<number>>(new Set(initial?.theirsPro ?? []));
  const [mineCash, setMineCash] = useState(initial?.mineCash ?? 0);
  const [theirsCash, setTheirsCash] = useState(initial?.theirsCash ?? 0);
  const [condition] = useState(initial?.condition ?? "");

  const [conditionSpec, setConditionSpec] = useState<ConditionSpec | null>(null);
  const [conditionModal, setConditionModal] = useState<{ player: Player; ownerTeamId: number; picks: Pick[] } | null>(null);

  const [terms, setTerms] = useState<Record<number, Terms | "loading">>({});
  const [fees, setFees] = useState<Record<number, { feeAmount: number; payTeamId: number }>>({});
  const agreeFee = (id: number, tTerm: Terms) =>
    setFees((f) => {
      const n = { ...f };
      if (n[id]) delete n[id];
      else n[id] = { feeAmount: tTerm.feeAmount, payTeamId: tTerm.payTeamId };
      return n;
    });

  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const togglePlayer = (map: Record<number, number>, set: (v: Record<number, number>) => void, id: number) => {
    const next = { ...map };
    if (id in next) delete next[id];
    else next[id] = 0;
    set(next);
    setMsg(null);
  };

  const toggleClausePlayer = (
    map: Record<number, number>,
    set: (v: Record<number, number>) => void,
    p: Player,
    destTeamId: number,
    ownerTeamId: number
  ) => {
    const wasOn = p.id in map;
    togglePlayer(map, set, p.id);
    if (wasOn) {
      setFees((f) => {
        const n = { ...f };
        delete n[p.id];
        return n;
      });
      setTerms((tState) => {
        const n = { ...tState };
        delete n[p.id];
        return n;
      });
      setConditionSpec((c) => (c?.playerId === p.id ? null : c));
      return;
    }
    const needs = !!p.clause && (p.clause !== "M_NTC" || (p.noTradeTeams ?? []).includes(destTeamId));
    if (!needs) return;
    setTerms((tState) => ({ ...tState, [p.id]: "loading" }));
    clauseTermsAction(p.id, destTeamId).then((r) => {
      if (!r) {
        setTerms((tState) => {
          const n = { ...tState };
          delete n[p.id];
          return n;
        });
        return;
      }
      setTerms((tState) => ({
        ...tState,
        [p.id]: {
          feeAmount: r.feeAmount,
          feePct: r.feePct,
          fullPayout: r.fullPayout,
          reason: r.reason,
          payTeamId: ownerTeamId,
        },
      }));
      if (r.feeAmount === 0) setFees((f) => ({ ...f, [p.id]: { feeAmount: 0, payTeamId: ownerTeamId } }));
    });
  };

  const togglePick = (set: Set<number>, setter: (s: Set<number>) => void, id: number) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setter(n);
    setMsg(null);
  };

  const toggleDraftPick = (set: Set<number>, setter: (s: Set<number>) => void, id: number) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setter(n);
    setMsg(null);
    setConditionSpec((c) => (c && !n.has(id) && (c.pickAId === id || c.pickBId === id) ? null : c));
  };

  const submit = () =>
    start(async () => {
      setErr(null);
      setMsg(null);
      try {
        const r = await onPropose({
          fromTeamId: me.id,
          toTeamId: opp.id,
          fromPlayers: Object.entries(mineP).map(([id, pct]) => ({ playerId: Number(id), retentionPct: pct })),
          toPlayers: Object.entries(theirsP).map(([id, pct]) => ({ playerId: Number(id), retentionPct: pct })),
          fromPicks: [...minePk],
          toPicks: [...theirsPk],
          fromProspects: [...minePro],
          toProspects: [...theirsPro],
          fromCash: mineCash,
          toCash: theirsCash,
          condition,
          conditionSpec,
          waived: Object.keys(fees).map(Number),
          clauseFees: Object.entries(fees).map(([id, v]) => ({
            playerId: Number(id),
            feeAmount: v.feeAmount,
            payTeamId: v.payTeamId,
          })),
        });
        setMsg(`Trade proposed to ${opp.name} (#${r.tradeId}). Awaiting their GM's response.`);
        setMineP({});
        setTheirsP({});
        setMinePk(new Set());
        setTheirsPk(new Set());
        setMinePro(new Set());
        setTheirsPro(new Set());
        setMineCash(0);
        setTheirsCash(0);
        setFees({});
        setTerms({});
        setConditionSpec(null);
      } catch (e) {
        setErr((e as Error).message);
      }
    });

  const count =
    Object.keys(mineP).length +
    Object.keys(theirsP).length +
    minePk.size +
    theirsPk.size +
    minePro.size +
    theirsPro.size +
    (mineCash ? 1 : 0) +
    (theirsCash ? 1 : 0);

  // GM Assist
  const [aiPending, aiStart] = useTransition();
  const [ai, setAi] = useState<Awaited<ReturnType<typeof analyzeTradeAction>> | null>(null);
  const runAnalyze = () =>
    aiStart(async () => {
      setAi(
        await analyzeTradeAction({
          fromTeamId: me.id,
          toTeamId: opp.id,
          fromPlayers: Object.entries(mineP).map(([id, pct]) => ({ playerId: Number(id), retentionPct: pct })),
          toPlayers: Object.entries(theirsP).map(([id, pct]) => ({ playerId: Number(id), retentionPct: pct })),
          fromPicks: [...minePk],
          toPicks: [...theirsPk],
          fromProspects: [...minePro],
          toProspects: [...theirsPro],
          fromCash: mineCash,
          toCash: theirsCash,
          condition,
        })
      );
    });

  // Cap calculations
  const mineSent = netTransferred(mineP, mine);
  const theirsSent = netTransferred(theirsP, theirs);
  const meCapDelta = theirsSent - mineSent;
  const oppCapDelta = mineSent - theirsSent;

  const meSpaceAfter = meCap.strictSpace - meCapDelta;
  const oppSpaceAfter = oppCap.strictSpace - oppCapDelta;
  const isCapCompliant = meSpaceAfter >= 0 && oppSpaceAfter >= 0;

  // Selected item summaries for middle column
  const nameP = (a: Assets, id: number) => {
    const p = a.players.find((pl) => pl.id === id);
    return p ? displayName(p.name) : `#${id}`;
  };
  const labelPk = (a: Assets, id: number) => a.picks.find((p) => p.id === id)?.label ?? `Pick #${id}`;
  const labelPro = (a: Assets, id: number) => a.prospects.find((p) => p.id === id)?.label ?? `Prospect #${id}`;

  const mineItems = useMemo(() => {
    const items: { key: string; label: string; onRemove: () => void }[] = [];
    for (const [id, pct] of Object.entries(mineP)) {
      items.push({
        key: `p-${id}`,
        label: `🏒 ${nameP(mine, +id)}${pct ? ` (${pct}% ret)` : ""}`,
        onRemove: () => togglePlayer(mineP, setMineP, +id),
      });
    }
    for (const id of minePk) {
      items.push({
        key: `pk-${id}`,
        label: `🎫 ${labelPk(mine, id)}`,
        onRemove: () => toggleDraftPick(minePk, setMinePk, id),
      });
    }
    for (const id of minePro) {
      items.push({
        key: `pro-${id}`,
        label: `⭐ ${labelPro(mine, id)}`,
        onRemove: () => togglePick(minePro, setMinePro, id),
      });
    }
    if (mineCash > 0) {
      items.push({
        key: "cash",
        label: `💵 ${money(mineCash)}`,
        onRemove: () => setMineCash(0),
      });
    }
    return items;
  }, [mine, mineP, minePk, minePro, mineCash]);

  const theirsItems = useMemo(() => {
    const items: { key: string; label: string; onRemove: () => void }[] = [];
    for (const [id, pct] of Object.entries(theirsP)) {
      items.push({
        key: `p-${id}`,
        label: `🏒 ${nameP(theirs, +id)}${pct ? ` (${pct}% ret)` : ""}`,
        onRemove: () => togglePlayer(theirsP, setTheirsP, +id),
      });
    }
    for (const id of theirsPk) {
      items.push({
        key: `pk-${id}`,
        label: `🎫 ${labelPk(theirs, id)}`,
        onRemove: () => toggleDraftPick(theirsPk, setTheirsPk, id),
      });
    }
    for (const id of theirsPro) {
      items.push({
        key: `pro-${id}`,
        label: `⭐ ${labelPro(theirs, id)}`,
        onRemove: () => togglePick(theirsPro, setTheirsPro, id),
      });
    }
    if (theirsCash > 0) {
      items.push({
        key: "cash",
        label: `💵 ${money(theirsCash)}`,
        onRemove: () => setTheirsCash(0),
      });
    }
    return items;
  }, [theirs, theirsP, theirsPk, theirsPro, theirsCash]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-12 space-y-6">
      {/* TOP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/trades"
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
          >
            {tTxt.backToTrades}
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>🏒</span> {tTxt.tradeRoom}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/trades/build"
            className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white transition-colors"
          >
            {tTxt.changeOpponent}
          </Link>
        </div>
      </div>

      {/* 3-COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: ME (MY TEAM) */}
        <div className="lg:col-span-4">
          <Side
            team={me}
            assets={mine}
            pmap={mineP}
            setPmap={setMineP}
            pk={minePk}
            setPk={setMinePk}
            pro={minePro}
            setPro={setMinePro}
            cash={mineCash}
            setCash={setMineCash}
            destTeamId={opp.id}
            terms={terms}
            fees={fees}
            onToggleClause={toggleClausePlayer}
            onAgreeFee={agreeFee}
            onTogglePick={togglePick}
            onTogglePickAsset={toggleDraftPick}
            capStatus={meCap}
            capDelta={meCapDelta}
            incomingAssets={theirs}
            incomingPmap={theirsP}
            conditionSpec={conditionSpec}
            onOpenCondition={(p, ownerTeamId, picks) => setConditionModal({ player: p, ownerTeamId, picks })}
            onRemoveCondition={() => setConditionSpec(null)}
            lang={lang}
            accentColor="from-blue-500 via-indigo-500 to-cyan-500"
          />
        </div>

        {/* MIDDLE COLUMN: TRADE EXCHANGE HUB */}
        <div className="lg:col-span-4 lg:sticky lg:top-4 space-y-4">
          <div className="bg-slate-900/90 border border-slate-750 rounded-2xl p-4 space-y-4 shadow-2xl relative overflow-hidden backdrop-blur-md">
            {/* Header & Cap Compliance status */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isCapCompliant ? "bg-emerald-400" : "bg-rose-400 animate-pulse"}`} />
                <h4 className="text-xs font-black uppercase tracking-wider text-white">{tTxt.tradeSummary}</h4>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  isCapCompliant
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                }`}
              >
                {isCapCompliant ? tTxt.capCompliance : tTxt.capWarning}
              </span>
            </div>

            {/* Live Cap Impact breakdown */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>{tTxt.capFlowCalc}</span>
                {meCapDelta !== 0 && (
                  <span className={`font-mono text-[11px] font-bold ${meCapDelta > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {meCapDelta > 0 ? `+${money(meCapDelta)} into ${me.name}` : `−${money(Math.abs(meCapDelta))} cap off`}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2 text-center">
                  <div className="text-[10px] text-slate-400 font-medium truncate">{me.name} {tTxt.getsCap}</div>
                  <div className="font-mono font-bold text-slate-200 text-sm mt-0.5">{money(theirsSent)}</div>
                  <div className="text-[9px] text-slate-500">{tTxt.sendsCap}: {money(mineSent)}</div>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2 text-center">
                  <div className="text-[10px] text-slate-400 font-medium truncate">{opp.name} {tTxt.getsCap}</div>
                  <div className="font-mono font-bold text-slate-200 text-sm mt-0.5">{money(mineSent)}</div>
                  <div className="text-[9px] text-slate-500">{tTxt.sendsCap}: {money(theirsSent)}</div>
                </div>
              </div>
            </div>

            {/* Selected Assets Summaries */}
            <div className="space-y-2.5">
              <SummaryBox
                name={me.name}
                logoUrl={me.logoUrl}
                items={mineItems}
                accent="text-blue-400"
                lang={lang}
              />

              <div className="flex items-center justify-center">
                <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-xs shadow-md">
                  ⇅
                </div>
              </div>

              <SummaryBox
                name={opp.name}
                logoUrl={opp.logoUrl}
                items={theirsItems}
                accent="text-amber-400"
                lang={lang}
              />
            </div>

            {/* CTA Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={submit}
                disabled={pending || count === 0 || !isCapCompliant}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-40 text-white font-black text-sm tracking-wide shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-2 transition-all transform active:scale-[0.99]"
              >
                <span>{pending ? tTxt.sending : (submitLabel ?? tTxt.proposeTrade)}</span>
                {count > 0 && (
                  <span className="px-2 py-0.2 rounded-full bg-white/20 text-xs font-mono font-bold">
                    {count}
                  </span>
                )}
              </button>

              <button
                onClick={runAnalyze}
                disabled={aiPending || count === 0}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-900/80 via-indigo-900/80 to-purple-950/80 hover:from-purple-800 hover:to-indigo-800 border border-purple-600/40 text-purple-200 font-bold text-xs tracking-wide shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                title={tTxt.gmAssistHint}
              >
                <span>🤖</span>
                <span>{aiPending ? tTxt.analyzing : tTxt.gmAssist}</span>
              </button>
            </div>

            {/* Alert messages */}
            {msg && (
              <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs font-medium">
                {msg}
              </div>
            )}
            {err && (
              <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs font-medium">
                {err}
              </div>
            )}

            {/* GM Assist Modal */}
            <GMAssistModal data={ai} onClose={() => setAi(null)} />
          </div>

          {/* Quick Rules Box */}
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-3.5 text-xs text-slate-400 space-y-1">
            <div className="font-bold text-slate-300 flex items-center gap-1.5">
              <span>💡</span> <span>{tTxt.rulesTitle}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">{tTxt.rulesBody}</p>
          </div>
        </div>

        {/* RIGHT COLUMN: OPPONENT TEAM */}
        <div className="lg:col-span-4">
          <Side
            team={opp}
            assets={theirs}
            pmap={theirsP}
            setPmap={setTheirsP}
            pk={theirsPk}
            setPk={setTheirsPk}
            pro={theirsPro}
            setPro={setTheirsPro}
            cash={theirsCash}
            setCash={setTheirsCash}
            destTeamId={me.id}
            terms={terms}
            fees={fees}
            onToggleClause={toggleClausePlayer}
            onAgreeFee={agreeFee}
            onTogglePick={togglePick}
            onTogglePickAsset={toggleDraftPick}
            capStatus={oppCap}
            capDelta={oppCapDelta}
            incomingAssets={mine}
            incomingPmap={mineP}
            conditionSpec={conditionSpec}
            onOpenCondition={(p, ownerTeamId, picks) => setConditionModal({ player: p, ownerTeamId, picks })}
            onRemoveCondition={() => setConditionSpec(null)}
            lang={lang}
            accentColor="from-amber-500 via-orange-500 to-rose-500"
          />
        </div>
      </div>

      {/* CONDITION MODAL */}
      {conditionModal && (
        <ConditionModal
          player={conditionModal.player}
          ownerTeamId={conditionModal.ownerTeamId}
          picks={conditionModal.picks}
          lang={lang}
          initial={conditionSpec?.playerId === conditionModal.player.id ? conditionSpec : null}
          onSave={(spec) => {
            const isMe = conditionModal.ownerTeamId === me.id;
            const pkSet = isMe ? minePk : theirsPk;
            const setPkSetter = isMe ? setMinePk : setTheirsPk;
            if (!pkSet.has(spec.pickBId)) {
              const n = new Set(pkSet);
              n.add(spec.pickBId);
              setPkSetter(n);
            }
            setConditionSpec(spec);
            setConditionModal(null);
          }}
          onRemove={
            conditionSpec?.playerId === conditionModal.player.id
              ? () => {
                  setConditionSpec(null);
                  setConditionModal(null);
                }
              : undefined
          }
          onClose={() => setConditionModal(null)}
        />
      )}
    </div>
  );
}
