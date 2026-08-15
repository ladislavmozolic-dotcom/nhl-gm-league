"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { money } from "@/lib/finance";
import type { TradePackage } from "@/app/trades/build/actions";

type Player = { id: number; name: string; position: string; capHit: number; farm: boolean };
type Pick = { id: number; label: string };
type Assets = { players: Player[]; picks: Pick[]; prospects: Pick[] };
type Team = { id: number; name: string };

export default function TradeBuilder({ me, opp, mine, theirs, onPropose }: {
  me: Team; opp: Team; mine: Assets; theirs: Assets;
  onPropose: (pkg: TradePackage) => Promise<{ tradeId: number }>;
}) {
  const [mineP, setMineP] = useState<Record<number, number>>({});   // playerId -> retention%
  const [theirsP, setTheirsP] = useState<Record<number, number>>({});
  const [minePk, setMinePk] = useState<Set<number>>(new Set());
  const [theirsPk, setTheirsPk] = useState<Set<number>>(new Set());
  const [minePro, setMinePro] = useState<Set<number>>(new Set());
  const [theirsPro, setTheirsPro] = useState<Set<number>>(new Set());
  const [mineCash, setMineCash] = useState(0);
  const [theirsCash, setTheirsCash] = useState(0);
  const [condition, setCondition] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const togglePlayer = (map: Record<number, number>, set: (v: Record<number, number>) => void, id: number) => {
    const next = { ...map };
    if (id in next) delete next[id]; else next[id] = 0;
    set(next); setMsg(null);
  };
  const setRet = (map: Record<number, number>, set: (v: Record<number, number>) => void, id: number, pct: number) =>
    set({ ...map, [id]: Math.max(0, Math.min(50, pct)) });
  const togglePick = (set: Set<number>, setter: (s: Set<number>) => void, id: number) => {
    const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); setter(n); setMsg(null);
  };

  const PlayerTable = ({ title, list, pmap, setPmap }: {
    title: string; list: Player[]; pmap: Record<number, number>; setPmap: (v: Record<number, number>) => void;
  }) => (
    <div className="bg-slate-900/40 border border-slate-800 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-slate-800/40 text-xs font-bold uppercase tracking-wide text-slate-400">{title} ({list.length})</div>
      <div className="max-h-[38vh] overflow-y-auto divide-y divide-slate-800/60">
        {list.length === 0 && <div className="px-3 py-3 text-slate-600 text-sm">none</div>}
        {list.map((p) => {
          const on = p.id in pmap;
          return (
            <div key={p.id} className={`px-3 py-2 ${on ? "bg-blue-950/30" : ""}`}>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={on} onChange={() => togglePlayer(pmap, setPmap, p.id)} className="accent-blue-500 w-4 h-4" />
                <span className="flex-1 truncate">{p.name} <span className="text-slate-500 text-xs">{p.position}</span></span>
                <span className="text-slate-400 tabular-nums text-sm">{money(p.capHit)}</span>
              </label>
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
            <span className="text-slate-300">{icon} {it.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  const Side = ({ team, assets, pmap, setPmap, pk, setPk, pro, setPro, cash, setCash }: {
    team: Team; assets: Assets; pmap: Record<number, number>; setPmap: (v: Record<number, number>) => void;
    pk: Set<number>; setPk: (s: Set<number>) => void; pro: Set<number>; setPro: (s: Set<number>) => void;
    cash: number; setCash: (n: number) => void;
  }) => (
    <div className="space-y-3">
      <div className="text-center font-bold">{team.name} sends</div>
      <PlayerTable title="NHL players" list={assets.players.filter((p) => !p.farm)} pmap={pmap} setPmap={setPmap} />
      <PlayerTable title="AHL players" list={assets.players.filter((p) => p.farm)} pmap={pmap} setPmap={setPmap} />
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
      });
      setMsg(`Trade proposed to ${opp.name} (#${r.tradeId}). Awaiting their GM's response.`);
      setMineP({}); setTheirsP({}); setMinePk(new Set()); setTheirsPk(new Set()); setMinePro(new Set()); setTheirsPro(new Set()); setMineCash(0); setTheirsCash(0);
    } catch (e) { setErr((e as Error).message); }
  });

  const count = Object.keys(mineP).length + Object.keys(theirsP).length + minePk.size + theirsPk.size + minePro.size + theirsPro.size + (mineCash ? 1 : 0) + (theirsCash ? 1 : 0);

  return (
    <div className="max-w-5xl mx-auto px-4 pb-28">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Trade Room</h1>
        <Link href="/trades/build" className="text-sm text-slate-400 hover:text-blue-400">change team</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Side team={me} assets={mine} pmap={mineP} setPmap={setMineP} pk={minePk} setPk={setMinePk} pro={minePro} setPro={setMinePro} cash={mineCash} setCash={setMineCash} />
        <Side team={opp} assets={theirs} pmap={theirsP} setPmap={setTheirsP} pk={theirsPk} setPk={setTheirsPk} pro={theirsPro} setPro={setTheirsPro} cash={theirsCash} setCash={setTheirsCash} />
      </div>

      <div className="mt-4">
        <label className="text-sm text-slate-400">Condition (optional)</label>
        <textarea value={condition} onChange={(e) => setCondition(e.target.value)} rows={2}
          className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm" placeholder="e.g. 2027 4th-rounder becomes a 3rd if the player scores 20 goals" />
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/90 border-t border-slate-800 backdrop-blur px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button onClick={submit} disabled={pending || count === 0}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm disabled:opacity-40">
            {pending ? "Sending…" : "Propose trade"}
          </button>
          <span className="text-xs text-slate-500">{count} asset{count === 1 ? "" : "s"} in trade</span>
          {msg && <span className="text-green-400 text-sm">{msg}</span>}
          {err && <span className="text-red-400 text-sm">{err}</span>}
        </div>
      </div>
    </div>
  );
}
