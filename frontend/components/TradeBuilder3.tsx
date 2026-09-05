"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import PlayerLink from "@/components/PlayerLink";
import { money } from "@/lib/finance";
import { proposeTradeGroupAction, type GroupLeg } from "@/app/trades/build3/actions";

type Player = { id: number; name: string; position: string; capHit: number; farm: boolean; clause?: string | null };
type Pick = { id: number; label: string; logoUrl?: string | null };
type Assets = { players: Player[]; picks: Pick[]; prospects: Pick[] };
type Team = { id: number; name: string };

const clauseTag = (c?: string | null) => c === "NMC" ? "NMC" : c === "M_NTC" ? "M-NTC" : c === "NTC" ? "NTC" : null;

/** One team's picker column: what it sends, and to which of the other two clubs. */
function TeamColumn({ team, others, assets, dest, setDest, playerIds, setPlayerIds, pickIds, setPickIds, prospectIds, setProspectIds, cash, setCash }: {
  team: Team; others: Team[]; assets: Assets;
  dest: number | null; setDest: (id: number | null) => void;
  playerIds: Set<number>; setPlayerIds: (s: Set<number>) => void;
  pickIds: Set<number>; setPickIds: (s: Set<number>) => void;
  prospectIds: Set<number>; setProspectIds: (s: Set<number>) => void;
  cash: number; setCash: (n: number) => void;
}) {
  const toggle = (set: Set<number>, setter: (s: Set<number>) => void, id: number) => {
    const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); setter(n);
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
        <div className="max-h-[28vh] overflow-y-auto divide-y divide-slate-800/60">
          {assets.players.length === 0 && <div className="px-3 py-3 text-slate-600 text-sm">none</div>}
          {assets.players.map((p) => {
            const tag = clauseTag(p.clause);
            return (
              <label key={p.id} className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer ${playerIds.has(p.id) ? "bg-blue-950/30" : ""} ${tag ? "opacity-50" : ""}`}>
                <input type="checkbox" disabled={!!tag} checked={playerIds.has(p.id)} onChange={() => toggle(playerIds, setPlayerIds, p.id)} className="accent-blue-500 w-4 h-4" />
                <span className="flex-1 truncate"><PlayerLink id={p.id} name={p.name} /> <span className="text-slate-500 text-xs">{p.position}{p.farm ? " · AHL" : ""}</span>{tag && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30" title="Clause-protected players aren't supported in 3-team deals yet">{tag}</span>}</span>
                <span className="text-slate-400 tabular-nums text-xs">{money(p.capHit)}</span>
              </label>
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
      const legs: GroupLeg[] = [
        { fromTeamId: me.id, toTeamId: destA!, playerIds: [...playersA], pickIds: [...picksA], prospectIds: [...prospectsA], cash: cashA },
        { fromTeamId: teamB.id, toTeamId: destB!, playerIds: [...playersB], pickIds: [...picksB], prospectIds: [...prospectsB], cash: cashB },
        { fromTeamId: teamC.id, toTeamId: destC!, playerIds: [...playersC], pickIds: [...picksC], prospectIds: [...prospectsC], cash: cashC },
      ];
      const r = await proposeTradeGroupAction(legs);
      setMsg(`3-team trade proposed (#${r.groupId}). Awaiting ${teamB.name}'s and ${teamC.name}'s GMs.`);
      setPlayersA(new Set()); setPlayersB(new Set()); setPlayersC(new Set());
      setPicksA(new Set()); setPicksB(new Set()); setPicksC(new Set());
      setProspectsA(new Set()); setProspectsB(new Set()); setProspectsC(new Set());
      setCashA(0); setCashB(0); setCashC(0);
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
        Clause-protected players and salary retention aren't supported here yet — use the normal 2-team Trade Room for those.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <TeamColumn team={me} others={[teamB, teamC]} assets={assetsA} dest={destA} setDest={setDestA}
          playerIds={playersA} setPlayerIds={setPlayersA} pickIds={picksA} setPickIds={setPicksA} prospectIds={prospectsA} setProspectIds={setProspectsA} cash={cashA} setCash={setCashA} />
        <TeamColumn team={teamB} others={[me, teamC]} assets={assetsB} dest={destB} setDest={setDestB}
          playerIds={playersB} setPlayerIds={setPlayersB} pickIds={picksB} setPickIds={setPicksB} prospectIds={prospectsB} setProspectIds={setProspectsB} cash={cashB} setCash={setCashB} />
        <TeamColumn team={teamC} others={[me, teamB]} assets={assetsC} dest={destC} setDest={setDestC}
          playerIds={playersC} setPlayerIds={setPlayersC} pickIds={picksC} setPickIds={setPicksC} prospectIds={prospectsC} setProspectIds={setProspectsC} cash={cashC} setCash={setCashC} />
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
