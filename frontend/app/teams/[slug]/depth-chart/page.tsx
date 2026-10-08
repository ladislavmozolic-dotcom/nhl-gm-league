import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cleanName } from "@/lib/playerName";
import { ovColor, posGroup } from "@/lib/ratingBands";
import RosterTabs from "@/components/RosterTabs";
import { canManageTeam } from "@/lib/auth";
import { getLang } from "@/lib/lang-server";

export const dynamic = "force-dynamic";

type DP = {
  id: number;
  name: string;
  slug: string;
  position: string | null;
  overall: number | null;
  isGoalie: boolean;
  shoots: string | null;
  league: "NHL" | "AHL";
  injured: boolean;
};

// Which depth-chart columns a player belongs in (a player can show in several).
function columnsFor(p: DP): string[] {
  if (p.isGoalie) return ["G"];
  const pos = (p.position ?? "").toUpperCase();
  if (/D/.test(pos) && !/C|W/.test(pos)) return [p.shoots === "R" ? "RD" : "LD"];
  const out: string[] = [];
  const winger = /(^|\/)(W|F)(\/|$)/.test(pos);
  if (/C/.test(pos)) out.push("C");
  if (pos.includes("LW") || /(^|\/)L(\/|$)/.test(pos) || winger) out.push("LW");
  if (pos.includes("RW") || /(^|\/)R(\/|$)/.test(pos) || winger) out.push("RW");
  return out.length ? out : ["C"];
}

const COLS = [
  { key: "LW", labelEn: "Left Wing", labelCs: "Ľavé krídlo", icon: "🏒", def: false },
  { key: "C", labelEn: "Center", labelCs: "Center", icon: "🏒", def: false },
  { key: "RW", labelEn: "Right Wing", labelCs: "Pravé krídlo", icon: "🏒", def: false },
  { key: "LD", labelEn: "Left Defense", labelCs: "Ľavá obrana", icon: "🛡️", def: true },
  { key: "RD", labelEn: "Right Defense", labelCs: "Pravá obrana", icon: "🛡️", def: true },
  { key: "G", labelEn: "Goaltenders", labelCs: "Brankári", icon: "🥅", def: true },
];

export default async function DepthChartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lang = await getLang();
  const isCs = lang === "cs";

  const team = await prisma.team.findUnique({ where: { slug } });
  if (!team) notFound();

  const affiliates = await prisma.team.findMany({ where: { parentTeamId: team.id }, select: { id: true } });
  const affIds = affiliates.map((a) => a.id);

  const rows = await prisma.player.findMany({
    where: { teamId: { in: [team.id, ...affIds] }, rosterType: { in: ["NHL", "AHL"] } },
    select: {
      id: true,
      name: true,
      slug: true,
      position: true,
      overall: true,
      isGoalie: true,
      shoots: true,
      teamId: true,
      injuryDaysLeft: true,
      goalieRating: { select: { overall: true } },
    },
  });

  const players: DP[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    position: r.position,
    overall: r.isGoalie ? (r.goalieRating?.overall ?? r.overall) : r.overall,
    isGoalie: r.isGoalie,
    shoots: r.shoots,
    league: r.teamId === team.id ? "NHL" : "AHL",
    injured: (r.injuryDaysLeft ?? 0) > 0,
  }));

  // bucket into columns, each sorted best → worst
  const buckets: Record<string, DP[]> = {};
  for (const c of COLS) buckets[c.key] = [];
  for (const p of players) {
    for (const c of columnsFor(p)) {
      buckets[c]?.push(p);
    }
  }
  for (const k of Object.keys(buckets)) {
    buckets[k].sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
  }

  return (
    <div className="space-y-5">
      <RosterTabs slug={slug} isGm={await canManageTeam(team.id)} />

      {/* Header Info / Legend Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur">
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
            NHL ({players.filter((p) => p.league === "NHL").length})
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
            {isCs ? "AHL / farma" : "AHL / farm"} ({players.filter((p) => p.league === "AHL").length})
          </span>
        </div>
        <p className="text-[11px] text-slate-400">
          {isCs
            ? "Hráči sú zoradení na všetkých pozíciách, ktoré dokážu hrať (od najlepšieho po najslabšieho)."
            : "Players listed at every position they can play, ranked best to worst."}
        </p>
      </div>

      {/* Grid of Position Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {COLS.map((c) => {
          const list = buckets[c.key] || [];
          const label = isCs ? c.labelCs : c.labelEn;

          return (
            <div
              key={c.key}
              className="bg-slate-900/70 border border-slate-800/80 rounded-xl overflow-hidden shadow-lg backdrop-blur flex flex-col"
            >
              {/* Position Header */}
              <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-850/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{c.icon}</span>
                  <span className={`text-sm font-bold tracking-tight ${c.def ? "text-blue-300" : "text-slate-100"}`}>
                    {label}
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50">
                    {c.key}
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  {list.length} {isCs ? (list.length === 1 ? "hráč" : list.length < 5 ? "hráči" : "hráčov") : list.length === 1 ? "player" : "players"}
                </span>
              </div>

              {/* Player rows */}
              <div className="divide-y divide-slate-800/40 p-1 flex-1">
                {list.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-4 text-center">
                    {isCs ? "Žiadni hráči na tejto pozícii" : "No players at this position"}
                  </p>
                ) : (
                  list.map((p, i) => {
                    const grp = posGroup(p.position, c.key === "G");
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800/40 transition-colors group"
                      >
                        <span className="w-4 text-[11px] font-semibold text-slate-500 tabular-nums text-center">
                          {i + 1}
                        </span>

                        {/* League badge dot */}
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            p.league === "NHL" ? "bg-blue-500 shadow-sm shadow-blue-500/40" : "bg-amber-500 shadow-sm shadow-amber-500/40"
                          }`}
                          title={p.league === "NHL" ? "NHL" : "AHL"}
                        />

                        {/* Player Name */}
                        <Link
                          href={`/players/${p.slug}`}
                          className={`text-xs font-medium truncate flex-1 transition-colors ${
                            p.injured
                              ? "text-slate-500 line-through hover:text-slate-400"
                              : "text-slate-200 group-hover:text-blue-400"
                          }`}
                        >
                          {cleanName(p.name)}
                        </Link>

                        {/* Shoots side */}
                        {p.shoots && (
                          <span
                            className="text-[10px] font-mono text-slate-500 uppercase px-1 rounded bg-slate-800/50"
                            title={isCs ? (p.shoots === "L" ? "Ľavák" : "Pravák") : (p.shoots === "L" ? "Left" : "Right")}
                          >
                            {p.shoots}
                          </span>
                        )}

                        {/* Injured badge */}
                        {p.injured && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            title={isCs ? "Zranený" : "Injured"}
                          >
                            IR
                          </span>
                        )}

                        {/* Overall rating */}
                        <span
                          className={`text-xs font-extrabold tabular-nums px-1.5 py-0.5 rounded border border-slate-700/50 shrink-0 ${ovColor(
                            grp,
                            p.overall
                          )}`}
                        >
                          {p.overall ?? "—"}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
