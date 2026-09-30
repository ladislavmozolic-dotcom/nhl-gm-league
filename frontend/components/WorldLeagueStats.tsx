"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { saveWorldPlayerToDraftList } from "@/app/around-the-world/actions";
import { epProfileUrl } from "@/lib/playerName";

type Stat = {
  id: number; worldPlayerId: number; playerName: string; position: string | null; epUrl: string | null;
  birthDate: string | null; age: number | null; rights: { name: string; logoUrl: string | null } | null;
  draftable: boolean; saved: boolean;
  teamId: number | null; teamName: string; teamLogoUrl: string | null;
  leagueName?: string; leagueCode?: string; country?: string; level?: string;
  isGoalie: boolean; gamesPlayed: number; goals: number; assists: number; points: number;
  plusMinus: number | null; penaltyMinutes: number; wins: number | null; losses: number | null;
  overtimeLosses: number | null; savePercentage: number | null; goalsAgainstAverage: number | null; shutouts: number | null;
};
type Team = { id: number; name: string; logoUrl: string | null; players: number; leagueCode?: string; country?: string; level?: string };
type SortKey = "playerName" | "teamName" | "gamesPlayed" | "goals" | "assists" | "points" | "plusMinus" | "penaltyMinutes" | "wins" | "losses" | "savePercentage" | "goalsAgainstAverage" | "shutouts";

export default function WorldLeagueStats({ stats, teams, season, leagueCode, draftYear, canSave }: { stats: Stat[]; teams: Team[]; season: string; leagueCode: string; draftYear: number; canSave: boolean }) {
  const [tab, setTab] = useState<"skaters" | "goalies" | "teams">("skaters");
  const [teamId, setTeamId] = useState("");
  const [country, setCountry] = useState("");
  const [league, setLeague] = useState("");
  const [level, setLevel] = useState("");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("points");
  const [descending, setDescending] = useState(true);
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const save = async (playerId: number) => {
    setSavingId(playerId); setSaveError(null);
    try {
      const result = await saveWorldPlayerToDraftList(playerId);
      if (result.ok) setSavedIds((ids) => [...ids, playerId]);
      else setSaveError(result.error);
    } catch { setSaveError("Saving failed. Please try again."); }
    finally { setSavingId(null); }
  };
  const [eligibility, setEligibility] = useState<"all" | "draftable" | "rights">("all");
  const isEurope = leagueCode === "EUROPE";
  const countries = [...new Set(stats.map((s) => s.country).filter((value): value is string => Boolean(value)))].sort();
  const leagues = [...new Set(stats.map((s) => s.leagueCode).filter((value): value is string => Boolean(value)))].sort();
  const levels = [...new Set(stats.map((s) => s.level).filter((value): value is string => Boolean(value)))].sort();
  const filtered = useMemo(() => stats.filter((s) =>
    (tab === "goalies" ? s.isGoalie : !s.isGoalie) &&
    (!teamId || String(s.teamId) === teamId) &&
    (!country || s.country === country) && (!league || s.leagueCode === league) && (!level || s.level === level) &&
    (eligibility === "all" || (eligibility === "draftable" && s.draftable) || (eligibility === "rights" && s.rights)) &&
    (!query || `${s.playerName} ${s.teamName}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  ).sort((a, b) => {
    const left = a[sortKey] ?? (typeof a[sortKey] === "number" ? 0 : "");
    const right = b[sortKey] ?? (typeof b[sortKey] === "number" ? 0 : "");
    const comparison = typeof left === "string" && typeof right === "string" ? left.localeCompare(right) : Number(left) - Number(right);
    return (descending ? -comparison : comparison) || a.playerName.localeCompare(b.playerName);
  }), [stats, tab, teamId, country, league, level, eligibility, query, sortKey, descending]);
  const setSort = (key: SortKey) => { if (key === sortKey) setDescending(!descending); else { setSortKey(key); setDescending(key !== "playerName" && key !== "teamName" && key !== "goalsAgainstAverage"); } };
  const header = (label: string, key: SortKey, left = false) => <th scope="col" className={`${left ? "text-left" : "text-right"} px-3 py-3 whitespace-nowrap`}><button type="button" onClick={() => setSort(key)} className="hover:text-sky-300" title={`Sort by ${label}`}>{label}{sortKey === key ? (descending ? " ↓" : " ↑") : ""}</button></th>;
  const goalieCount = stats.filter((s) => s.isGoalie).length;
  const skaterCount = stats.length - goalieCount;

  return <section className="space-y-4">
    <div className="flex flex-wrap gap-2" role="tablist" aria-label={`${leagueCode} statistics`}>
      {([ ["skaters", `Skaters (${skaterCount})`], ["goalies", `Goalies (${goalieCount})`], ["teams", `Teams (${teams.length})`] ] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => { setTab(value); setSortKey(value === "goalies" ? "savePercentage" : "points"); setDescending(true); }} className={`rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${tab === value ? "border-sky-500/40 bg-sky-500/15 text-sky-300" : "border-slate-800 bg-slate-900/70 text-slate-400 hover:text-white"}`}>{label}</button>)}
    </div>

    {tab === "teams" ? <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">{teams.filter((team) => (!country || team.country === country) && (!league || team.leagueCode === league) && (!level || team.level === level)).map((team) => <button key={team.id} type="button" onClick={() => { setTeamId(String(team.id)); setTab("skaters"); }} className="flex items-center gap-3 rounded-2xl bg-slate-900/70 border border-slate-800 p-4 text-left hover:border-sky-500/40"><span className="w-10 h-10 flex items-center justify-center">{team.logoUrl ? <img src={team.logoUrl} alt="" className="w-10 h-10 object-contain" /> : "🏒"}</span><span className="min-w-0"><span className="block font-semibold truncate">{team.name}{team.level && <span className="ml-2 text-xs text-amber-300">{team.level}</span>}</span><span className="text-xs text-slate-500">{team.country && `${team.country} · `}{team.leagueCode && `${team.leagueCode} · `}{team.players} player stat lines</span></span></button>)}</div> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 text-xs">
        <p className="text-slate-400">
          Showing 2026-27 active players. Eligible prospects can be added to your private team board using <b className="text-sky-300">+ Draft list</b>.
        </p>
        <Link href={`/draft/rankings?year=${draftYear}`} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition-all shrink-0">
          <span>📋</span>
          <span>Open Draft Board ({draftYear}) →</span>
        </Link>
      </div>
      {saveError && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{saveError}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/80 p-1">
          <button type="button" onClick={() => setEligibility("all")} className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${eligibility === "all" ? "bg-sky-500/20 text-sky-300 border border-sky-500/30" : "text-slate-400 hover:text-white"}`}>All</button>
          <button type="button" onClick={() => setEligibility("draftable")} className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${eligibility === "draftable" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "text-slate-400 hover:text-white"}`}>🎯 Draft Eligible</button>
          <button type="button" onClick={() => setEligibility("rights")} className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${eligibility === "rights" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-slate-400 hover:text-white"}`}>⭐ UNHL Rights</button>
        </div>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search player or team…" aria-label="Search player or team" className="min-w-[180px] flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-sky-500" />
        {isEurope && <><select value={country} onChange={(e) => { setCountry(e.target.value); setTeamId(""); }} aria-label="Filter by country" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"><option value="">All countries</option>{countries.map((value) => <option key={value} value={value}>{value}</option>)}</select><select value={league} onChange={(e) => { setLeague(e.target.value); setTeamId(""); }} aria-label="Filter by league" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"><option value="">All leagues</option>{leagues.map((value) => <option key={value} value={value}>{value}</option>)}</select><select value={level} onChange={(e) => { setLevel(e.target.value); setTeamId(""); }} aria-label="Filter by level" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"><option value="">All levels</option>{levels.map((value) => <option key={value} value={value}>{value}</option>)}</select></>}
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label="Filter by team" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"><option value="">All teams</option>{teams.filter((t) => (!country || t.country === country) && (!league || t.leagueCode === league) && (!level || t.level === level)).map((t) => <option value={t.id} key={t.id}>{t.name}</option>)}</select>
        <span className="text-xs text-slate-500">{filtered.length} players · {season}</span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/70"><table className="w-full min-w-[980px] text-sm"><thead className="bg-slate-800/40 text-xs uppercase tracking-wider text-slate-400"><tr>{header("Player", "playerName", true)}<th className="text-left px-3 py-3">Age / UNHL rights</th>{header("Team", "teamName", true)}{isEurope && <><th className="text-left px-3 py-3">Country / League</th><th className="text-left px-3 py-3">Level</th></>}<th className="text-left px-3 py-3">Pos</th>{header("GP", "gamesPlayed")}{tab === "skaters" ? <>{header("G", "goals")}{header("A", "assists")}{header("P", "points")}{header("+/-", "plusMinus")}{header("PIM", "penaltyMinutes")}</> : <>{header("W", "wins")}{header("L", "losses")}{header("SV%", "savePercentage")}{header("GAA", "goalsAgainstAverage")}{header("SO", "shutouts")}</>}<th className="px-3 py-3 text-left">Draft list</th></tr></thead><tbody>{filtered.map((s) => <tr key={s.id} className="border-t border-slate-800/70 hover:bg-slate-800/30"><td className="px-3 py-2.5 font-semibold whitespace-nowrap"><a href={s.epUrl || epProfileUrl(s.playerName)} target="_blank" rel="noopener noreferrer" className="hover:text-sky-300 hover:underline inline-flex items-center gap-1.5 group/pname" title="Open EliteProspects profile"><span>{s.playerName}</span><span className="text-[10px] text-sky-400/60 group-hover/pname:text-sky-300 font-mono">↗</span></a></td><td className="px-3 py-2.5 text-xs whitespace-nowrap">{s.rights ? <span className="inline-flex items-center gap-1.5 text-amber-300" title={`UNHL rights: ${s.rights.name}`}>{s.rights.logoUrl && <img src={s.rights.logoUrl} alt="" className="h-6 w-6 object-contain" />}{s.rights.name}</span> : <span className="text-emerald-300">{s.age} · Available</span>}</td><td className="px-3 py-2.5 text-slate-300 whitespace-nowrap"><span className="inline-flex items-center gap-2">{s.teamLogoUrl && <img src={s.teamLogoUrl} alt="" className="h-5 w-5 object-contain" />}{s.teamName}</span></td>{isEurope && <><td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{s.country} · {s.leagueCode}</td><td className="px-3 py-2.5 text-amber-300">{s.level}</td></>}<td className="px-3 py-2.5 text-slate-400">{s.position || (s.isGoalie ? "G" : "—")}</td><td className="px-3 py-2.5 text-right tabular-nums">{s.gamesPlayed}</td>{tab === "skaters" ? <><td className="px-3 py-2.5 text-right tabular-nums">{s.goals}</td><td className="px-3 py-2.5 text-right tabular-nums">{s.assists}</td><td className="px-3 py-2.5 text-right tabular-nums font-bold text-sky-300">{s.points}</td><td className={`px-3 py-2.5 text-right tabular-nums ${s.plusMinus != null && s.plusMinus > 0 ? "text-emerald-400 font-medium" : s.plusMinus != null && s.plusMinus < 0 ? "text-rose-400 font-medium" : "text-slate-400"}`}>{s.plusMinus != null ? (s.plusMinus > 0 ? `+${s.plusMinus}` : s.plusMinus) : "—"}</td><td className="px-3 py-2.5 text-right tabular-nums">{s.penaltyMinutes}</td></> : <><td className="px-3 py-2.5 text-right tabular-nums">{s.wins ?? "—"}</td><td className="px-3 py-2.5 text-right tabular-nums">{s.losses ?? "—"}</td><td className="px-3 py-2.5 text-right tabular-nums font-bold text-sky-300">{s.savePercentage == null ? "—" : `${(s.savePercentage <= 1 ? s.savePercentage * 100 : s.savePercentage).toFixed(1)}%`}</td><td className="px-3 py-2.5 text-right tabular-nums">{s.goalsAgainstAverage?.toFixed(2) ?? "—"}</td><td className="px-3 py-2.5 text-right tabular-nums">{s.shutouts ?? "—"}</td></>}<td className="px-3 py-2.5 whitespace-nowrap">{s.draftable && (s.saved || savedIds.includes(s.worldPlayerId) ? <Link href={`/draft/rankings?year=${draftYear}`} className="text-xs font-semibold text-emerald-300 hover:underline">✓ Saved</Link> : canSave ? <button type="button" disabled={savingId != null} onClick={() => save(s.worldPlayerId)} className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-300 hover:bg-sky-500/20 disabled:opacity-40">{savingId === s.worldPlayerId ? "Saving…" : "+ Draft list"}</button> : <span className="text-xs text-slate-500">Sign in to save</span>)}</td></tr>)}</tbody></table>{!filtered.length && <div className="p-8 text-center text-sm text-slate-500">No players match this filter.</div>}</div>

    </>}
  </section>;
}
