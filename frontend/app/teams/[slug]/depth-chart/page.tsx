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
  { key: "LW", labelEn: "Left Wing", labelCs: "Ľavé krídlo", icon: "🏒", theme: "from-blue-600/20 to-sky-600/5 border-blue-500/30 text-blue-300" },
  { key: "C", labelEn: "Center", labelCs: "Center", icon: "🎯", theme: "from-indigo-600/20 to-blue-600/5 border-indigo-500/30 text-indigo-300" },
  { key: "RW", labelEn: "Right Wing", labelCs: "Pravé krídlo", icon: "🏒", theme: "from-sky-600/20 to-cyan-600/5 border-sky-500/30 text-sky-300" },
  { key: "LD", labelEn: "Left Defense", labelCs: "Ľavá obrana", icon: "🛡️", theme: "from-amber-600/20 to-orange-600/5 border-amber-500/30 text-amber-300" },
  { key: "RD", labelEn: "Right Defense", labelCs: "Pravá obrana", icon: "🛡️", theme: "from-orange-600/20 to-amber-600/5 border-orange-500/30 text-orange-300" },
  { key: "G", labelEn: "Goaltenders", labelCs: "Brankári", icon: "🥅", theme: "from-emerald-600/20 to-teal-600/5 border-emerald-500/30 text-emerald-300" },
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

  const nhlCount = players.filter((p) => p.league === "NHL").length;
  const ahlCount = players.filter((p) => p.league === "AHL").length;

  return (
    <div className="space-y-6">
      <RosterTabs slug={slug} isGm={await canManageTeam(team.id)} />

      {/* Header Info Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950/90 border border-slate-800/80 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-4 text-xs flex-wrap">
          <div className="flex items-center gap-2 bg-slate-850/80 px-3 py-1.5 rounded-xl border border-slate-700/60 shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/60 ring-2 ring-blue-500/20" />
            <span className="font-bold text-slate-200">NHL</span>
            <span className="text-slate-400 font-mono">({nhlCount})</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-850/80 px-3 py-1.5 rounded-xl border border-slate-700/60 shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/60 ring-2 ring-amber-500/20" />
            <span className="font-bold text-slate-200">{isCs ? "AHL Farma" : "AHL Farm"}</span>
            <span className="text-slate-400 font-mono">({ahlCount})</span>
          </div>
        </div>

        <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
          {isCs
            ? "Hĺbka kádru zobrazuje hráčov zoradených na každej pozícii, ktorú dokážu hrať (od najvyššieho ratingu). Hráč #1 je primárny líder pozície."
            : "Depth chart ranks all players at every position they can play, best to worst. The #1 player represents the starter / top line option."}
        </p>
      </div>

      {/* 6-Column Tactical Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {COLS.map((c) => {
          const list = buckets[c.key] || [];
          const label = isCs ? c.labelCs : c.labelEn;
          const starter = list[0];
          const depth = list.slice(1);

          return (
            <div
              key={c.key}
              className="bg-slate-900/70 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-md flex flex-col transition-all hover:border-slate-700/80"
            >
              {/* Position Header with Subtle Gradient */}
              <div className={`px-4 py-3.5 border-b bg-gradient-to-r ${c.theme} flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <span className="text-base">{c.icon}</span>
                  <span className="text-sm font-extrabold tracking-tight text-white">{label}</span>
                  <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded bg-black/40 text-slate-300 border border-white/10">
                    {c.key}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-400">
                  {list.length} {isCs ? (list.length === 1 ? "hráč" : list.length < 5 ? "hráči" : "hráčov") : list.length === 1 ? "player" : "players"}
                </span>
              </div>

              {/* Starter Highlight Card */}
              {starter && (
                <div className="p-3 bg-slate-850/40 border-b border-slate-800/60">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-amber-400/90 mb-1 flex items-center gap-1">
                    <span>⭐</span>
                    <span>{isCs ? (c.key === "G" ? "Jednotka v bráne" : "Prvá voľba / 1. formácia") : (c.key === "G" ? "Starting Goalie" : "Top Option / Line 1")}</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/60 border border-slate-700/60">
                    <span className="w-5 text-xs font-black text-amber-400 text-center">1</span>
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ${
                        starter.league === "NHL" ? "bg-blue-500 shadow-blue-500/50" : "bg-amber-500 shadow-amber-500/50"
                      }`}
                      title={starter.league}
                    />
                    <Link
                      href={`/players/${starter.slug}`}
                      className={`text-sm font-bold truncate flex-1 hover:text-blue-400 transition-colors ${
                        starter.injured ? "text-slate-500 line-through" : "text-white"
                      }`}
                    >
                      {cleanName(starter.name)}
                    </Link>

                    {starter.shoots && (
                      <span className="text-[10px] font-mono text-slate-400 uppercase px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                        {starter.shoots}
                      </span>
                    )}

                    {starter.injured && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        IR
                      </span>
                    )}

                    <span
                      className={`text-xs font-black tabular-nums px-2 py-0.5 rounded-md border shadow-sm ${ovColor(
                        posGroup(starter.position, c.key === "G"),
                        starter.overall
                      )}`}
                    >
                      {starter.overall ?? "—"}
                    </span>
                  </div>
                </div>
              )}

              {/* Depth List */}
              <div className="divide-y divide-slate-800/40 p-2 flex-1">
                {list.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-6 text-center">
                    {isCs ? "Žiadni hráči na tejto pozícii" : "No players at this position"}
                  </p>
                ) : (
                  depth.map((p, i) => {
                    const grp = posGroup(p.position, c.key === "G");
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-800/40 transition-colors group"
                      >
                        <span className="w-4 text-[11px] font-semibold text-slate-500 tabular-nums text-center">
                          {i + 2}
                        </span>

                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            p.league === "NHL" ? "bg-blue-500 shadow-sm shadow-blue-500/40" : "bg-amber-500 shadow-sm shadow-amber-500/40"
                          }`}
                          title={p.league === "NHL" ? "NHL" : "AHL"}
                        />

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

                        {p.shoots && (
                          <span className="text-[10px] font-mono text-slate-500 uppercase px-1 rounded bg-slate-850">
                            {p.shoots}
                          </span>
                        )}

                        {p.injured && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            IR
                          </span>
                        )}

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
