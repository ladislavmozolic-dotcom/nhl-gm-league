"use client";

import { useState, useTransition } from "react";
import PlayerLink from "@/components/PlayerLink";
import Link from "next/link";
import { ROSTER_LIMITS, isNhlSide, type MoveRow, type RosterSide } from "@/lib/roster-rules";

type Player = {
  id: number; name: string; position: string; overall: number;
  isGoalie: boolean; side: RosterSide; contractType: "ONE_WAY" | "TWO_WAY" | null;
  capHit: number; onWaivers?: boolean;
};

// Exactly the $100k farm deal → a minor-league (AHL-only) contract. Such a player
// can NEVER be on the NHL roster — dressed OR scratched. Anything else (including a
// two-way deal well below the real NHL minimum) is governed by contractType instead.
const isAhlOnly = (p: Player) => p.capHit === 100_000;
// OV badge in green, brighter the higher the rating.
const ovColor = (ov: number) =>
  ov >= 80 ? "bg-emerald-500/30 text-emerald-200 border-emerald-400/60"
  : ov >= 70 ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
  : ov >= 60 ? "bg-emerald-600/12 text-emerald-400/90 border-emerald-600/30"
  : "bg-emerald-700/10 text-emerald-500/70 border-emerald-700/25";
// a $100k minor-league deal is the only contract that can be released to UFA
const isReleasable = (p: Player) => p.capHit === 100_000;

type Props = {
  teamName: string; teamSlug: string; affiliateName: string; hasAffiliate: boolean;
  players: Player[]; onSave: (slug: string, rows: MoveRow[]) => Promise<{ ok: boolean; error?: string } | void>;
  onRelease: (slug: string, playerId: number) => Promise<{ ok: boolean; error?: string; name?: string }>;
  onWaiver: (slug: string, playerId: number) => Promise<{ ok: boolean; error?: string }>;
};

export default function RosterMover({ teamName, teamSlug, affiliateName, hasAffiliate, players, onSave, onRelease, onWaiver }: Props) {
  const [rows, setRows] = useState<Player[]>(players);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const release = (p: Player) => {
    if (!isReleasable(p)) return;
    if (!confirm(`Release ${p.name} to the UFA market? He leaves your organization and any GM can sign him.`)) return;
    start(async () => {
      setErr(null); setNote(null);
      try {
        const r = await onRelease(teamSlug, p.id);
        if (!r.ok) setErr(r.error ?? "Couldn't release the player.");
        else { setRows((prev) => prev.filter((x) => x.id !== p.id)); setNote(`${r.name ?? p.name} released to UFA.`); }
      } catch (e) { setErr((e as Error).message); }
    });
  };

  const waiver = (p: Player) => {
    if (!confirm(`Put ${p.name} on waivers? Any club can claim him during a one-day window; if unclaimed, he clears to your AHL affiliate.`)) return;
    start(async () => {
      setErr(null); setNote(null);
      try {
        const r = await onWaiver(teamSlug, p.id);
        if (!r.ok) setErr(r.error ?? "Couldn't place him on waivers.");
        else { setRows((prev) => prev.map((x) => (x.id === p.id ? { ...x, onWaivers: true } : x))); setNote(`${p.name} placed on waivers.`); }
      } catch (e) { setErr((e as Error).message); }
    });
  };

  const byName = (a: Player, b: Player) => a.name.localeCompare(b.name);
  const of = (s: RosterSide) => rows.filter((r) => r.side === s).sort(byName);
  const pro = of("pro"), proScratched = of("pro-scratched"), farm = of("farm"), farmScratched = of("farm-scratched");
  const nhlRoster = rows.filter((r) => isNhlSide(r.side)); // dressed + scratched → cap + 23-limit
  const goalies = (l: Player[]) => l.filter((p) => p.isGoalie).length;
  const proSkaters = pro.length - goalies(pro);
  const isDef = (pos: string) => /(^|\/)D(\/|$)/.test(pos) || pos === "D";
  const fdg = (l: Player[]) => {
    const g = l.filter((p) => p.isGoalie).length;
    const d = l.filter((p) => !p.isGoalie && isDef(p.position)).length;
    return `${l.length - g - d}F · ${d}D · ${g}G`;
  };

  // is a move legal? onto the NHL roster (dressed or scratched) an AHL-only deal can
  // never go; down to the farm a one-way contract can never go (unless it's AHL-only).
  const canMove = (p: Player, to: RosterSide) => {
    if (isNhlSide(to)) return !isAhlOnly(p);
    return p.contractType !== "ONE_WAY" || isAhlOnly(p);
  };
  const move = (id: number, to: RosterSide) => {
    const p = rows.find((r) => r.id === id)!;
    if (!canMove(p, to)) return;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, side: to } : r)));
    setSaved(false); setErr(null);
  };

  const orgGoalies = goalies(nhlRoster) + goalies(farm) + goalies(farmScratched);
  // BLOCKERS — hard maxima you must never exceed (they'd be illegal to ice).
  const blockers: string[] = [];
  if (nhlRoster.length > ROSTER_LIMITS.proMax) blockers.push(`NHL roster over ${ROSTER_LIMITS.proMax} (dressed + scratched).`);
  if (rows.length > ROSTER_LIMITS.orgMax) blockers.push(`Organization over ${ROSTER_LIMITS.orgMax} players.`);
  if (orgGoalies > ROSTER_LIMITS.orgMaxGoalies) blockers.push(`Organization over ${ROSTER_LIMITS.orgMaxGoalies} goalies.`);
  // WARNINGS — being UNDER a minimum is allowed to save: the farm auto-fills the
  // missing bodies at game time, and you often call a player up precisely to fix it.
  const warnings: string[] = [];
  if (proSkaters < ROSTER_LIMITS.proMinSkaters) warnings.push(`Dressed NHL short of ${ROSTER_LIMITS.proMinSkaters} skaters — the farm auto-fills at game time.`);
  if (goalies(pro) < ROSTER_LIMITS.proMinGoalies) warnings.push(`Dressed NHL short of ${ROSTER_LIMITS.proMinGoalies} goalies — the farm auto-fills at game time.`);

  // Auto Roster — dress the best available 20 (18 skaters + 2 goalies), keeping one-way
  // players up; the next-best fill the AHL active roster (18+2); everyone else is farm-
  // scratched. AHL-only deals never go up. NHL scratches stay empty (dress exactly 20).
  const autoRoster = () => {
    const byOV = (a: Player, b: Player) => b.overall - a.overall;
    const sk = rows.filter((r) => !r.isGoalie);
    const gk = rows.filter((r) => r.isGoalie);
    const forcedUp = (p: Player) => p.contractType === "ONE_WAY" && !isAhlOnly(p);
    const proPool = (pool: Player[], n: number) => {
      const forced = pool.filter(forcedUp);
      const rest = pool.filter((p) => !forcedUp(p) && !isAhlOnly(p)).sort(byOV);
      return [...forced, ...rest].slice(0, Math.max(n, forced.length)).map((p) => p.id);
    };
    const proIds = new Set([...proPool(sk, ROSTER_LIMITS.proMinSkaters), ...proPool(gk, ROSTER_LIMITS.proMinGoalies)]);
    const remSk = sk.filter((p) => !proIds.has(p.id)).sort(byOV);
    const remGk = gk.filter((p) => !proIds.has(p.id)).sort(byOV);
    const farmIds = new Set([...remSk.slice(0, 18), ...remGk.slice(0, 2)].map((p) => p.id));
    setRows((prev) => prev.map((p) => ({ ...p, side: proIds.has(p.id) ? "pro" : farmIds.has(p.id) ? "farm" : "farm-scratched" })));
    setSaved(false); setErr(null);
  };

  const save = () => start(async () => {
    setErr(null);
    try {
      const r = await onSave(teamSlug, rows.map((m) => ({ id: m.id, side: m.side, contractType: m.contractType })));
      if (r && !r.ok) setErr(r.error ?? "Couldn't save the roster.");
      else setSaved(true);
    } catch (e) { setErr((e as Error).message); }
  });

  const MoveBtn = ({ p, to, label }: { p: Player; to: RosterSide; label: string }) => (
    <button onClick={() => move(p.id, to)} disabled={!canMove(p, to)}
      title={!canMove(p, to) ? (isNhlSide(to) ? "AHL-only / $100k contract — can't be on the NHL roster" : "One-way contracts can't be sent down") : ""}
      className="text-[11px] px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 whitespace-nowrap">{label}</button>
  );

  const Row = ({ p }: { p: Player }) => {
    const oneWay = p.contractType === "ONE_WAY";
    const ahlOnly = isAhlOnly(p);
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800/60 text-sm hover:bg-slate-800/30">
        <span className={`shrink-0 w-9 text-center tabular-nums font-bold text-sm px-1 py-0.5 rounded border ${ovColor(p.overall)}`}>{p.overall}</span>
        <span className="flex-1 min-w-0 truncate">
          <PlayerLink id={p.id} name={p.name} className="font-medium" />
          <span className="text-slate-500 text-xs ml-1.5">{p.position}</span>
        </span>
        {ahlOnly ? (
          <span title="Minor-league (AHL-only) contract — below the NHL minimum salary, can't be called up"
            className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-600/50 text-emerald-400">AHL only</span>
        ) : (
          <span title={oneWay ? "One-way contract — can't be sent to the farm" : "Two-way contract — can be sent to the farm"}
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${oneWay ? "border-amber-600/60 text-amber-400" : "border-slate-700 text-slate-400"}`}>
            {oneWay ? "1-way" : "2-way"}
          </span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {/* a one-way player already on the wire: nothing left to do here but wait */}
          {oneWay && p.onWaivers && (p.side === "pro" || p.side === "pro-scratched") && (
            <span title="Waiting for the one-day waiver window to close — check the Waivers page"
              className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-600/50 text-amber-400 whitespace-nowrap">⏳ On Waivers</span>
          )}
          {/* dressed NHL: scratch, and send down (a one-way deal goes through waivers instead) */}
          {p.side === "pro" && <>
            <MoveBtn p={p} to="pro-scratched" label="Scratch" />
            {oneWay && !ahlOnly
              ? (!p.onWaivers && <button onClick={() => waiver(p)} disabled={pending}
                  title="One-way contracts must clear waivers before they can be sent to the farm"
                  className="text-[11px] px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 whitespace-nowrap">Farm/Waivers</button>)
              : <MoveBtn p={p} to="farm" label="↓ Farm" />}
          </>}
          {/* NHL scratch: dress, and send down (same one-way → waivers rule) */}
          {p.side === "pro-scratched" && <>
            <MoveBtn p={p} to="pro" label="Dress" />
            {oneWay && !ahlOnly
              ? (!p.onWaivers && <button onClick={() => waiver(p)} disabled={pending}
                  title="One-way contracts must clear waivers before they can be sent to the farm"
                  className="text-[11px] px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 whitespace-nowrap">Farm/Waivers</button>)
              : <MoveBtn p={p} to="farm" label="↓ Farm" />}
          </>}
          {/* AHL active: call up or scratch */}
          {p.side === "farm" && <><MoveBtn p={p} to="pro" label="↑ Pro" /><MoveBtn p={p} to="farm-scratched" label="Scratch" /></>}
          {/* AHL scratch: call up, dress on the farm, or release a $100k deal to UFA */}
          {p.side === "farm-scratched" && <>
            <MoveBtn p={p} to="pro" label="↑ Pro" /><MoveBtn p={p} to="farm" label="Dress" />
            <button onClick={() => release(p)} disabled={!isReleasable(p) || pending}
              title={isReleasable(p) ? "Release this $100k minor-league player to the UFA market" : "Only a $100k minor-league contract can be released"}
              className="text-[11px] px-2 py-0.5 rounded bg-red-900/70 hover:bg-red-800 text-red-200 disabled:opacity-25 whitespace-nowrap">Release</button>
          </>}
        </div>
      </div>
    );
  };

  const Col = ({ title, sub, list, warn }: { title: string; sub: string; list: Player[]; warn?: boolean }) => (
    <div className="bg-slate-900/40 border border-slate-800 rounded-lg overflow-hidden">
      <div className={`px-3 py-2 border-b border-slate-800 ${warn ? "bg-red-950/40" : "bg-slate-800/40"}`}>
        <div className="font-bold text-sm">{title}</div>
        <div className="text-[11px] text-slate-500">{sub}</div>
      </div>
      <div className="max-h-[42vh] overflow-y-auto">
        {list.length === 0 && <div className="px-3 py-3 text-slate-600 text-sm">empty</div>}
        {list.map((p) => <Row key={p.id} p={p} />)}
      </div>
    </div>
  );

  if (!hasAffiliate) return (
    <div className="max-w-2xl mx-auto px-4"><h1 className="text-2xl font-bold mb-2">{teamName} — Rosters</h1>
      <p className="text-slate-400">This team has no AHL affiliate to move players between.</p></div>
  );

  return (
    <div className="w-full px-6 pb-28">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">{teamName} — Rosters</h1>
        <div className="flex gap-3 text-sm mt-1">
          <Link href={`/teams/${teamSlug}`} className="text-slate-400 hover:text-blue-400">← team</Link>
          <Link href={`/teams/${teamSlug}/lines`} className="text-slate-400 hover:text-blue-400">Lines →</Link>
          <Link href={`/teams/${teamSlug}/roster/edit`} className="text-slate-400 hover:text-blue-400">Numbers &amp; captains →</Link>
        </div>
        <p className="text-xs text-slate-500 mt-1">Choose which <b>20 dress</b> (NHL) vs the healthy scratches, and manage the farm. One-way contracts can&apos;t be sent down directly — put them on <b>Farm/Waivers</b> instead; AHL-only / $100k minor-league deals can&apos;t be called up. <b>NHL Scratched</b> still count against the cap; <b>Farm Scratched</b> dress nowhere. A <b>$100k</b> minor-league player can be <b>Released</b> from Farm Scratched straight to the UFA market.</p>
      </div>

      {blockers.length > 0 && (
        <div className="mb-2 text-sm text-red-300 bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2">{blockers.join(" ")}</div>
      )}
      {warnings.length > 0 && (
        <div className="mb-4 text-sm text-amber-300/90 bg-amber-950/30 border border-amber-800/40 rounded-lg px-4 py-2">{warnings.join(" ")}</div>
      )}

      {/* NHL row */}
      <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">NHL — {teamName}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <Col title={`NHL Dressed`} warn={nhlRoster.length > ROSTER_LIMITS.proMax || proSkaters < ROSTER_LIMITS.proMinSkaters || goalies(pro) < ROSTER_LIMITS.proMinGoalies}
          sub={`${fdg(pro)} · ${pro.length} dressed (need 12F·6D·2G) · NHL roster ${nhlRoster.length}/${ROSTER_LIMITS.proMax}`} list={pro} />
        <Col title="NHL Scratched" sub={`${proScratched.length} healthy scratch${proScratched.length === 1 ? "" : "es"} · still on the cap`} list={proScratched} />
      </div>

      {/* Farm row */}
      <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">Farm — {affiliateName}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Col title="Farm Dressed" warn={farm.length > ROSTER_LIMITS.ahlMax}
          sub={`${fdg(farm)} · ${farm.length}/${ROSTER_LIMITS.ahlMax}${farm.length > ROSTER_LIMITS.ahlMax ? " — scratch the overflow" : " (need 12F·6D·2G)"}`} list={farm} />
        <Col title="Farm Scratched" sub={`${farmScratched.length} scratch${farmScratched.length === 1 ? "" : "es"} · org ${rows.length}/${ROSTER_LIMITS.orgMax}`} list={farmScratched} />
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/90 border-t border-slate-800 backdrop-blur px-4 py-3">
        <div className="w-full px-2 flex items-center gap-3">
          <button onClick={save} disabled={pending || blockers.length > 0}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm disabled:opacity-50">
            {pending ? "Saving…" : "Save rosters"}
          </button>
          <button onClick={autoRoster} disabled={pending}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 font-semibold text-sm disabled:opacity-50"
            title="Dress the best available 20 (18+2), the rest to the farm, overflow scratched">
            Auto Roster
          </button>
          {blockers.length > 0 && <span className="text-red-400 text-sm">Fix the cap/limit issue to save</span>}
          {saved && <span className="text-green-400 text-sm">✓ Saved</span>}
          {note && <span className="text-amber-300 text-sm">{note}</span>}
          {err && <span className="text-red-400 text-sm">{err}</span>}
        </div>
      </div>
    </div>
  );
}
