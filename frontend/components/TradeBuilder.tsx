"use client";

import { useState, useTransition } from "react";
import PlayerLink from "@/components/PlayerLink";
import Link from "next/link";
import { money } from "@/lib/finance";
import { displayName } from "@/lib/playerName";
import { clauseTermsAction, analyzeTradeAction, type TradePackage } from "@/app/trades/build/actions";
import ConditionModal from "@/components/ConditionModal";
import { describeConditionSpec, type ConditionSpec } from "@/lib/trade-conditions-shared";
import { t, type Lang } from "@/lib/i18n";

type Player = { id: number; name: string; position: string; capHit: number; farm: boolean; clause?: string | null; noTradeTeams?: number[]; retainedAmount?: number; tradeFreezeDaysLeft?: number };
type Pick = { id: number; round?: number; label: string; logoUrl?: string | null; locked?: boolean };
type Assets = { players: Player[]; picks: Pick[]; prospects: Pick[] };
type Team = { id: number; name: string; logoUrl?: string | null };
type Terms = { feeAmount: number; feePct: number; fullPayout: boolean; reason: string; payTeamId: number };
// Only the fields the cap-impact widget needs, from lib/cap.ts's CapStatus.
type CapSnapshot = {
  committed: number; ceiling: number; strictSpace: number; floor: number;
  retentionSlotsOutUsed: number; retentionSlotsInUsed: number; retentionSlotsMax: number;
  retentionPctUsed: number; retentionPctMax: number; retentionMaxPct: number; capUpper: number;
};

// A moved player's own Cap Hit never changes — what changes hands is his cap
// hit net of whatever retention the SENDING side sets in this trade (the
// slider), since the sender keeps that retained slice as dead cap on their own
// books forever rather than the acquiring side ever carrying it. Mirrors the
// server-side math in lib/trade-exec.ts's movePlayers (netBefore/newSlice/netCap).
function netTransferred(map: Record<number, number>, assets: Assets): number {
  return Object.entries(map).reduce((sum, [id, pct]) => {
    const p = assets.players.find((pl) => pl.id === Number(id));
    if (!p || p.farm) return sum; // AHL players don't count against the NHL cap
    return sum + p.capHit * (1 - pct / 100);
  }, 0);
}

/** New retention this trade would add on the SENDING side (the side whose own
 *  `map` this is — they keep paying the retained slice, same convention as
 *  lib/trade-exec.ts's retentionRecords: teamId = the sending club). */
function retentionAdded(map: Record<number, number>, assets: Assets, capUpper: number): { slots: number; pct: number } {
  let slots = 0, dollars = 0;
  for (const [id, pct] of Object.entries(map)) {
    if (pct <= 0) continue;
    const p = assets.players.find((pl) => pl.id === Number(id));
    if (!p || p.farm) continue;
    slots++;
    dollars += p.capHit * pct / 100;
  }
  return { slots, pct: capUpper > 0 ? (dollars / capUpper) * 100 : 0 };
}

/** New retained-salary players this trade would land on the RECEIVING side
 *  (this Side's own team), with their combined dollar amount — a player
 *  counts whether he already carried retention from an earlier trade
 *  (retainedAmount) or is gaining fresh retention right here from the OTHER
 *  side's map (added on top of whatever he already carried, same additive
 *  rule as lib/trade-exec.ts). AHL destinations don't touch the NHL count. */
function retainedInAdded(incomingMap: Record<number, number>, incomingAssets: Assets): { count: number; dollars: number } {
  let count = 0, dollars = 0;
  for (const [id, pct] of Object.entries(incomingMap)) {
    const p = incomingAssets.players.find((pl) => pl.id === Number(id));
    if (!p || p.farm) continue;
    const total = (p.retainedAmount ?? 0) + (pct > 0 ? p.capHit * pct / 100 : 0);
    if (total > 0) { count++; dollars += total; }
  }
  return { count, dollars };
}

/** Already-retained-salary players THIS side is selected to send away in the
 *  trade being drafted. `status.retentionSlotsInUsed` is a static roster
 *  snapshot taken before this trade existed, so a retained player leaving
 *  here must be backed out of it — otherwise he still counts against this
 *  club's own IN baseline even though the trade removes him from the roster,
 *  on top of whatever OUT slot this trade newly adds for him. */
function retainedInLeaving(pmap: Record<number, number>, assets: Assets): { count: number; dollars: number } {
  let count = 0, dollars = 0;
  for (const id of Object.keys(pmap)) {
    const p = assets.players.find((pl) => pl.id === Number(id));
    if (!p || p.farm || !(p.retainedAmount ?? 0)) continue;
    count++; dollars += p.retainedAmount ?? 0;
  }
  return { count, dollars };
}

function CapImpact({ status, delta }: { status: CapSnapshot; delta: number }) {
  const spaceNow = status.strictSpace;
  const spaceAfter = spaceNow - delta;
  const color = (v: number) => (v < 0 ? "text-red-400" : "text-emerald-400");
  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-lg px-3 py-2 text-xs space-y-1" title="Cap space against the actual league ceiling (uncushioned) — same figure Cap Central calls Actual Cap Space">
      <div className="flex items-center justify-between">
        <span className="text-slate-500">Cap space now</span>
        <span className={`tabular-nums font-medium ${color(spaceNow)}`}>{money(spaceNow)}</span>
      </div>
      {delta !== 0 && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">After this trade</span>
            <span className={`tabular-nums font-bold ${color(spaceAfter)}`}>{money(spaceAfter)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Difference</span>
            <span className={`tabular-nums ${delta > 0 ? "text-red-400" : "text-emerald-400"}`}>{delta > 0 ? "−" : "+"}{money(Math.abs(delta))}</span>
          </div>
        </>
      )}
    </div>
  );
}

// This club's retention CAPACITY: "slots" is ONE combined pool — contracts
// it's retaining on (OUT) plus retained-salary players it rosters (IN) —
// against a single max, and the dollar amount of both together is checked
// against a single % of the cap. Both are enforced server-side in
// lib/trade-exec.ts, so this is a live preview of the same check.
function RetentionCapacity({ status, newOutSlots, newOutPct, newIn, leavingIn }: { status: CapSnapshot; newOutSlots: number; newOutPct: number; newIn: { count: number; dollars: number }; leavingIn: { count: number; dollars: number } }) {
  const outAfter = status.retentionSlotsOutUsed + newOutSlots;
  const inAfter = status.retentionSlotsInUsed - leavingIn.count + newIn.count;
  const slotsAfter = outAfter + inAfter;
  const newInPct = status.capUpper > 0 ? (newIn.dollars / status.capUpper) * 100 : 0;
  const leavingInPct = status.capUpper > 0 ? (leavingIn.dollars / status.capUpper) * 100 : 0;
  const pctAfter = status.retentionPctUsed - leavingInPct + newOutPct + newInPct;
  const over = slotsAfter > status.retentionSlotsMax || pctAfter > status.retentionPctMax;
  return (
    <div className={`bg-slate-900/40 border rounded-lg px-3 py-2 text-xs space-y-1 ${over ? "border-amber-700/60" : "border-slate-800"}`} title="Retention capacity vs. the league's configured limits — one combined pool of slots (retained-on + rostered-retained) and one combined % of the cap. Existing (out/in) reflects retentions this club already carries from PAST trades, unrelated to what's selected here.">
      <div className="flex items-center justify-between">
        <span className="text-slate-500">Retention slots</span>
        <span className={`tabular-nums font-medium ${slotsAfter > status.retentionSlotsMax ? "text-amber-400" : "text-slate-200"}`}>
          {slotsAfter}/{status.retentionSlotsMax} <span className="text-slate-500 font-normal">({outAfter} out, {inAfter} in)</span>
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-slate-500">Retention % of cap</span>
        <span className={`tabular-nums font-medium ${pctAfter > status.retentionPctMax ? "text-amber-400" : "text-slate-200"}`}>{pctAfter.toFixed(1)}% / {status.retentionPctMax}%</span>
      </div>
      {over && <p className="text-amber-400">⚠ This would exceed the league&apos;s configured retention limit.</p>}
    </div>
  );
}

const setRet = (map: Record<number, number>, set: (v: Record<number, number>) => void, id: number, pct: number, maxPct: number) =>
  set({ ...map, [id]: Math.max(0, Math.min(maxPct, pct)) });

// Every sub-component below is defined at MODULE scope, not inside TradeBuilder's
// body — a component whose own function identity is recreated on every parent
// render (the common "const Foo = () => (...)" pattern written right inside a
// render function) gets treated by React as a brand-new component type each
// time, so it unmounts and remounts its whole subtree on every single state
// update instead of just diffing it. That's what made every tap of the
// retention +/- stepper reset mobile Safari's scroll to the top of the page —
// the row (and everything below it) was being torn down and rebuilt from
// scratch. Callback props changing identity each render is completely normal
// and doesn't cause this; only the component reference itself needs to be stable.

function PlayerTable({ title, list, pmap, setPmap, destTeamId, ownerTeamId, terms, fees, onToggleClause, onAgreeFee, maxRetentionPct, conditionSpec, onOpenCondition, onRemoveCondition, lang }: {
  title: string; list: Player[]; pmap: Record<number, number>; setPmap: (v: Record<number, number>) => void; destTeamId: number; ownerTeamId: number;
  terms: Record<number, Terms | "loading">; fees: Record<number, { feeAmount: number; payTeamId: number }>;
  onToggleClause: (map: Record<number, number>, set: (v: Record<number, number>) => void, p: Player, destTeamId: number, ownerTeamId: number) => void;
  onAgreeFee: (id: number, t: Terms) => void;
  maxRetentionPct: number;
  conditionSpec: ConditionSpec | null;
  onOpenCondition: (p: Player) => void;
  onRemoveCondition: () => void;
  lang: Lang;
}) {
  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-slate-800/40 text-xs font-bold uppercase tracking-wide text-slate-400">{title} ({list.length})</div>
      <div className="max-h-[38vh] overflow-y-auto divide-y divide-slate-800/60">
        {list.length === 0 && <div className="px-3 py-3 text-slate-600 text-sm">none</div>}
        {list.map((p) => {
          const on = p.id in pmap;
          const frozen = (p.tradeFreezeDaysLeft ?? 0) > 0;
          const needsWaiver = !!p.clause && (p.clause !== "M_NTC" || (p.noTradeTeams ?? []).includes(destTeamId));
          return (
            <div key={p.id} className={`px-3 py-2 ${on ? "bg-blue-950/30" : ""}`}>
              <label className={`flex items-center gap-2.5 ${frozen ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                title={frozen ? `A retention on his contract freezes him from any trade for ${p.tradeFreezeDaysLeft} more in-season day(s).` : undefined}>
                <input type="checkbox" checked={on} disabled={frozen} onChange={() => !frozen && onToggleClause(pmap, setPmap, p, destTeamId, ownerTeamId)} className="accent-blue-500 w-4 h-4" />
                <span className="flex-1 truncate"><PlayerLink id={p.id} name={displayName(p.name)} /> <span className="text-slate-500 text-xs">{p.position}{p.farm ? " · AHL" : ""}</span></span>
                <span className="text-slate-400 tabular-nums text-sm">{money(p.capHit)}</span>
              </label>
              {frozen && <p className="mt-1 ml-6.5 text-xs text-amber-400">🔒 Retention freeze — {p.tradeFreezeDaysLeft} more in-season day(s) before he can be traded.</p>}
              {on && needsWaiver && (() => {
                const t = terms[p.id];
                if (!t || t === "loading") return <p className="mt-2 ml-6.5 text-xs text-slate-500">⚖ Checking with his agent…</p>;
                const agreed = p.id in fees;
                return (
                  <div className="mt-2 ml-6.5 text-xs">
                    <p className={t.feeAmount === 0 ? "text-emerald-400" : "text-amber-300"}>⚖ {t.reason}</p>
                    {t.feeAmount > 0 && (
                      <label className="flex items-center gap-2 mt-1 cursor-pointer">
                        <input type="checkbox" checked={agreed} onChange={() => onAgreeFee(p.id, t)} className="accent-amber-500 w-3.5 h-3.5" />
                        <span className={agreed ? "text-amber-300" : "text-rose-400"}>
                          {agreed ? `Paying ${money(t.feeAmount)} to waive` : `${t.fullPayout ? "Full payout" : "Fee"} ${money(t.feeAmount)} (${t.feePct}%) — agree to pay`}
                        </span>
                      </label>
                    )}
                  </div>
                );
              })()}
              {on && p.capHit > 0 && (
                <div className="flex items-center gap-3 mt-2.5 ml-6.5 text-xs text-slate-400 flex-wrap">
                  <span className="font-medium">Salary Retention</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setRet(pmap, setPmap, p.id, (pmap[p.id] || 0) - 5, maxRetentionPct)}
                      className="w-7 h-8 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-base leading-none">−</button>
                    <div className="flex items-center bg-slate-900 border border-slate-700 rounded">
                      <input type="number" min={0} max={maxRetentionPct} step={5} value={pmap[p.id]}
                        onChange={(e) => setRet(pmap, setPmap, p.id, Number(e.target.value), maxRetentionPct)}
                        className="w-16 bg-transparent px-2.5 py-1.5 text-right text-sm tabular-nums outline-none" />
                      <span className="pr-2.5 text-slate-500">%</span>
                    </div>
                    <button type="button" onClick={() => setRet(pmap, setPmap, p.id, (pmap[p.id] || 0) + 5, maxRetentionPct)}
                      className="w-7 h-8 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-base leading-none">+</button>
                  </div>
                  {pmap[p.id] > 0 && <span className="text-amber-400">retains {money(p.capHit * pmap[p.id] / 100)}</span>}
                </div>
              )}
              {on && (
                <div className="mt-2 ml-6.5 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-400">
                    <input type="checkbox" checked={conditionSpec?.playerId === p.id} onChange={() => conditionSpec?.playerId === p.id ? onRemoveCondition() : onOpenCondition(p)} className="accent-amber-500 w-3.5 h-3.5" />
                    <span className="font-medium">{t(lang, "cond.conLabel")}</span>
                    <span className="text-slate-600">— {t(lang, "cond.conHint")}</span>
                  </label>
                  {conditionSpec?.playerId === p.id && (
                    <p className="mt-1.5 ml-5.5 text-amber-300/90 bg-amber-950/20 border border-amber-800/30 rounded px-2 py-1.5">
                      📋 {describeConditionSpec(conditionSpec, lang)}{" "}
                      <button type="button" onClick={() => onOpenCondition(p)} className="underline hover:text-amber-200">{t(lang, "cond.edit")}</button>
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CheckTable({ title, icon, list, sel, setSel, onToggle }: {
  title: string; icon: string; list: Pick[]; sel: Set<number>; setSel: (s: Set<number>) => void;
  onToggle: (sel: Set<number>, setSel: (s: Set<number>) => void, id: number) => void;
}) {
  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-slate-800/40 text-xs font-bold uppercase tracking-wide text-slate-400">{title} ({list.length})</div>
      <div className="max-h-[28vh] overflow-y-auto divide-y divide-slate-800/60">
        {list.length === 0 && <div className="px-3 py-3 text-slate-600 text-sm">none</div>}
        {list.map((it) => (
          <label key={it.id} className={`flex items-center gap-2.5 px-3 py-2 text-sm ${it.locked ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${sel.has(it.id) ? "bg-blue-950/30" : ""}`}
            title={it.locked ? "Locked by a pending conditional trade — can't be moved until it resolves" : undefined}>
            <input type="checkbox" checked={sel.has(it.id)} disabled={it.locked} onChange={() => !it.locked && onToggle(sel, setSel, it.id)} className="accent-blue-500 w-4 h-4" />
            {it.logoUrl && <img src={it.logoUrl} alt="" className="w-4 h-4 object-contain shrink-0" />}
            <span className="text-slate-300">{icon} {it.label}</span>
            {it.locked && <span className="text-amber-400 text-xs">🔒</span>}
          </label>
        ))}
      </div>
    </div>
  );
}

function Side({ team, assets, pmap, setPmap, pk, setPk, pro, setPro, cash, setCash, destTeamId, terms, fees, onToggleClause, onAgreeFee, onTogglePick, onTogglePickAsset, capStatus, capDelta, incomingAssets, incomingPmap, conditionSpec, onOpenCondition, onRemoveCondition, lang }: {
  team: Team; assets: Assets; pmap: Record<number, number>; setPmap: (v: Record<number, number>) => void;
  pk: Set<number>; setPk: (s: Set<number>) => void; pro: Set<number>; setPro: (s: Set<number>) => void;
  cash: number; setCash: (n: number) => void; destTeamId: number;
  terms: Record<number, Terms | "loading">; fees: Record<number, { feeAmount: number; payTeamId: number }>;
  onToggleClause: (map: Record<number, number>, set: (v: Record<number, number>) => void, p: Player, destTeamId: number, ownerTeamId: number) => void;
  onAgreeFee: (id: number, t: Terms) => void;
  onTogglePick: (sel: Set<number>, setSel: (s: Set<number>) => void, id: number) => void;
  onTogglePickAsset: (sel: Set<number>, setSel: (s: Set<number>) => void, id: number) => void;
  capStatus: CapSnapshot; capDelta: number;
  // The OTHER side's assets/retention map — what THIS team would be acquiring,
  // needed to know how many newly-retained players would land on its roster.
  incomingAssets: Assets; incomingPmap: Record<number, number>;
  conditionSpec: ConditionSpec | null;
  onOpenCondition: (p: Player, ownerTeamId: number, picks: Pick[]) => void;
  onRemoveCondition: () => void;
  lang: Lang;
}) {
  const added = retentionAdded(pmap, assets, capStatus.capUpper);
  const addedIn = retainedInAdded(incomingPmap, incomingAssets);
  const leavingIn = retainedInLeaving(pmap, assets);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-2 font-bold">
        {team.logoUrl && <img src={team.logoUrl} alt="" className="w-6 h-6 object-contain shrink-0" />}
        {team.name} sends
      </div>
      <CapImpact status={capStatus} delta={capDelta} />
      <RetentionCapacity status={capStatus} newOutSlots={added.slots} newOutPct={added.pct} newIn={addedIn} leavingIn={leavingIn} />
      <PlayerTable title="Players" list={assets.players} pmap={pmap} setPmap={setPmap} destTeamId={destTeamId} ownerTeamId={team.id} terms={terms} fees={fees} onToggleClause={onToggleClause} onAgreeFee={onAgreeFee} maxRetentionPct={capStatus.retentionMaxPct}
        conditionSpec={conditionSpec && assets.players.some((pl) => pl.id === conditionSpec.playerId) ? conditionSpec : null}
        onOpenCondition={(p) => onOpenCondition(p, destTeamId, incomingAssets.picks)}
        onRemoveCondition={onRemoveCondition}
        lang={lang} />
      <CheckTable title="Prospects" icon="⭐" list={assets.prospects} sel={pro} setSel={setPro} onToggle={onTogglePick} />
      <CheckTable title="Draft picks" icon="🎫" list={assets.picks} sel={pk} setSel={setPk} onToggle={onTogglePickAsset} />
      <div className="bg-slate-900/40 border border-slate-800 rounded-lg px-3 py-2.5 flex items-center gap-2 text-sm">
        <span className="text-slate-400">Cash</span>
        <div className="flex items-center bg-slate-900 border border-slate-700 rounded">
          <input type="number" min={0} step={100000} value={cash} onChange={(e) => setCash(Number(e.target.value))}
            className="w-36 bg-transparent px-2 py-1 text-right tabular-nums outline-none" />
          <span className="pr-2.5 text-slate-500">$</span>
        </div>
      </div>
    </div>
  );
}

function SummaryBox({ name, logoUrl, items, accent }: { name: string; logoUrl?: string | null; items: string[]; accent: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-2.5">
      <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide mb-1.5 ${accent}`}>
        {logoUrl && <img src={logoUrl} alt="" className="w-4 h-4 object-contain shrink-0" />}
        {name} sends
      </div>
      {items.length === 0
        ? <div className="text-slate-600 text-xs italic">nothing selected yet</div>
        : <ul className="space-y-1 text-sm text-slate-200">{items.map((t, i) => <li key={i} className="truncate">{t}</li>)}</ul>}
    </div>
  );
}

export type TradeBuilderInitial = {
  mineP?: Record<number, number>; theirsP?: Record<number, number>;
  minePk?: number[]; theirsPk?: number[]; minePro?: number[]; theirsPro?: number[];
  mineCash?: number; theirsCash?: number; condition?: string;
};

export default function TradeBuilder({ me, opp, mine, theirs, meCap, oppCap, onPropose, initial, submitLabel, lang = "en" }: {
  me: Team; opp: Team; mine: Assets; theirs: Assets; meCap: CapSnapshot; oppCap: CapSnapshot;
  onPropose: (pkg: TradePackage) => Promise<{ tradeId: number }>;
  initial?: TradeBuilderInitial; submitLabel?: string; lang?: Lang;
}) {
  const [mineP, setMineP] = useState<Record<number, number>>(initial?.mineP ?? {});   // playerId -> retention%
  const [theirsP, setTheirsP] = useState<Record<number, number>>(initial?.theirsP ?? {});
  const [minePk, setMinePk] = useState<Set<number>>(new Set(initial?.minePk ?? []));
  const [theirsPk, setTheirsPk] = useState<Set<number>>(new Set(initial?.theirsPk ?? []));
  const [minePro, setMinePro] = useState<Set<number>>(new Set(initial?.minePro ?? []));
  const [theirsPro, setTheirsPro] = useState<Set<number>>(new Set(initial?.theirsPro ?? []));
  const [mineCash, setMineCash] = useState(initial?.mineCash ?? 0);
  const [theirsCash, setTheirsCash] = useState(initial?.theirsCash ?? 0);
  // Free-text condition is legacy — no longer editable from the builder (the
  // structured CON flow replaces it), but a MODIFY resubmit still carries
  // whatever a trade already had so it isn't silently dropped.
  const [condition] = useState(initial?.condition ?? "");
  // one structured conditional-pick clause per trade — the player it's under,
  // and the modal state while it's open (null = closed)
  const [conditionSpec, setConditionSpec] = useState<ConditionSpec | null>(null);
  const [conditionModal, setConditionModal] = useState<{ player: Player; ownerTeamId: number; picks: Pick[] } | null>(null);
  // clause agent: fetched terms per protected player + the fees the GM agrees to pay
  const [terms, setTerms] = useState<Record<number, Terms | "loading">>({});
  const [fees, setFees] = useState<Record<number, { feeAmount: number; payTeamId: number }>>({});
  const agreeFee = (id: number, t: Terms) => setFees((f) => { const n = { ...f }; if (n[id]) delete n[id]; else n[id] = { feeAmount: t.feeAmount, payTeamId: t.payTeamId }; return n; });
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const togglePlayer = (map: Record<number, number>, set: (v: Record<number, number>) => void, id: number) => {
    const next = { ...map };
    if (id in next) delete next[id]; else next[id] = 0;
    set(next); setMsg(null);
  };
  // toggle a player and, for a protected one being ADDED, ask the clause agent for
  // his waiver terms (destTeamId = where he'd go; ownerTeamId = who pays the fee).
  const toggleClausePlayer = (map: Record<number, number>, set: (v: Record<number, number>) => void, p: Player, destTeamId: number, ownerTeamId: number) => {
    const wasOn = p.id in map;
    togglePlayer(map, set, p.id);
    if (wasOn) {
      setFees((f) => { const n = { ...f }; delete n[p.id]; return n; }); setTerms((t) => { const n = { ...t }; delete n[p.id]; return n; });
      // a conditional pick attached to this player no longer makes sense once he's out of the trade
      setConditionSpec((c) => (c?.playerId === p.id ? null : c));
      return;
    }
    const needs = !!p.clause && (p.clause !== "M_NTC" || (p.noTradeTeams ?? []).includes(destTeamId));
    if (!needs) return;
    setTerms((t) => ({ ...t, [p.id]: "loading" }));
    clauseTermsAction(p.id, destTeamId).then((r) => {
      if (!r) { setTerms((t) => { const n = { ...t }; delete n[p.id]; return n; }); return; }
      setTerms((t) => ({ ...t, [p.id]: { feeAmount: r.feeAmount, feePct: r.feePct, fullPayout: r.fullPayout, reason: r.reason, payTeamId: ownerTeamId } }));
      if (r.feeAmount === 0) setFees((f) => ({ ...f, [p.id]: { feeAmount: 0, payTeamId: ownerTeamId } }));
    });
  };
  const togglePick = (set: Set<number>, setter: (s: Set<number>) => void, id: number) => {
    const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); setter(n); setMsg(null);
  };
  // same as togglePick, but for the Draft Picks table specifically — unchecking a
  // pick that's part of the active conditional clause invalidates it (prospects
  // share togglePick too, and a prospect id can collide with a pick id from a
  // different table, so this check only applies where it's actually a pick).
  const toggleDraftPick = (set: Set<number>, setter: (s: Set<number>) => void, id: number) => {
    const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); setter(n); setMsg(null);
    setConditionSpec((c) => (c && !n.has(id) && (c.pickAId === id || c.pickBId === id) ? null : c));
  };

  const submit = () => start(async () => {
    setErr(null); setMsg(null);
    try {
      const r = await onPropose({
        fromTeamId: me.id, toTeamId: opp.id,
        fromPlayers: Object.entries(mineP).map(([id, pct]) => ({ playerId: Number(id), retentionPct: pct })),
        toPlayers: Object.entries(theirsP).map(([id, pct]) => ({ playerId: Number(id), retentionPct: pct })),
        fromPicks: [...minePk], toPicks: [...theirsPk],
        fromProspects: [...minePro], toProspects: [...theirsPro],
        fromCash: mineCash, toCash: theirsCash, condition, conditionSpec,
        waived: Object.keys(fees).map(Number),
        clauseFees: Object.entries(fees).map(([id, v]) => ({ playerId: Number(id), feeAmount: v.feeAmount, payTeamId: v.payTeamId })),
      });
      setMsg(`Trade proposed to ${opp.name} (#${r.tradeId}). Awaiting their GM's response.`);
      setMineP({}); setTheirsP({}); setMinePk(new Set()); setTheirsPk(new Set()); setMinePro(new Set()); setTheirsPro(new Set()); setMineCash(0); setTheirsCash(0); setFees({}); setTerms({}); setConditionSpec(null);
    } catch (e) { setErr((e as Error).message); }
  });

  const count = Object.keys(mineP).length + Object.keys(theirsP).length + minePk.size + theirsPk.size + minePro.size + theirsPro.size + (mineCash ? 1 : 0) + (theirsCash ? 1 : 0);

  // GM Assist — value + fit analysis of the current package
  const [aiPending, aiStart] = useTransition();
  const [ai, setAi] = useState<Awaited<ReturnType<typeof analyzeTradeAction>> | null>(null);
  const runAnalyze = () => aiStart(async () => {
    setAi(await analyzeTradeAction({
      fromTeamId: me.id, toTeamId: opp.id,
      fromPlayers: Object.entries(mineP).map(([id, pct]) => ({ playerId: Number(id), retentionPct: pct })),
      toPlayers: Object.entries(theirsP).map(([id, pct]) => ({ playerId: Number(id), retentionPct: pct })),
      fromPicks: [...minePk], toPicks: [...theirsPk], fromProspects: [...minePro], toProspects: [...theirsPro],
      fromCash: mineCash, toCash: theirsCash, condition,
    }));
  });

  // Cap impact — the net cap hit moving each way (see netTransferred). What I
  // send away leaves my books and lands on theirs, and vice versa; picks,
  // prospects and cash never carry a cap hit.
  const mineSent = netTransferred(mineP, mine);
  const theirsSent = netTransferred(theirsP, theirs);
  const meCapDelta = theirsSent - mineSent;
  const oppCapDelta = mineSent - theirsSent;

  // live "who gives what" summary for the middle column
  const nameP = (a: Assets, id: number) => { const p = a.players.find((p) => p.id === id); return p ? displayName(p.name) : `#${id}`; };
  const labelPk = (a: Assets, id: number) => a.picks.find((p) => p.id === id)?.label ?? `Pick #${id}`;
  const labelPro = (a: Assets, id: number) => a.prospects.find((p) => p.id === id)?.label ?? `Prospect #${id}`;
  const sideSummary = (a: Assets, pmap: Record<number, number>, pk: Set<number>, pro: Set<number>, cash: number): string[] => {
    const items: string[] = [];
    for (const [id, pct] of Object.entries(pmap)) items.push(`🏒 ${nameP(a, +id)}${pct ? ` · ${pct}% ret.` : ""}`);
    for (const id of pk) items.push(`🎫 ${labelPk(a, id)}`);
    for (const id of pro) items.push(`⭐ ${labelPro(a, id)}`);
    if (cash > 0) items.push(`💵 ${money(cash)}`);
    return items;
  };
  const mineSummary = sideSummary(mine, mineP, minePk, minePro, mineCash);
  const theirsSummary = sideSummary(theirs, theirsP, theirsPk, theirsPro, theirsCash);

  return (
    <div className="max-w-6xl mx-auto px-4 pb-10">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Trade Room</h1>
        <Link href="/trades/build" className="text-sm text-slate-400 hover:text-blue-400">change team</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px_1fr] gap-4 items-start">
        <Side team={me} assets={mine} pmap={mineP} setPmap={setMineP} pk={minePk} setPk={setMinePk} pro={minePro} setPro={setMinePro} cash={mineCash} setCash={setMineCash} destTeamId={opp.id} terms={terms} fees={fees} onToggleClause={toggleClausePlayer} onAgreeFee={agreeFee} onTogglePick={togglePick} onTogglePickAsset={toggleDraftPick} capStatus={meCap} capDelta={meCapDelta} incomingAssets={theirs} incomingPmap={theirsP}
          conditionSpec={conditionSpec} onOpenCondition={(p, ownerTeamId, picks) => setConditionModal({ player: p, ownerTeamId, picks })} onRemoveCondition={() => setConditionSpec(null)} lang={lang} />

        {/* MIDDLE — live summary, conditions, Propose + GM Assist */}
        <div className="lg:sticky lg:top-4 space-y-3">
          <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-3 space-y-3 shadow-lg">
            <div className="text-center text-sm font-bold uppercase tracking-wider text-slate-300">Trade summary</div>
            <SummaryBox name={me.name} logoUrl={me.logoUrl} items={mineSummary} accent="text-blue-400" />
            <div className="flex items-center justify-center text-slate-500">⇅</div>
            <SummaryBox name={opp.name} logoUrl={opp.logoUrl} items={theirsSummary} accent="text-red-400" />

            <div className="flex flex-col gap-2">
              <button onClick={submit} disabled={pending || count === 0}
                className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm disabled:opacity-40">
                {pending ? "Sending…" : `${submitLabel ?? "Propose trade"}${count ? ` (${count})` : ""}`}
              </button>
              <button onClick={runAnalyze} disabled={aiPending || count === 0}
                className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm disabled:opacity-40"
                title="GM Assist — vyhodnotí hodnotu a zmysel výmeny">
                {aiPending ? "Analyzujem…" : "🤖 GM Assist"}
              </button>
            </div>
            {msg && <p className="text-green-400 text-sm">{msg}</p>}
            {err && <p className="text-red-400 text-sm">{err}</p>}

            {/* GM Assist result — inline in this column */}
            {ai && (
              <div className="border-t border-slate-800 pt-3">
                {!ai.ok ? (
                  <p className="text-rose-400 text-sm">{ai.error}</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold flex items-center gap-1.5">🤖 GM Assist</h3>
                      <button onClick={() => setAi(null)} className="text-slate-500 hover:text-white text-lg leading-none">×</button>
                    </div>
                    <div className={`rounded-lg px-3 py-2 border ${ai.tilt === "even" ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-300" : "bg-amber-950/30 border-amber-800/50 text-amber-300"}`}>
                      <div className="text-sm font-bold">{ai.verdict}</div>
                      <div className="text-[11px] mt-1 text-slate-400">{ai.fromName}: {ai.meGives} daných · {ai.meGets} získaných</div>
                    </div>
                    {ai.fit.length > 0 && (
                      <ul className="space-y-1">{ai.fit.map((f, i) => <li key={i} className="text-xs text-slate-200 flex gap-1.5"><span className="text-sky-400 shrink-0">▸</span><span dangerouslySetInnerHTML={{ __html: f }} /></li>)}</ul>
                    )}
                    <ul className="space-y-1">
                      {ai.reasoning.map((r, i) => <li key={i} className="text-xs text-slate-300 flex gap-1.5"><span className="text-violet-400 shrink-0">•</span><span dangerouslySetInnerHTML={{ __html: r }} /></li>)}
                    </ul>
                    <p className="text-[10px] text-slate-500">Heuristika (overall, vek, cap, hodnota pickov) — orientačná.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <Side team={opp} assets={theirs} pmap={theirsP} setPmap={setTheirsP} pk={theirsPk} setPk={setTheirsPk} pro={theirsPro} setPro={setTheirsPro} cash={theirsCash} setCash={setTheirsCash} destTeamId={me.id} terms={terms} fees={fees} onToggleClause={toggleClausePlayer} onAgreeFee={agreeFee} onTogglePick={togglePick} onTogglePickAsset={toggleDraftPick} capStatus={oppCap} capDelta={oppCapDelta} incomingAssets={mine} incomingPmap={mineP}
          conditionSpec={conditionSpec} onOpenCondition={(p, ownerTeamId, picks) => setConditionModal({ player: p, ownerTeamId, picks })} onRemoveCondition={() => setConditionSpec(null)} lang={lang} />
      </div>

      {conditionModal && (
          <ConditionModal
            player={conditionModal.player}
            ownerTeamId={conditionModal.ownerTeamId}
            picks={conditionModal.picks}
            lang={lang}
            initial={conditionSpec?.playerId === conditionModal.player.id ? conditionSpec : null}
            onSave={(spec) => {
              // Pick B is the default — it conveys as part of this deal right
              // away unless the condition is met — so it must actually be part
              // of the package being sent; make sure it's checked even though
              // it was chosen freely from the picks-owner's own pool rather than
              // pre-checked in the trade's Draft Picks list.
              const isMe = conditionModal.ownerTeamId === me.id;
              const pk = isMe ? minePk : theirsPk;
              const setPk = isMe ? setMinePk : setTheirsPk;
              if (!pk.has(spec.pickBId)) { const n = new Set(pk); n.add(spec.pickBId); setPk(n); }
              setConditionSpec(spec); setConditionModal(null);
            }}
            onRemove={conditionSpec?.playerId === conditionModal.player.id ? () => { setConditionSpec(null); setConditionModal(null); } : undefined}
            onClose={() => setConditionModal(null)}
          />
      )}
    </div>
  );
}
