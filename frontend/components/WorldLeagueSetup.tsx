"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  importAhlAction,
  importAllWorldDataAction,
  importChlAction,
  importEuropeAction,
  importNcaaAction,
  importRussiaAction,
  importKhlAction,
  importDelAction,
  manualLinkProspectAction,
  reconcileProspectsAction,
  seedWorldLeaguesAction,
} from "@/app/admin/world-data/actions";

export type WorldLeagueWithCount = {
  id: number;
  code: string;
  name: string;
  country: string | null;
  region: string;
  active: boolean;
  _count: { teams: number; stats: number };
};

export type UnlinkedProspect = {
  id: number;
  name: string;
  position: string | null;
  epUrl: string | null;
  team: { name: string } | null;
};

interface Props {
  leagues: WorldLeagueWithCount[];
  totalProspects: number;
  linkedProspects: number;
  unlinkedProspects: UnlinkedProspect[];
}

export default function WorldLeagueSetup({
  leagues,
  totalProspects,
  linkedProspects,
  unlinkedProspects,
}: Props) {
  const router = useRouter();
  const selectId = useId();
  const [pending, start] = useTransition();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "err" } | null>(null);

  // Manual link form state
  const [selectedProspectId, setSelectedProspectId] = useState<number | "">(
    unlinkedProspects[0]?.id ?? ""
  );
  const [prospectSearch, setProspectSearch] = useState("");
  const [leagueCode, setLeagueCode] = useState("KHL");
  const [teamName, setTeamName] = useState("");
  const [epUrl, setEpUrl] = useState("");
  const [season, setSeason] = useState("2026-27");
  const [gamesPlayed, setGamesPlayed] = useState<string>("");
  const [goals, setGoals] = useState<string>("");
  const [assists, setAssists] = useState<string>("");
  const [points, setPoints] = useState<string>("");
  const [isPendingSeason, setIsPendingSeason] = useState(false);

  const pct = totalProspects > 0 ? Math.round((linkedProspects / totalProspects) * 100) : 0;
  const totalStats = leagues.reduce((sum, l) => sum + l._count.stats, 0);
  const totalTeams = leagues.reduce((sum, l) => sum + l._count.teams, 0);

  const runAction = (name: string, fn: () => Promise<{ ok: boolean; error?: string; [key: string]: unknown }>) => {
    setActiveAction(name);
    setMessage(null);
    start(async () => {
      try {
        const res = await fn();
        if (res.ok) {
          setMessage({ text: `${name} completed successfully!`, tone: "ok" });
          router.refresh();
        } else {
          setMessage({ text: res.error || `${name} failed.`, tone: "err" });
        }
      } catch (e) {
        setMessage({ text: e instanceof Error ? e.message : "Action failed.", tone: "err" });
      } finally {
        setActiveAction(null);
      }
    });
  };

  const handleManualLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProspectId || !teamName.trim() || !leagueCode.trim()) return;

    setActiveAction("manual-link");
    setMessage(null);
    start(async () => {
      try {
        const res = await manualLinkProspectAction({
          prospectId: Number(selectedProspectId),
          teamName: teamName.trim(),
          leagueCode: leagueCode.trim().toUpperCase(),
          epUrl: epUrl.trim() || undefined,
          season: season.trim() || "2026-27",
          gamesPlayed: isPendingSeason || gamesPlayed === "" ? undefined : Number(gamesPlayed),
          goals: isPendingSeason || goals === "" ? undefined : Number(goals),
          assists: isPendingSeason || assists === "" ? undefined : Number(assists),
          points: isPendingSeason || points === "" ? undefined : Number(points),
        });

        if (res.ok) {
          setMessage({
            text: `Successfully linked ${res.playerName} to ${res.team}!`,
            tone: "ok",
          });
          setTeamName("");
          setEpUrl("");
          setGamesPlayed("");
          setGoals("");
          setAssists("");
          setPoints("");
          router.refresh();
        } else {
          setMessage({ text: res.error || "Manual link failed.", tone: "err" });
        }
      } catch (err) {
        setMessage({ text: err instanceof Error ? err.message : "Error linking prospect.", tone: "err" });
      } finally {
        setActiveAction(null);
      }
    });
  };

  const filteredUnlinked = unlinkedProspects.filter((p) =>
    !prospectSearch ||
    p.name.toLowerCase().includes(prospectSearch.toLowerCase()) ||
    (p.team?.name && p.team.name.toLowerCase().includes(prospectSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Overview Stat Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-950/40 via-slate-900 to-slate-950 p-5 shadow-lg shadow-black/20">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Prospect Coverage</div>
          <div className="mt-2 text-2xl font-black text-sky-300">
            {linkedProspects} <span className="text-sm font-normal text-slate-400">/ {totalProspects}</span>
          </div>
          <div className="mt-1 text-xs text-sky-400/80 font-semibold">{pct}% linked to real clubs</div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 p-5 shadow-lg shadow-black/20">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Tracked Leagues</div>
          <div className="mt-2 text-2xl font-black text-emerald-300">{leagues.length}</div>
          <div className="mt-1 text-xs text-emerald-400/80 font-semibold">Junior, AHL, NCAA & Europe</div>
        </div>

        <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/40 via-slate-900 to-slate-950 p-5 shadow-lg shadow-black/20">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Real Teams</div>
          <div className="mt-2 text-2xl font-black text-violet-300">{totalTeams}</div>
          <div className="mt-1 text-xs text-violet-400/80 font-semibold">Across all competitions</div>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 p-5 shadow-lg shadow-black/20">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Season Stat Lines</div>
          <div className="mt-2 text-2xl font-black text-amber-300">{totalStats}</div>
          <div className="mt-1 text-xs text-amber-400/80 font-semibold">Live skater & goalie stats</div>
        </div>
      </div>

      {/* Hero Sync Box */}
      <div className="rounded-3xl border border-sky-500/30 bg-gradient-to-br from-sky-950/60 via-slate-900 to-indigo-950/40 p-6 sm:p-7 shadow-xl shadow-black/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <span className="inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-sky-300">
              One-Click Pipeline
            </span>
            <h2 className="mt-2 text-xl font-black text-white">Full World Data Synchronization</h2>
            <p className="mt-1 text-sm text-slate-300 leading-relaxed">
              Updates all competitions in order: CHL (WHL, OHL, QMJHL), AHL, NCAA Division I rosters,
              European leagues (Liiga, SHL, Czech, Slovak), Russian leagues (KHL/MHL), and runs prospect identity reconciliation.
            </p>
          </div>
          <button
            onClick={() => runAction("Sync All World Data", importAllWorldDataAction)}
            disabled={pending}
            className="rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-sky-600/30 hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {pending && activeAction === "Sync All World Data" ? "Syncing All World Data…" : "⚡ Sync All World Data"}
          </button>
        </div>

        {message && (
          <div
            className={`mt-4 rounded-xl border p-3.5 text-sm font-medium ${
              message.tone === "ok"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : "border-rose-500/40 bg-rose-500/10 text-rose-200"
            }`}
          >
            {message.text}
          </div>
        )}
      </div>

      {/* Individual League Actions */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-black/20">
        <h3 className="text-base font-bold text-white">Targeted Feed Importers</h3>
        <p className="mt-1 text-xs text-slate-400">
          Run individual importers if you want to refresh a specific league without running the full pipeline.
        </p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex flex-col justify-between">
            <div>
              <div className="font-bold text-slate-200">CHL Junior Leagues</div>
              <div className="text-xs text-slate-500 mt-0.5">WHL · OHL · QMJHL via HockeyTech</div>
            </div>
            <button
              onClick={() => runAction("CHL Import", importChlAction)}
              disabled={pending}
              className="mt-3 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              {pending && activeAction === "CHL Import" ? "Importing…" : "Sync CHL"}
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex flex-col justify-between">
            <div>
              <div className="font-bold text-slate-200">AHL</div>
              <div className="text-xs text-slate-500 mt-0.5">American Hockey League via HockeyTech</div>
            </div>
            <button
              onClick={() => runAction("AHL Import", importAhlAction)}
              disabled={pending}
              className="mt-3 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              {pending && activeAction === "AHL Import" ? "Importing…" : "Sync AHL"}
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex flex-col justify-between">
            <div>
              <div className="font-bold text-slate-200">NCAA Division I</div>
              <div className="text-xs text-slate-500 mt-0.5">Assigns colleges (stats remain pending)</div>
            </div>
            <button
              onClick={() => runAction("NCAA Import", importNcaaAction)}
              disabled={pending}
              className="mt-3 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              {pending && activeAction === "NCAA Import" ? "Importing…" : "Sync NCAA"}
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex flex-col justify-between">
            <div>
              <div className="font-bold text-slate-200">European Leagues</div>
              <div className="text-xs text-slate-500 mt-0.5">Liiga, SHL, Czech & Slovak Extraliga</div>
            </div>
            <button
              onClick={() => runAction("Europe Import", importEuropeAction)}
              disabled={pending}
              className="mt-3 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              {pending && activeAction === "Europe Import" ? "Importing…" : "Sync Europe"}
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex flex-col justify-between">
            <div>
              <div className="font-bold text-slate-200">Russian & Global Profiles</div>
              <div className="text-xs text-slate-500 mt-0.5">KHL, MHL, VHL, ECHL & international</div>
            </div>
            <button
              onClick={() => runAction("Russia Import", importRussiaAction)}
              disabled={pending}
              className="mt-3 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              {pending && activeAction === "Russia Import" ? "Importing…" : "Sync Russia"}
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex flex-col justify-between">
            <div>
              <div className="font-bold text-slate-200">KHL Full League</div>
              <div className="text-xs text-slate-500 mt-0.5">All 22 clubs via EliteProspects</div>
            </div>
            <button
              onClick={() => runAction("KHL Import", importKhlAction)}
              disabled={pending}
              className="mt-3 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              {pending && activeAction === "KHL Import" ? "Importing…" : "Sync KHL"}
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex flex-col justify-between">
            <div>
              <div className="font-bold text-slate-200">German DEL</div>
              <div className="text-xs text-slate-500 mt-0.5">All 14 clubs via EliteProspects</div>
            </div>
            <button
              onClick={() => runAction("DEL Import", importDelAction)}
              disabled={pending}
              className="mt-3 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              {pending && activeAction === "DEL Import" ? "Importing…" : "Sync DEL"}
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex flex-col justify-between">
            <div>
              <div className="font-bold text-slate-200">Reconcile Identity</div>
              <div className="text-xs text-slate-500 mt-0.5">Match unlinked names to WorldPlayers</div>
            </div>
            <button
              onClick={() => runAction("Reconciliation", reconcileProspectsAction)}
              disabled={pending}
              className="mt-3 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              {pending && activeAction === "Reconciliation" ? "Reconciling…" : "Reconcile"}
            </button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
          <span className="text-xs text-slate-500">Need to update competition metadata or add new leagues?</span>
          <button
            onClick={() => runAction("Catalog Seed", seedWorldLeaguesAction)}
            disabled={pending}
            className="text-xs font-semibold text-sky-400 hover:text-sky-300 disabled:opacity-50"
          >
            {pending && activeAction === "Catalog Seed" ? "Seeding…" : "Refresh League Catalog →"}
          </button>
        </div>
      </div>

      {/* Manual Prospect Linker */}
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-950/20 via-slate-900 to-slate-950 p-5 shadow-lg shadow-black/20">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/10 text-base">✏️</span>
          <div>
            <h3 className="text-base font-bold text-white">Manual Prospect Linker</h3>
            <p className="text-xs text-slate-400">
              Assign any unlinked prospect directly to a club and competition with custom stats or a pending season.
            </p>
          </div>
        </div>

        <form onSubmit={handleManualLink} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${selectId}-search`} className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Select Prospect ({unlinkedProspects.length} unlinked)
              </label>
              <input
                id={`${selectId}-search`}
                type="text"
                placeholder="Filter prospects by name or UNHL team…"
                value={prospectSearch}
                onChange={(e) => setProspectSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-400/50 outline-none mb-2"
              />
              <select
                value={selectedProspectId}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setSelectedProspectId(id);
                  const p = unlinkedProspects.find((item) => item.id === id);
                  if (p?.epUrl) setEpUrl(p.epUrl);
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400/50 outline-none"
              >
                {filteredUnlinked.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.position ? `(${p.position})` : ""} · {p.team?.name || "No UNHL team"}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Competition
                </label>
                <input
                  type="text"
                  placeholder="e.g. KHL, NCAA, AHL"
                  value={leagueCode}
                  onChange={(e) => setLeagueCode(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white uppercase focus:border-amber-400/50 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Season
                </label>
                <input
                  type="text"
                  placeholder="2026-27"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400/50 outline-none"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Real-world Club Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. SKA St. Petersburg, Univ. of Michigan"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400/50 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-800">
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
              <input
                type="checkbox"
                checked={isPendingSeason}
                onChange={(e) => setIsPendingSeason(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0"
              />
              <span>Season pending / No stats yet (e.g. NCAA college assignment)</span>
            </label>

            {!isPendingSeason && (
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="number"
                  placeholder="GP"
                  value={gamesPlayed}
                  onChange={(e) => setGamesPlayed(e.target.value)}
                  className="w-16 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-center text-white focus:border-amber-400/50 outline-none"
                />
                <input
                  type="number"
                  placeholder="G"
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  className="w-14 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-center text-white focus:border-amber-400/50 outline-none"
                />
                <input
                  type="number"
                  placeholder="A"
                  value={assists}
                  onChange={(e) => setAssists(e.target.value)}
                  className="w-14 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-center text-white focus:border-amber-400/50 outline-none"
                />
                <input
                  type="number"
                  placeholder="P"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  className="w-14 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-center text-white focus:border-amber-400/50 outline-none"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={pending || !selectedProspectId || !teamName.trim()}
              className="ml-auto rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-colors"
            >
              {pending && activeAction === "manual-link" ? "Linking…" : "Link Prospect"}
            </button>
          </div>
        </form>
      </div>

      {/* Tracked Leagues Directory */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-black/20">
        <h3 className="text-base font-bold text-white">Tracked Competitions Directory</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-2.5 px-3 text-left">Code</th>
                <th className="py-2.5 px-3 text-left">League Name</th>
                <th className="py-2.5 px-3 text-left">Region</th>
                <th className="py-2.5 px-3 text-right">Teams</th>
                <th className="py-2.5 px-3 text-right">Stat Lines</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {leagues.map((l) => (
                <tr key={l.id} className="hover:bg-slate-800/30">
                  <td className="py-2.5 px-3 font-mono font-bold text-sky-400">{l.code}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-200">{l.name}</td>
                  <td className="py-2.5 px-3 text-slate-400">
                    {l.country || l.region}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-300">{l._count.teams}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-emerald-300">
                    {l._count.stats}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <Link
                      href={`/around-the-world/${l.code.toLowerCase()}`}
                      className="text-sky-400 hover:text-sky-300 font-semibold"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
