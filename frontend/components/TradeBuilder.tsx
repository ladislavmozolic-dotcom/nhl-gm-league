"use client";

import { useState, useTransition } from "react";
import PlayerLink from "@/components/PlayerLink";
import Link from "next/link";
import { money } from "@/lib/finance";
import { clauseTermsAction, analyzeTradeAction, type TradePackage } from "@/app/trades/build/actions";

type Player = { id: number; name: string; position: string; capHit: number; farm: boolean; clause?: string | null; noTradeTeams?: number[] };
type Pick = { id: number; label: string; logoUrl?: string | null };
type Assets = { players: Player[]; picks: Pick[]; prospects: Pick[] };
type Team = { id: number; name: string };

const clauseTag = (c?: string | null) => c === "NMC" ? "NMC" : c === "M_NTC" ? "M-NTC" : c === "NTC" ? "NTC" : null;

export type TradeBuilderInitial = {
  mineP?: Record<number, number>; theirsP?: Record<number, number>;
  minePk?: number[]; theirsPk?: number[]; minePro?: number[]; theirsPro?: number[];
  mineCash?: number; theirsCash?: number; condition?: string;
};

export default function TradeBuilder({ me, opp, mine, theirs, onPropose, initial, submitLabel }: {
  me: Team; opp: Team; mine: Assets; theirs: Assets;
  onPropose: (pkg: TradePackage) => Promise<{ tradeId: number }>;
  initial?: TradeBuilderInitial; submitLabel?: string;
}) {
  const [mineP, setMineP] = useState<Record<number, number>>(initial?.mineP ?? {});   // playerId -> retention%
  const [theirsP, setTheirsP] = useState<Record<number, number>>(initial?.theirsP ?? {});
  const [minePk, setMinePk] = useState<Set<number>>(new Set(initial?.minePk ?? []));
  const [theirsPk, setTheirsPk] = useState<Set<number>>(new Set(initial?.theirsPk ?? []));
  const [minePro, setMinePro] = useState<Set<number>>(new Set(initial?.minePro ?? []));
  const [theirsPro, setTheirsPro] = useState<Set<number>>(new Set(initial?.theirsPro ?? []));
  const [mineCash, setMineCash] = useState(initial?.mineCash ?? 0);
  const [theirsCash, setTheirsCash] = useState(initial?.theirsCash ?? 0);
  const [condition, setCondition] = useState(initial?.condition ?? "");
  // clause agent: fetched terms per protected player + the fees the GM agrees to pay
  type Terms = { feeAmount: number; feePct: number; fullPayout: boolean; reason: string; payTeamId: number };
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
    if (wasOn) { setFees((f) => { const n = { ...f }; delete n[p.id]; return n; }); setTerms((t) => { const n = { ...t }; delete n[p.id]; return n; }); return; }
    const needs = !!p.clause && (p.clause !== "M_NTC" || (p.noTradeTeams ?? []).includes(destTeamId));
    if (!needs) return;
    setTerms((t) => ({ ...t, [p.id]: "loading" }));
    clauseTermsAction(p.id, destTeamId).then((r) => {
      if (!r) { setTerms((t) => { const n = { ...t }; delete n[p.id]; return n; }); return; }
      setTerms((t) => ({ ...t, [p.id]: { feeAmount: r.feeAmount, feePct: r.feePct, fullPayout: r.fullPayout, reason: r.reason, payTeamId: ownerTeamId } }));
      if (r.feeAmount === 0) setFees((f) => ({ ...f, [p.id]: { feeAmount: 0, payTeamId: ownerTeamId } }));
    });
  };
  const setRet = (map: Record<number, number>, set: (v: Record<number, number>) => void, id: number, pct: number) =>
    set({ ...map, [id]: Math.max(0, Math.min(50, pct)) });
  const togglePick = (set: Set<number>, setter: (s: Set<number>) => void, id: number) => {
    const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); setter(n); setMsg(null);
  };

  const PlayerTable = ({ title, list, pmap, setPmap, destTeamId, ownerTeamId }: {
    title: string; list: Player[]; pmap: Record<number, number>; setPmap: (v: Record<number, number>) => void; destTeamId: number; ownerTeamId: number;
  }) => (
    <div className="bg-slate-900/40 border border-slate-800 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-slate-800/40 text-xs font-bold uppercase tracking-wide text-slate-400">{title} ({list.length})</div>
      <div className="max-h-[38vh] overflow-y-auto divide-y divide-slate-800/60">
        {list.length === 0 && <div className="px-3 py-3 text-slate-600 text-sm">none</div>}
        {list.map((p) => {
          const on = p.id in pmap;
          const tag = clauseTag(p.clause);
          const needsWaiver = !!p.clause && (p.clause !== "M_NTC" || (p.noTradeTeams ?? []).includes(destTeamId));
          return (
            <div key={p.id} className={`px-3 py-2 ${on ? "bg-blue-950/30" : ""}`}>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={on} onChange={() => toggleClausePlayer(pmap, setPmap, p, destTeamId, ownerTeamId)} className="accent-blue-500 w-4 h-4" />
                <span className="flex-1 truncate"><PlayerLink id={p.id} name={p.name} /> <span className="text-slate-500 text-xs">{p.position}</span>{tag && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">{tag}</span>}</span>
                <span className="text-slate-400 tabular-nums text-sm">{money(p.capHit)}</span>
              </label>
              {on && needsWaiver && (() => {
                const t = terms[p.id];
                if (!t || t === "loading") return <p className="mt-2 ml-6.5 text-xs text-slate-500">⚖ Checking with his agent…</p>;
                const agreed = p.id in fees;
                return (
                  <div className="mt-2 ml-6.5 text-xs">
                    <p className={t.feeAmount === 0 ? "text-emerald-400" : "text-amber-300"}>⚖ {t.reason}</p>
                    {t.feeAmount > 0 && (
                      <label className="flex items-center gap-2 mt-1 cursor-pointer">
                        <input type="checkbox" checked={agreed} onChange={() => agreeFee(p.id, t)} className="accent-amber-500 w-3.5 h-3.5" />
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
                    <button type="button" onClick={() => setRet(pmap, setPmap, p.id, (pmap[p.id] || 0) - 5)}
                      className="w-7 h-8 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-base leading-none">−</button>
                    <div className="flex items-center bg-slate-900 border border-slate-700 rounded">
                      <input type="number" min={0} max={50} step={5} value={pmap[p.id]}
                        onChange={(e) => setRet(pmap, setPmap, p.id, Number(e.target.value))}
                        className="w-16 bg-transparent px-2.5 py-1.5 text-right text-sm tabular-nums outline-none" />
                      <span className="pr-2.5 text-slate-500">%</span>
                    </div>
                    <button type="button" onClick={() => setRet(pmap, setPmap, p.id, (pmap[p.id] || 0) + 5)}
                      className="w-7 h-8 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-base leading-none">+</button>
                  </div>
                  {pmap[p.id] > 0 && <span className="text-amber-400">retains {money(p.capHit * pmap[p.id] / 100)}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const CheckTable = ({ title, icon, list, sel, setSel }: {
    title: string; icon: string; list: Pick[]; sel: Set<number>; setSel: (s: Set<number>) => void;
  }) => (
    <div className="bg-slate-900/40 border border-slate-800 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-slate-800/40 text-xs font-bold uppercase tracking-wide text-slate-400">{title} ({list.length})</div>
      <div className="max-h-[28vh] overflow-y-auto divide-y divide-slate-800/60">
        {list.length === 0 && <div className="px-3 py-3 text-slate-600 text-sm">none</div>}
        {list.map((it) => (
          <label key={it.id} className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer ${sel.has(it.id) ? "bg-blue-950/30" : ""}`}>
            <input type="checkbox" checked={sel.has(it.id)} onChange={() => togglePick(sel, setSel, it.id)} className="accent-blue-500 w-4 h-4" />
            {it.logoUrl && <img src={it.logoUrl} alt="" className="w-4 h-4 object-contain shrink-0" />}
            <span className="text-slate-300">{icon} {it.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  const Side = ({ team, assets, pmap, setPmap, pk, setPk, pro, setPro, cash, setCash, destTeamId }: {
    team: Team; assets: Assets; pmap: Record<number, number>; setPmap: (v: Record<number, number>) => void;
    pk: Set<number>; setPk: (s: Set<number>) => void; pro: Set<number>; setPro: (s: Set<number>) => void;
    cash: number; setCash: (n: number) => void; destTeamId: number;
  }) => (
    <div className="space-y-3">
      <div className="text-center font-bold">{team.name} sends</div>
      <PlayerTable title="NHL players" list={assets.players.filter((p) => !p.farm)} pmap={pmap} setPmap={setPmap} destTeamId={destTeamId} ownerTeamId={team.id} />
      <PlayerTable title="AHL players" list={assets.players.filter((p) => p.farm)} pmap={pmap} setPmap={setPmap} destTeamId={destTeamId} ownerTeamId={team.id} />
      <CheckTable title="Prospects" icon="⭐" list={assets.prospects} sel={pro} setSel={setPro} />
      <CheckTable title="Draft picks" icon="🎫" list={assets.picks} sel={pk} setSel={setPk} />
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

  const submit = () => start(async () => {
    setErr(null); setMsg(null);
    try {
      const r = await onPropose({
        fromTeamId: me.id, toTeamId: opp.id,
        fromPlayers: Object.entries(mineP).map(([id, pct]) => ({ playerId: Number(id), retentionPct: pct })),
        toPlayers: Object.entries(theirsP).map(([id, pct]) => ({ playerId: Number(id), retentionPct: pct })),
        fromPicks: [...minePk], toPicks: [...theirsPk],
        fromProspects: [...minePro], toProspects: [...theirsPro],
        fromCash: mineCash, toCash: theirsCash, condition,
        waived: Object.keys(fees).map(Number),
        clauseFees: Object.entries(fees).map(([id, v]) => ({ playerId: Number(id), feeAmount: v.feeAmount, payTeamId: v.payTeamId })),
      });
      setMsg(`Trade proposed to ${opp.name} (#${r.tradeId}). Awaiting their GM's response.`);
      setMineP({}); setTheirsP({}); setMinePk(new Set()); setTheirsPk(new Set()); setMinePro(new Set()); setTheirsPro(new Set()); setMineCash(0); setTheirsCash(0); setFees({}); setTerms({});
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

  // live "who gives what" summary for the middle column
  const nameP = (a: Assets, id: number) => a.players.find((p) => p.id === id)?.name ?? `#${id}`;
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

  const SummaryBox = ({ name, items, accent }: { name: string; items: string[]; accent: string }) => (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-2.5">
      <div className={`text-[11px] font-bold uppercase tracking-wide mb-1.5 ${accent}`}>{name} sends</div>
      {items.length === 0
        ? <div className="text-slate-600 text-xs italic">nothing selected yet</div>
        : <ul className="space-y-1 text-sm text-slate-200">{items.map((t, i) => <li key={i} className="truncate">{t}</li>)}</ul>}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 pb-10">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Trade Room</h1>
        <Link href="/trades/build" className="text-sm text-slate-400 hover:text-blue-400">change team</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px_1fr] gap-4 items-start">
        <Side team={me} assets={mine} pmap={mineP} setPmap={setMineP} pk={minePk} setPk={setMinePk} pro={minePro} setPro={setMinePro} cash={mineCash} setCash={setMineCash} destTeamId={opp.id} />

        {/* MIDDLE — live summary, conditions, Propose + GM Assist */}
        <div className="lg:sticky lg:top-4 space-y-3">
          <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-3 space-y-3 shadow-lg">
            <div className="text-center text-sm font-bold uppercase tracking-wider text-slate-300">Trade summary</div>
            <SummaryBox name={me.name} items={mineSummary} accent="text-blue-400" />
            <div className="flex items-center justify-center text-slate-500">⇅</div>
            <SummaryBox name={opp.name} items={theirsSummary} accent="text-red-400" />

            <div>
              <label className="text-xs text-slate-400">Condition (optional)</label>
              <textarea value={condition} onChange={(e) => setCondition(e.target.value)} rows={2}
                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-sm" placeholder="e.g. 2027 4th becomes a 3rd if he scores 20 goals" />
            </div>

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

        <Side team={opp} assets={theirs} pmap={theirsP} setPmap={setTheirsP} pk={theirsPk} setPk={setTheirsPk} pro={theirsPro} setPro={setTheirsPro} cash={theirsCash} setCash={setTheirsCash} destTeamId={me.id} />
      </div>
    </div>
  );
}
