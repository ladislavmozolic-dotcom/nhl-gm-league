"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import PlayerLink from "@/components/PlayerLink";
import { money } from "@/lib/finance";
import { clauseTermsAction } from "@/app/trades/build/actions";
import { proposeTradeGroupAction, type GroupLeg } from "@/app/trades/build3/actions";

type Player = { id: number; name: string; position: string; capHit: number; farm: boolean; clause?: string | null; noTradeTeams?: number[] };
type Pick = { id: number; label: string; logoUrl?: string | null };
type Assets = { players: Player[]; picks: Pick[]; prospects: Pick[] };
type Team = { id: number; name: string };
type Terms = { feeAmount: number; feePct: number; fullPayout: boolean; reason: string };

const clauseTag = (c?: string | null) => c === "NMC" ? "NMC" : c === "M_NTC" ? "M-NTC" : c === "NTC" ? "NTC" : null;

/** One team's picker column: what it sends, and to which of the other two clubs. */
function TeamColumn({ team, others, assets, dest, setDest, playerIds, setPlayerIds, retentions, setRetentions, fees, setFees, terms, setTerms, pickIds, setPickIds, prospectIds, setProspectIds, cash, setCash }: {
  team: Team; others: Team[]; assets: Assets;
  dest: number | null; setDest: (id: number | null) => void;
  playerIds: Set<number>; setPlayerIds: (s: Set<number>) => void;
  retentions: Record<number, number>; setRetentions: (v: Record<number, number>) => void;
  fees: Record<number, number>; setFees: (v: Record<number, number>) => void;
  terms: Record<number, Terms | "loading">; setTerms: (v: Record<number, Terms | "loading">) => void;
  pickIds: Set<number>; setPickIds: (s: Set<number>) => void;
  prospectIds: Set<number>; setProspectIds: (s: Set<number>) => void;
  cash: number; setCash: (n: number) => void;
}) {
  const toggle = (set: Set<number>, setter: (s: Set<number>) => void, id: number) => {
    const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); setter(n);
  };
  const setRet = (id: number, pct: number) => setRetentions({ ...retentions, [id]: Math.max(0, Math.min(50, pct)) });

  const togglePlayer = (p: Player) => {
    const wasOn = playerIds.has(p.id);
    toggle(playerIds, setPlayerIds, p.id);
    if (wasOn) {
      const nf = { ...fees }; delete nf[p.id]; setFees(nf);
      const nt = { ...terms }; delete nt[p.id]; setTerms(nt);
      return;
    }
    if (!dest) return; // no destination picked yet — can't price a clause waiver without knowing where he's going
    const needs = !!p.clause && (p.clause !== "M_NTC" || (p.noTradeTeams ?? []).includes(dest));
    if (!needs) return;
    setTerms({ ...terms, [p.id]: "loading" });
    clauseTermsAction(p.id, dest).then((r) => {
      if (!r) { const nt = { ...terms }; delete nt[p.id]; setTerms(nt); return; }
      setTerms({ ...terms, [p.id]: { feeAmount: r.feeAmount, feePct: r.feePct, fullPayout: r.fullPayout, reason: r.reason } });
      if (r.feeAmount === 0) setFees({ ...fees, [p.id]: 0 });
    });
  };

  return (
    <div className="space-y-3 bg-slate-900/40 border border-slate-800 rounded-xl p-3">
      <div className="text-center font-bold">{team.name} sends</div>
      <div className="flex items-center gap-2 justify-center text-sm">
        <span className="text-slate-400">to</span>
        <select value={dest ?? ""} onChange={(e) => setDest(e.target.value ? Number(e.target.value) : null)}
          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm">
          <option value="">— pick a club —</option>
          {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-slate-800/40 text-xs font-bold uppercase tracking-wide text-slate-400">Players ({assets.players.length})</div>
        <div className="max-h-[34vh] overflow-y-auto divide-y divide-slate-800/60">
          {assets.players.length === 0 && <div className="px-3 py-3 text-slate-600 text-sm">none</div>}
          {assets.players.map((p) => {
            const on = playerIds.has(p.id);
            const tag = clauseTag(p.clause);
            const needsWaiver = dest != null && !!p.clause && (p.clause !== "M_NTC" || (p.noTradeTeams ?? []).includes(dest));
            return (
              <div key={p.id} className={`px-3 py-2 ${on ? "bg-blue-950/30" : ""}`}>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" disabled={!dest} checked={on} onChange={() => togglePlayer(p)} className="accent-blue-500 w-4 h-4" />
                  <span className="flex-1 truncate"><PlayerLink id={p.id} name={p.name} /> <span className="text-slate-500 text-xs">{p.position}{p.farm ? " · AHL" : ""}</span>{tag && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">{tag}</span>}</span>
                  <span className="text-slate-400 tabular-nums text-sm">{money(p.capHit)}</span>
                </label>
                {!dest && <p className="mt-1 ml-6.5 text-[11px] text-slate-600">pick a destination first</p>}
                {on && needsWaiver && (() => {
                  const t = terms[p.id];
                  if (!t || t === "loading") return <p className="mt-2 ml-6.5 text-xs text-slate-500">⚖ Checking with his agent…</p>;
                  const agreed = p.id in fees;
                  return (
                    <div className="mt-2 ml-6.5 text-xs">
                      <p className={t.feeAmount === 0 ? "text-emerald-400" : "text-amber-300"}>⚖ {t.reason}</p>
                      {t.feeAmount > 0 && (
                        <label className="flex items-center gap-2 mt-1 cursor-pointer">
                          <input type="checkbox" checked={agreed} onChange={() => { const nf = { ...fees }; if (agreed) delete nf[p.id]; else nf[p.id] = t.feeAmount; setFees(nf); }} className="accent-amber-500 w-3.5 h-3.5" />
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
                      <button type="button" onClick={() => setRet(p.id, (retentions[p.id] || 0) - 5)}
                        className="w-7 h-8 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-base leading-none">−</button>
                      <div className="flex items-center bg-slate-900 border border-slate-700 rounded">
                        <input type="number" min={0} max={50} step={5} value={retentions[p.id] ?? 0}
                          onChange={(e) => setRet(p.id, Number(e.target.value))}
                          className="w-16 bg-transparent px-2.5 py-1.5 text-right text-sm tabular-nums outline-none" />
                        <span className="pr-2.5 text-slate-500">%</span>
                      </div>
                      <button type="button" onClick={() => setRet(p.id, (retentions[p.id] || 0) + 5)}
                        className="w-7 h-8 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-base leading-none">+</button>
                    </div>
                    {(retentions[p.id] ?? 0) > 0 && <span className="text-amber-400">retains {money(p.capHit * (retentions[p.id] ?? 0) / 100)}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-slate-800/40 text-xs font-bold uppercase tracking-wide text-slate-400">Prospects ({assets.prospects.length})</div>
        <div className="max-h-[18vh] overflow-y-auto divide-y divide-slate-800/60">
          {assets.prospects.length === 0 && <div className="px-3 py-3 text-slate-600 text-sm">none</div>}
          {assets.prospects.map((it) => (
            <label key={it.id} className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer ${prospectIds.has(it.id) ? "bg-blue-950/30" : ""}`}>
              <input type="checkbox" checked={prospectIds.has(it.id)} onChange={() => toggle(prospectIds, setProspectIds, it.id)} className="accent-blue-500 w-4 h-4" />
              <span className="text-slate-300">⭐ {it.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-slate-800/40 text-xs font-bold uppercase tracking-wide text-slate-400">Draft picks ({assets.picks.length})</div>
        <div className="max-h-[18vh] overflow-y-auto divide-y divide-slate-800/60">
          {assets.picks.length === 0 && <div className="px-3 py-3 text-slate-600 text-sm">none</div>}
          {assets.picks.map((it) => (
            <label key={it.id} className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer ${pickIds.has(it.id) ? "bg-blue-950/30" : ""}`}>
              <input type="checkbox" checked={pickIds.has(it.id)} onChange={() => toggle(pickIds, setPickIds, it.id)} className="accent-blue-500 w-4 h-4" />
              {it.logoUrl && <img src={it.logoUrl} alt="" className="w-4 h-4 object-contain shrink-0" />}
              <span className="text-slate-300">🎫 {it.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-lg px-3 py-2.5 flex items-center gap-2 text-sm">
        <span className="text-slate-400">Cash</span>
        <div className="flex items-center bg-slate-900 border border-slate-700 rounded">
          <input type="number" min={0} step={100000} value={cash} onChange={(e) => setCash(Number(e.target.value))}
            className="w-32 bg-transparent px-2 py-1 text-right tabular-nums outline-none" />
          <span className="pr-2.5 text-slate-500">$</span>
        </div>
      </div>
    </div>
  );
}

export default function TradeBuilder3({ me, teamB, teamC, assetsA, assetsB, assetsC }: {
  me: Team; teamB: Team; teamC: Team; assetsA: Assets; assetsB: Assets; assetsC: Assets;
}) {
  const [destA, setDestA] = useState<number | null>(null);
  const [destB, setDestB] = useState<number | null>(null);
  const [destC, setDestC] = useState<number | null>(null);
  const [playersA, setPlayersA] = useState<Set<number>>(new Set());
  const [playersB, setPlayersB] = useState<Set<number>>(new Set());
  const [playersC, setPlayersC] = useState<Set<number>>(new Set());
  const [retA, setRetA] = useState<Record<number, number>>({});
  const [retB, setRetB] = useState<Record<number, number>>({});
  const [retC, setRetC] = useState<Record<number, number>>({});
  const [feesA, setFeesA] = useState<Record<number, number>>({});
  const [feesB, setFeesB] = useState<Record<number, number>>({});
  const [feesC, setFeesC] = useState<Record<number, number>>({});
  const [termsA, setTermsA] = useState<Record<number, Terms | "loading">>({});
  const [termsB, setTermsB] = useState<Record<number, Terms | "loading">>({});
  const [termsC, setTermsC] = useState<Record<number, Terms | "loading">>({});
  const [picksA, setPicksA] = useState<Set<number>>(new Set());
  const [picksB, setPicksB] = useState<Set<number>>(new Set());
  const [picksC, setPicksC] = useState<Set<number>>(new Set());
  const [prospectsA, setProspectsA] = useState<Set<number>>(new Set());
  const [prospectsB, setProspectsB] = useState<Set<number>>(new Set());
  const [prospectsC, setProspectsC] = useState<Set<number>>(new Set());
  const [cashA, setCashA] = useState(0);
  const [cashB, setCashB] = useState(0);
  const [cashC, setCashC] = useState(0);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const count = playersA.size + playersB.size + playersC.size + picksA.size + picksB.size + picksC.size + prospectsA.size + prospectsB.size + prospectsC.size + (cashA ? 1 : 0) + (cashB ? 1 : 0) + (cashC ? 1 : 0);
  const destsChosen = destA != null && destB != null && destC != null;
  const formsCycle = destsChosen && destA !== me.id && destB !== teamB.id && destC !== teamC.id;

  const submit = () => start(async () => {
    setErr(null); setMsg(null);
    try {
      const leg = (fromTeamId: number, dest: number, playerIds: Set<number>, retentions: Record<number, number>, fees: Record<number, number>, pickIds: Set<number>, prospectIds: Set<number>, cash: number): GroupLeg => ({
        fromTeamId, toTeamId: dest, playerIds: [...playerIds], pickIds: [...pickIds], prospectIds: [...prospectIds], cash,
        retentions, clauseFees: Object.entries(fees).map(([id, feeAmount]) => ({ playerId: Number(id), feeAmount })),
      });
      const legs: GroupLeg[] = [
        leg(me.id, destA!, playersA, retA, feesA, picksA, prospectsA, cashA),
        leg(teamB.id, destB!, playersB, retB, feesB, picksB, prospectsB, cashB),
        leg(teamC.id, destC!, playersC, retC, feesC, picksC, prospectsC, cashC),
      ];
      const r = await proposeTradeGroupAction(legs);
      setMsg(`3-team trade proposed (#${r.groupId}). Awaiting ${teamB.name}'s and ${teamC.name}'s GMs.`);
      setPlayersA(new Set()); setPlayersB(new Set()); setPlayersC(new Set());
      setPicksA(new Set()); setPicksB(new Set()); setPicksC(new Set());
      setProspectsA(new Set()); setProspectsB(new Set()); setProspectsC(new Set());
      setCashA(0); setCashB(0); setCashC(0);
      setRetA({}); setRetB({}); setRetC({}); setFeesA({}); setFeesB({}); setFeesC({}); setTermsA({}); setTermsB({}); setTermsC({});
    } catch (e) { setErr((e as Error).message); }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">3-Team Trade Room</h1>
        <Link href="/trades/build3" className="text-sm text-slate-400 hover:text-blue-400">change clubs</Link>
      </div>
      <p className="text-sm text-slate-500">
        Each club picks ONE of the other two as its destination — that forms the cycle (e.g. {me.name} → {teamB.name}, {teamB.name} → {teamC.name}, {teamC.name} → {me.name}).
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <TeamColumn team={me} others={[teamB, teamC]} assets={assetsA} dest={destA} setDest={setDestA}
          playerIds={playersA} setPlayerIds={setPlayersA} retentions={retA} setRetentions={setRetA} fees={feesA} setFees={setFeesA} terms={termsA} setTerms={setTermsA}
          pickIds={picksA} setPickIds={setPicksA} prospectIds={prospectsA} setProspectIds={setProspectsA} cash={cashA} setCash={setCashA} />
        <TeamColumn team={teamB} others={[me, teamC]} assets={assetsB} dest={destB} setDest={setDestB}
          playerIds={playersB} setPlayerIds={setPlayersB} retentions={retB} setRetentions={setRetB} fees={feesB} setFees={setFeesB} terms={termsB} setTerms={setTermsB}
          pickIds={picksB} setPickIds={setPicksB} prospectIds={prospectsB} setProspectIds={setProspectsB} cash={cashB} setCash={setCashB} />
        <TeamColumn team={teamC} others={[me, teamB]} assets={assetsC} dest={destC} setDest={setDestC}
          playerIds={playersC} setPlayerIds={setPlayersC} retentions={retC} setRetentions={setRetC} fees={feesC} setFees={setFeesC} terms={termsC} setTerms={setTermsC}
          pickIds={picksC} setPickIds={setPicksC} prospectIds={prospectsC} setProspectIds={setProspectsC} cash={cashC} setCash={setCashC} />
      </div>

      <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-4 space-y-2">
        {!destsChosen && <p className="text-sm text-amber-300">Pick a destination for all 3 clubs first.</p>}
        {destsChosen && !formsCycle && <p className="text-sm text-rose-400">A club can't send to itself — pick a different destination.</p>}
        <button onClick={submit} disabled={pending || count === 0 || !formsCycle}
          className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm disabled:opacity-40">
          {pending ? "Sending…" : `Propose 3-team trade${count ? ` (${count})` : ""}`}
        </button>
        {msg && <p className="text-green-400 text-sm">{msg}</p>}
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </div>
    </div>
  );
}
