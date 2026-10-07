"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PlayerAvatar from "@/components/playerAvatar";
import { cleanName } from "@/lib/playerName";

export type ThreeStarRow = {
  id: number;
  slug: string;
  name: string;
  position: string;
  photoUrl: string | null;
  teamCode: string | null;
  teamSlug: string | null;
  teamLogoUrl: string | null;
  firsts: number;
  seconds: number;
  thirds: number;
  pts: number;
};

const isForward = (pos: string) => ["C", "LW", "RW", "W", "F"].includes(pos.toUpperCase());
const isDefense = (pos: string) => ["D", "LD", "RD"].includes(pos.toUpperCase());
const isGoaliePos = (pos: string) => ["G"].includes(pos.toUpperCase());

export default function ThreeStarsView({
  rows,
  season,
  lang = "en",
}: {
  rows: ThreeStarRow[];
  season: string;
  lang?: string;
}) {
  const isCs = lang === "cs";

  const [q, setQ] = useState("");
  const [posFilter, setPosFilter] = useState<"ALL" | "F" | "D" | "G">("ALL");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (query) {
        const matchName = cleanName(r.name).toLowerCase().includes(query);
        const matchTeam = r.teamCode?.toLowerCase().includes(query) ?? false;
        if (!matchName && !matchTeam) return false;
      }
      if (posFilter === "F" && !isForward(r.position)) return false;
      if (posFilter === "D" && !isDefense(r.position)) return false;
      if (posFilter === "G" && !isGoaliePos(r.position)) return false;
      return true;
    });
  }, [rows, q, posFilter]);

  // Top 3 Podium
  const top1 = rows[0] ?? null;
  const top2 = rows[1] ?? null;
  const top3 = rows[2] ?? null;

  return (
    <div className="space-y-6">
      {/* Top 3 Podium Section */}
      {rows.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* 1st Place (Center / Featured) */}
          <div className="order-1 md:order-2 relative rounded-2xl border border-amber-400/50 bg-gradient-to-b from-amber-500/20 via-slate-900 to-slate-950 p-5 shadow-xl shadow-amber-500/5 backdrop-blur flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/25 text-amber-300 border border-amber-400/40 shadow-sm">
                🥇 1. {isCs ? "HVIEZDA LIGY" : "STAR OF THE LEAGUE"}
              </span>
              <span className="text-xl font-black text-amber-400 tabular-nums">
                {top1.pts} <span className="text-xs font-medium text-slate-400">{isCs ? "bodov" : "pts"}</span>
              </span>
            </div>

            <div className="my-5 flex items-center gap-4">
              <PlayerAvatar src={top1.photoUrl} alt={top1.name} size={68} className="ring-4 ring-amber-400/60 shadow-lg" />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/players/${top1.slug}`}
                  className="text-lg font-black text-white hover:text-amber-400 transition-colors truncate block"
                >
                  {cleanName(top1.name)}
                </Link>
                <div className="flex items-center gap-2 mt-1">
                  {top1.teamLogoUrl && <img src={top1.teamLogoUrl} alt="" className="w-5 h-5 object-contain" />}
                  <span className="text-xs font-bold text-slate-300">{top1.teamCode}</span>
                  <span className="text-xs text-slate-600">·</span>
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {top1.position}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-amber-500/20 text-center">
              <div className="bg-slate-950/60 rounded-lg p-1.5 border border-amber-500/20">
                <div className="text-[10px] text-amber-400 font-bold uppercase">1st Star</div>
                <div className="text-base font-black text-white">{top1.firsts}×</div>
              </div>
              <div className="bg-slate-950/60 rounded-lg p-1.5 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-bold uppercase">2nd Star</div>
                <div className="text-base font-black text-slate-200">{top1.seconds}×</div>
              </div>
              <div className="bg-slate-950/60 rounded-lg p-1.5 border border-slate-800">
                <div className="text-[10px] text-amber-700 font-bold uppercase">3rd Star</div>
                <div className="text-base font-black text-slate-300">{top1.thirds}×</div>
              </div>
            </div>
          </div>

          {/* 2nd Place */}
          <div className="order-2 md:order-1 relative rounded-2xl border border-slate-400/30 bg-gradient-to-b from-slate-400/15 via-slate-900 to-slate-950 p-5 shadow-lg backdrop-blur flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-400/20 text-slate-200 border border-slate-400/30">
                🥈 2. {isCs ? "MIESTO" : "PLACE"}
              </span>
              <span className="text-lg font-black text-slate-200 tabular-nums">
                {top2.pts} <span className="text-xs font-medium text-slate-400">{isCs ? "bodov" : "pts"}</span>
              </span>
            </div>

            <div className="my-5 flex items-center gap-4">
              <PlayerAvatar src={top2.photoUrl} alt={top2.name} size={60} className="ring-2 ring-slate-400/40" />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/players/${top2.slug}`}
                  className="text-base font-black text-white hover:text-blue-400 transition-colors truncate block"
                >
                  {cleanName(top2.name)}
                </Link>
                <div className="flex items-center gap-2 mt-1">
                  {top2.teamLogoUrl && <img src={top2.teamLogoUrl} alt="" className="w-4 h-4 object-contain" />}
                  <span className="text-xs font-bold text-slate-300">{top2.teamCode}</span>
                  <span className="text-xs text-slate-600">·</span>
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {top2.position}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 text-center">
              <div className="bg-slate-950/60 rounded-lg p-1.5 border border-slate-800">
                <div className="text-[10px] text-amber-400 font-bold uppercase">1st Star</div>
                <div className="text-sm font-black text-white">{top2.firsts}×</div>
              </div>
              <div className="bg-slate-950/60 rounded-lg p-1.5 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-bold uppercase">2nd Star</div>
                <div className="text-sm font-black text-slate-200">{top2.seconds}×</div>
              </div>
              <div className="bg-slate-950/60 rounded-lg p-1.5 border border-slate-800">
                <div className="text-[10px] text-amber-700 font-bold uppercase">3rd Star</div>
                <div className="text-sm font-black text-slate-300">{top2.thirds}×</div>
              </div>
            </div>
          </div>

          {/* 3rd Place */}
          <div className="order-3 relative rounded-2xl border border-amber-700/30 bg-gradient-to-b from-amber-900/15 via-slate-900 to-slate-950 p-5 shadow-lg backdrop-blur flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-800/20 text-amber-300 border border-amber-700/30">
                🥉 3. {isCs ? "MIESTO" : "PLACE"}
              </span>
              <span className="text-lg font-black text-amber-300 tabular-nums">
                {top3.pts} <span className="text-xs font-medium text-slate-400">{isCs ? "bodov" : "pts"}</span>
              </span>
            </div>

            <div className="my-5 flex items-center gap-4">
              <PlayerAvatar src={top3.photoUrl} alt={top3.name} size={60} className="ring-2 ring-amber-700/40" />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/players/${top3.slug}`}
                  className="text-base font-black text-white hover:text-blue-400 transition-colors truncate block"
                >
                  {cleanName(top3.name)}
                </Link>
                <div className="flex items-center gap-2 mt-1">
                  {top3.teamLogoUrl && <img src={top3.teamLogoUrl} alt="" className="w-4 h-4 object-contain" />}
                  <span className="text-xs font-bold text-slate-300">{top3.teamCode}</span>
                  <span className="text-xs text-slate-600">·</span>
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {top3.position}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 text-center">
              <div className="bg-slate-950/60 rounded-lg p-1.5 border border-slate-800">
                <div className="text-[10px] text-amber-400 font-bold uppercase">1st Star</div>
                <div className="text-sm font-black text-white">{top3.firsts}×</div>
              </div>
              <div className="bg-slate-950/60 rounded-lg p-1.5 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-bold uppercase">2nd Star</div>
                <div className="text-sm font-black text-slate-200">{top3.seconds}×</div>
              </div>
              <div className="bg-slate-950/60 rounded-lg p-1.5 border border-slate-800">
                <div className="text-[10px] text-amber-700 font-bold uppercase">3rd Star</div>
                <div className="text-sm font-black text-slate-300">{top3.thirds}×</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800 backdrop-blur">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={isCs ? "Hľadať hráča alebo tím..." : "Search player or team..."}
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Position Pills */}
        <div className="inline-flex rounded-lg bg-slate-800/80 p-0.5 border border-slate-700/60 text-xs">
          {(["ALL", "F", "D", "G"] as const).map((pos) => (
            <button
              key={pos}
              onClick={() => setPosFilter(pos)}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                posFilter === pos ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              {pos === "ALL"
                ? isCs
                  ? "Všetky"
                  : "All"
                : pos === "F"
                ? isCs
                  ? "Útočníci"
                  : "Forwards"
                : pos === "D"
                ? isCs
                  ? "Obrancovia"
                  : "Defense"
                : isCs
                ? "Brankári"
                : "Goalies"}
            </button>
          ))}
        </div>
      </div>

      {/* Main Leaderboard Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80 shadow-md">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-800/40 border-b border-slate-800">
              <th className="text-center px-3 py-3 w-12">#</th>
              <th className="text-left px-4 py-3">{isCs ? "Hráč" : "Player"}</th>
              <th className="text-left px-3 py-3">{isCs ? "Tím" : "Team"}</th>
              <th className="text-center px-2 py-3">{isCs ? "Poz" : "Pos"}</th>
              <th className="text-right px-4 py-3">⭐ 1st (7b)</th>
              <th className="text-right px-4 py-3">⭐ 2nd (4b)</th>
              <th className="text-right px-4 py-3">⭐ 3rd (2b)</th>
              <th className="text-right px-5 py-3">{isCs ? "Body spolu" : "Total Points"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.map((r, i) => {
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;

              return (
                <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                  {/* Rank */}
                  <td className="px-3 py-3 text-center">
                    {medal ? (
                      <span className="text-base" title={`${i + 1}. miesto`}>
                        {medal}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-500 tabular-nums">
                        {i + 1}
                      </span>
                    )}
                  </td>

                  {/* Player Name & Avatar */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <PlayerAvatar src={r.photoUrl} alt={r.name} size={32} />
                      <Link
                        href={`/players/${r.slug}`}
                        className="font-bold text-white hover:text-blue-400 transition-colors"
                      >
                        {cleanName(r.name)}
                      </Link>
                    </div>
                  </td>

                  {/* Team */}
                  <td className="px-3 py-3">
                    {r.teamSlug ? (
                      <Link
                        href={`/teams/${r.teamSlug}`}
                        className="inline-flex items-center gap-1.5 text-slate-300 hover:text-blue-400 transition-colors"
                      >
                        {r.teamLogoUrl && (
                          <img src={r.teamLogoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />
                        )}
                        <span className="font-semibold text-xs tracking-wider">{r.teamCode}</span>
                      </Link>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>

                  {/* Pos */}
                  <td className="px-2 py-3 text-center">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                      {r.position}
                    </span>
                  </td>

                  {/* 1st Stars */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.firsts > 0 ? (
                      <span className="inline-block px-2 py-0.5 rounded font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20">
                        {r.firsts}
                      </span>
                    ) : (
                      <span className="text-slate-600">0</span>
                    )}
                  </td>

                  {/* 2nd Stars */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.seconds > 0 ? (
                      <span className="inline-block px-2 py-0.5 rounded font-bold text-slate-300 bg-slate-800 border border-slate-700">
                        {r.seconds}
                      </span>
                    ) : (
                      <span className="text-slate-600">0</span>
                    )}
                  </td>

                  {/* 3rd Stars */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.thirds > 0 ? (
                      <span className="inline-block px-2 py-0.5 rounded font-bold text-amber-600 bg-amber-900/20 border border-amber-800/30">
                        {r.thirds}
                      </span>
                    ) : (
                      <span className="text-slate-600">0</span>
                    )}
                  </td>

                  {/* Total Points */}
                  <td className="px-5 py-3 text-right tabular-nums">
                    <span className="inline-block px-3 py-1 rounded-lg text-sm font-black bg-blue-600/20 text-blue-300 border border-blue-500/30 font-mono">
                      {r.pts}
                    </span>
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  {isCs ? "Žiadni hráči nevyhovujú zvoleným filtrom." : "No players match the selected filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-500 px-1 pt-2 border-t border-slate-800">
        {isCs
          ? `Hviezdy zápasov sú prepočítané po každom dueli (hráči v poli aj štartujúci brankári) v celej sezóne ${season}. Bodovanie: 1. hviezda = 7b, 2. hviezda = 4b, 3. hviezda = 2b.`
          : `Three stars are recomputed after every game for skaters and starting goalies across the NHL ${season} season. Scoring weights: 1st Star = 7 pts, 2nd Star = 4 pts, 3rd Star = 2 pts.`}
      </div>
    </div>
  );
}
