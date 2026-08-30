"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { friendlyActionError } from "@/lib/client/action-error";

type ImportResult = { imported: number; days: number; errors: string[] };
type State = { played: number; scheduled: number; playoffSeries: number; champion: string | null };
type Actions = {
  generateScheduleAction: (gamesPerTeam: number) => Promise<{ games: number; gamesPerTeam: number }>;
  playSeasonAction: () => Promise<{ played: number }>;
  runPlayoffsAction: () => Promise<{ champion: number | null }>;
  resetSeasonAction: () => Promise<void>;
  runRetirementsAction: () => Promise<{ retired: { name: string; age: number }[]; inducted: string[] }>;
  developProspectsAction: () => Promise<{ created: number; developed: number; nowNhlCalibre: number; topGains: { name: string; from: number; to: number }[] }>;
  importNhlApiAction: () => Promise<ImportResult>;
  importCsvAction: (formData: FormData) => Promise<ImportResult>;
};

export default function SeasonControls({ state, actions }: { state: State; actions: Actions }) {
  const [games, setGames] = useState(84);
  const [running, setRunning] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [, start] = useTransition();

  const importMsg = (r: ImportResult) =>
    r.imported ? `Imported ${r.imported} games across ${r.days} days.${r.errors.length ? ` ${r.errors.length} warning(s): ${r.errors[0]}` : ""}`
      : `Import failed: ${r.errors[0] ?? "no games"}`;

  const run = (name: string, fn: () => Promise<void>) => {
    setRunning(name); setMsg(null);
    start(async () => {
      try { await fn(); } catch (e) { setMsg(friendlyActionError(e)); }
      finally { setRunning(null); }
    });
  };

  const seasonDone = state.scheduled === 0 && state.played > 0;
  const busy = running !== null;

  const Btn = ({ id, label, onClick, disabled, danger }: { id: string; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) => (
    <button onClick={onClick} disabled={busy || disabled}
      className={`px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-40 ${danger ? "bg-red-900/60 hover:bg-red-800 border border-red-700/50" : "bg-blue-600 hover:bg-blue-500"}`}>
      {running === id ? "Working…" : label}
    </button>
  );

  return (
    <div className="space-y-5">
      {/* status */}
      <div className="grid grid-cols-3 gap-3">
        {[["Played", state.played], ["Scheduled", state.scheduled], ["Playoff series", state.playoffSeries]].map(([k, v]) => (
          <div key={k} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold tabular-nums">{v}</div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">{k}</div>
          </div>
        ))}
      </div>
      {state.champion && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2 text-sm">
          🏆 <span className="font-bold">{state.champion}</span> — Stanley Cup champion.
          <Link href="/playoffs" className="ml-auto text-amber-300 hover:underline">View bracket →</Link>
        </div>
      )}

      {/* 0. import schedule */}
      <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400 mb-3">Import Schedule</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Btn id="nhl" label="Import from NHL.com (2026-27)" onClick={() => run("nhl", async () => {
            const r = await actions.importNhlApiAction(); setMsg(importMsg(r));
          })} />
          {running === "nhl" && <span className="text-xs text-slate-500">Fetching 32 team schedules…</span>}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-800">
          <div className="text-xs text-slate-400 mb-2">…or upload a CSV (columns: <code>date,away,home</code>).
            <a href="/api/schedule-template" className="text-blue-400 hover:underline ml-1">Download template</a>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input type="file" accept=".csv,text/csv" onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
              className="text-sm text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-100 file:text-sm" />
            <Btn id="csv" label="Import CSV" disabled={!csvFile} onClick={() => run("csv", async () => {
              const fd = new FormData(); fd.append("csv", csvFile!); const r = await actions.importCsvAction(fd); setMsg(importMsg(r));
            })} />
          </div>
        </div>
      </section>

      {/* 1. schedule */}
      <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400 mb-3">1 · Regular Season</h2>
        <p className="text-xs text-slate-500 mb-3">The imported real schedule is recommended. Or generate a synthetic one below.</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">Games / team
            <input type="number" min={2} max={200} value={games} onChange={(e) => setGames(Number(e.target.value))}
              className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right" /></label>
          <Btn id="gen" label="Generate schedule" onClick={() => run("gen", async () => {
            const r = await actions.generateScheduleAction(games); setMsg(`Schedule created: ${r.games} games (~${r.gamesPerTeam}/team). CON reset.`);
          })} />
          <Btn id="play" label={`Play season (${state.scheduled} left)`} disabled={state.scheduled === 0}
            onClick={() => run("play", async () => { const r = await actions.playSeasonAction(); setMsg(`Played ${r.played} games.`); })} />
        </div>
        {running === "play" && <p className="text-xs text-slate-500 mt-2">Simulating the full season — this can take ~15–20s…</p>}
      </section>

      {/* 2. playoffs */}
      <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400 mb-3">2 · Playoffs</h2>
        <div className="flex items-center gap-3">
          <Btn id="po" label="Run playoffs" disabled={!seasonDone}
            onClick={() => run("po", async () => { const r = await actions.runPlayoffsAction(); setMsg(r.champion ? "Playoffs complete — champion crowned." : "Playoffs run."); })} />
          {!seasonDone && <span className="text-xs text-slate-500">Finish the regular season first.</span>}
          <Link href="/admin/simulation" className="text-xs text-slate-400 hover:text-blue-400 ml-auto">Format &amp; engine settings →</Link>
        </div>
      </section>

      {/* 3. offseason — retirements + Hall of Fame */}
      <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400 mb-3">3 · Offseason</h2>
        <div className="flex items-center gap-3">
          <Btn id="retire" label="Run retirements" disabled={!seasonDone}
            onClick={() => { if (confirm("Retire aging players (age 38+) and induct any who clear the Hall of Fame bar? This changes rosters.")) run("retire", async () => { const r = await actions.runRetirementsAction(); setMsg(`${r.retired.length} retired${r.inducted.length ? ` · ${r.inducted.length} inducted: ${r.inducted.join(", ")}` : ""}.`); }); }} />
          <span className="text-xs text-slate-500">Aging players retire; Hall-of-Fame résumés get inducted.</span>
          <Link href="/hall-of-fame" className="text-xs text-slate-400 hover:text-blue-400 ml-auto">Hall of Fame →</Link>
        </div>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-800/60">
          <Btn id="develop" label="Develop prospects"
            onClick={() => run("develop", async () => { const r = await actions.developProspectsAction(); setMsg(`${r.created ? `${r.created} new prospect players · ` : ""}${r.developed} developed · ${r.nowNhlCalibre} now NHL-calibre${r.topGains[0] ? ` · top: ${r.topGains[0].name} ${r.topGains[0].from}→${r.topGains[0].to}` : ""}.`); })} />
          <span className="text-xs text-slate-500">Draft picks grow toward their potential (one step per offseason).</span>
        </div>
      </section>

      {/* reset */}
      <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div><h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Reset</h2>
            <p className="text-xs text-slate-500">Delete all games &amp; playoff data for the season.</p></div>
          <Btn id="reset" label="Reset season" danger onClick={() => {
            if (confirm("Delete all games and playoff data for this season?")) run("reset", async () => { await actions.resetSeasonAction(); setMsg("Season reset."); });
          }} />
        </div>
      </section>

      {msg && <div className="text-sm text-green-400">{msg}</div>}
    </div>
  );
}
