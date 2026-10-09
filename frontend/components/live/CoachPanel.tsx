"use client";

import { useEffect, useState } from "react";
import { PRESETS, type TeamTactics } from "@/lib/sim/tactics";
import type { ForwardLine, DefensePair } from "@/lib/sim/lines-core";
import LinesEditor, { type RosterPlayer } from "./LinesEditor";

type GoaliePull = { minGoals: number; savePctUnder: number; pullSec: number };
type Lines = { forwardLines: ForwardLine[]; defensePairs: DefensePair[]; system?: TeamTactics; strategy?: { goaliePull?: GoaliePull } & Record<string, unknown> } & Record<string, unknown>;
const DEFAULT_PULL: GoaliePull = { minGoals: 4, savePctUnder: 80, pullSec: 90 };
type Opt = { value: string; label: string };

const DIALS: Array<{ key: keyof TeamTactics; label: string; hint: string; options: Opt[] }> = [
  { key: "tempo", label: "Tempo", hint: "pace of play", options: [{ value: "slow", label: "Slow" }, { value: "balanced", label: "Balanced" }, { value: "fast", label: "Fast" }] },
  { key: "forecheck", label: "Forecheck", hint: "pressure in their end", options: [{ value: "passive", label: "Passive" }, { value: "balanced", label: "Balanced" }, { value: "aggressive", label: "Aggressive" }] },
  { key: "puckStyle", label: "Puck style", hint: "how you attack", options: [{ value: "cycle", label: "Cycle" }, { value: "balanced", label: "Balanced" }, { value: "rush", label: "Rush" }, { value: "shotVolume", label: "Shot volume" }] },
  { key: "dZone", label: "D-zone", hint: "defending your end", options: [{ value: "collapse", label: "Collapse" }, { value: "balanced", label: "Balanced" }, { value: "aggressive", label: "Aggressive" }] },
  { key: "ppStyle", label: "Power play", hint: "PP formation", options: [{ value: "balanced", label: "Balanced" }, { value: "umbrella", label: "Umbrella" }, { value: "131", label: "1-3-1" }, { value: "overload", label: "Overload" }] },
  { key: "pkStyle", label: "Penalty kill", hint: "PK structure", options: [{ value: "balanced", label: "Balanced" }, { value: "box", label: "Box" }, { value: "diamond", label: "Diamond" }, { value: "aggressive", label: "Aggressive" }] },
];

const DEFAULT_DIALS: TeamTactics = { tempo: "balanced", forecheck: "balanced", puckStyle: "balanced", dZone: "balanced", ppStyle: "balanced", pkStyle: "balanced" };

/** In-game coaching: change the team system; it takes effect at the next whistle the broadcast hasn't reached. */
export default function CoachPanel({ gameId, teamId, teamName, over, timeoutUsed, outIds }: { gameId: number; teamId: number; teamName: string; over: boolean; timeoutUsed: boolean; outIds: number[] }) {
  const [lines, setLines] = useState<Lines | null>(null);
  const [dials, setDials] = useState<TeamTactics>(DEFAULT_DIALS);
  const [applied, setApplied] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [awaiting, setAwaiting] = useState<number | null>(null); // the applied-count we're waiting to reach
  const [pullSec, setPullSec] = useState(DEFAULT_PULL.pullSec);
  const [fwd, setFwd] = useState<ForwardLine[]>([]);
  const [def, setDef] = useState<DefensePair[]>([]);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [timeoutQueued, setTimeoutQueued] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/live/games/${gameId}/lines?teamId=${teamId}&roster=1`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.error) { setMsg({ ok: false, text: j.error }); return; }
        setLines(j.lines as Lines); setApplied(j.applied ?? 0);
        setFwd((j.lines as Lines).forwardLines ?? []); setDef((j.lines as Lines).defensePairs ?? []); setRoster(j.roster ?? []);
        setDials({ ...DEFAULT_DIALS, ...((j.lines as Lines).system ?? {}) });
        setPullSec((j.lines as Lines).strategy?.goaliePull?.pullSec ?? DEFAULT_PULL.pullSec);
      })
      .catch(() => alive && setMsg({ ok: false, text: "Couldn't load your lines." }));
    return () => { alive = false; };
  }, [gameId, teamId]);

  // keep the "changes made" counter honest: a queued change lands at the next whistle
  useEffect(() => {
    if (over) return;
    const t = setInterval(() => {
      fetch(`/api/live/games/${gameId}/lines?teamId=${teamId}`, { cache: "no-store" })
        .then((r) => r.json()).then((j) => { if (typeof j.applied === "number") setApplied(j.applied); }).catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [gameId, teamId, over]);
  const waiting = awaiting != null && applied < awaiting; // derived: a queued change lands when the applied count catches up

  const set = (k: keyof TeamTactics, v: string) => { setDials((d) => ({ ...d, [k]: v })); setDirty(true); setMsg(null); };
  const editLines = (f: ForwardLine[], d: DefensePair[]) => { setFwd(f); setDef(d); setDirty(true); setMsg(null); };
  const resetLines = () => { if (!lines) return; setFwd(lines.forwardLines); setDef(lines.defensePairs); setMsg(null); };
  const linesEdited = !!lines && (JSON.stringify(fwd) !== JSON.stringify(lines.forwardLines) || JSON.stringify(def) !== JSON.stringify(lines.defensePairs));
  const preset = (name: string) => { setDials((d) => ({ ...d, ...PRESETS[name], preset: name })); setDirty(true); setMsg(null); };

  const withEdits = (l: Lines): Lines => ({
    ...l,
    forwardLines: fwd, defensePairs: def,
    system: { ...(l.system ?? {}), ...dials },
    strategy: { ...(l.strategy ?? {}), goaliePull: { ...DEFAULT_PULL, ...(l.strategy?.goaliePull ?? {}), pullSec } },
  });

  const callTimeout = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/live/games/${gameId}/change`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ teamId, timeout: true }) });
      const j = await r.json();
      if (j.ok) { setTimeoutQueued(true); setMsg({ ok: true, text: "Timeout called — it happens at the next whistle." }); }
      else setMsg({ ok: false, text: j.error ?? "That was refused." });
    } catch { setMsg({ ok: false, text: "Network error — try again." }); }
    setBusy(false);
  };

  const apply = async () => {
    if (!lines) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/live/games/${gameId}/change`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamId, lines: withEdits(lines) }),
      });
      const j = await r.json();
      if (j.ok) { setMsg({ ok: true, text: "Sent to the bench — it takes effect at the next stoppage." }); setAwaiting(applied + 1); setDirty(false); setLines(withEdits(lines)); }
      else setMsg({ ok: false, text: j.error ?? "That change was refused." });
    } catch { setMsg({ ok: false, text: "Network error — try again." }); }
    setBusy(false);
  };

  return (
    <div className="bg-slate-900/70 border border-amber-500/40 rounded-2xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-800 bg-amber-500/10 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-amber-300">🎽 Coach — {teamName}</h2>
        <span className="text-[11px] text-slate-400">
          {waiting ? "⏳ waiting for the next whistle…" : applied > 0 ? `✓ ${applied} change${applied === 1 ? "" : "s"} in effect` : ""}
        </span>
      </div>
      <div className="p-4 space-y-4">
        {over ? <p className="text-sm text-slate-400">The game is over.</p> : !lines && !msg ? <p className="text-sm text-slate-500">Loading your bench…</p> : (
          <>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] uppercase tracking-wide text-slate-500 self-center mr-1">Presets</span>
              {Object.keys(PRESETS).map((n) => (
                <button key={n} onClick={() => preset(n)} disabled={!lines}
                  className={`px-2.5 py-1 rounded-lg text-xs border ${dials.preset === n ? "border-amber-400 bg-amber-400/15 text-amber-200" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}>{n}</button>
              ))}
            </div>
            {DIALS.map((d) => (
              <div key={d.key}>
                <p className="text-xs text-slate-400 mb-1"><span className="font-semibold text-slate-200">{d.label}</span> · {d.hint}</p>
                <div className="flex flex-wrap gap-1.5">
                  {d.options.map((o) => (
                    <button key={o.value} onClick={() => set(d.key, o.value)} disabled={!lines}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${dials[d.key] === o.value ? "border-blue-400 bg-blue-500/20 text-white" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}>{o.label}</button>
                  ))}
                </div>
              </div>
            ))}
            <details className="rounded-lg border border-slate-800 bg-slate-950/40 open:pb-3">
              <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-200">
                Lines &amp; pairs {linesEdited && <span className="ml-1 text-amber-300">· edited</span>}
              </summary>
              <div className="px-3 pt-1">
                {roster.length === 0 ? <p className="text-xs text-slate-500">Loading your roster…</p> : (
                  <>
                    <LinesEditor forwards={fwd} defense={def} roster={roster} outIds={outIds} disabled={!lines} onChange={editLines} />
                    {linesEdited && <button onClick={resetLines} className="mt-2 text-[11px] text-slate-400 hover:text-white underline">Undo my line edits</button>}
                  </>
                )}
              </div>
            </details>
            <div>
              <p className="text-xs text-slate-400 mb-1"><span className="font-semibold text-slate-200">Pull the goalie</span> · when trailing in the 3rd, with this much time left</p>
              <div className="flex items-center gap-3">
                <input type="range" min={30} max={300} step={15} value={pullSec} disabled={!lines}
                  onChange={(e) => { setPullSec(Number(e.target.value)); setDirty(true); setMsg(null); }} className="flex-1 accent-blue-500" />
                <span className="w-20 text-right text-sm tabular-nums text-slate-200">{Math.floor(pullSec / 60)}:{String(pullSec % 60).padStart(2, "0")}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Down one goal you pull at this mark; down two about 70% of it, down three about a third.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button onClick={callTimeout} disabled={busy || timeoutUsed || timeoutQueued}
                className="px-4 py-2 rounded-lg border border-amber-500/60 text-amber-200 hover:bg-amber-500/10 disabled:opacity-40 disabled:hover:bg-transparent text-sm font-semibold">
                {timeoutUsed ? "⏱ Timeout used" : timeoutQueued ? "⏱ Timeout called" : "⏱ Call timeout"}
              </button>
              <button onClick={apply} disabled={busy || !dirty || !lines}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-sm font-semibold">
                {busy ? "Sending…" : "Send to the bench"}
              </button>
              {msg && <p className={`text-xs ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</p>}
            </div>
            <p className="text-[11px] text-slate-500">A timeout lets the unit on the ice catch its breath (once per game). Changes happen on the whistle — icing, penalty, goal, period break. A team that just iced the puck can&apos;t change until the next stoppage. Your opponent can&apos;t see what you change.</p>
          </>
        )}
        {over && msg && <p className="text-xs text-red-300">{msg.text}</p>}
      </div>
    </div>
  );
}
