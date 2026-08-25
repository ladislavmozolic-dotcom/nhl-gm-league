import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cleanName } from "@/lib/playerName";
import { Card } from "@/components/ui";
import { ovColor, posGroup } from "@/lib/ratingBands";
import RosterTabs from "@/components/RosterTabs";
import { canManageTeam } from "@/lib/auth";

export const dynamic = "force-dynamic";

type DP = {
  id: number; name: string; slug: string; position: string | null;
  overall: number | null; isGoalie: boolean; shoots: string | null;
  league: "NHL" | "AHL"; injured: boolean;
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

const COLS: { key: string; label: string; def?: boolean }[] = [
  { key: "LW", label: "Left Wing" },
  { key: "C", label: "Center" },
  { key: "RW", label: "Right Wing" },
  { key: "LD", label: "Left Defense", def: true },
  { key: "RD", label: "Right Defense", def: true },
  { key: "G", label: "Goaltenders", def: true },
];

export default async function DepthChartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug } });
  if (!team) notFound();

  const affiliates = await prisma.team.findMany({ where: { parentTeamId: team.id }, select: { id: true } });
  const affIds = affiliates.map((a) => a.id);

  const rows = await prisma.player.findMany({
    where: { teamId: { in: [team.id, ...affIds] }, rosterType: { in: ["NHL", "AHL"] } },
    select: {
      id: true, name: true, slug: true, position: true, overall: true, isGoalie: true,
      shoots: true, teamId: true, injuryDaysLeft: true, goalieRating: { select: { overall: true } },
    },
  });

  const players: DP[] = rows.map((r) => ({
    id: r.id, name: r.name, slug: r.slug, position: r.position,
    overall: r.isGoalie ? (r.goalieRating?.overall ?? r.overall) : r.overall,
    isGoalie: r.isGoalie, shoots: r.shoots,
    league: r.teamId === team.id ? "NHL" : "AHL",
    injured: (r.injuryDaysLeft ?? 0) > 0,
  }));

  // bucket into columns, each sorted best → worst
  const buckets: Record<string, DP[]> = {};
  for (const c of COLS) buckets[c.key] = [];
  for (const p of players) for (const c of columnsFor(p)) buckets[c]?.push(p);
  for (const k of Object.keys(buckets)) buckets[k].sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));

  return (
    <div className="space-y-4">
      <RosterTabs slug={slug} isGm={await canManageTeam(team.id)} />
      <div className="flex items-center gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> NHL</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500/70" /> AHL / farm</span>
        <span className="text-slate-600">Players listed at every position they can play, best to worst.</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {COLS.map((c) => (
          <Card key={c.key} title={c.label} accent={c.def ? "text-blue-400" : "text-slate-200"}>
            <div className="divide-y divide-slate-800/60">
              {buckets[c.key].length === 0 && <p className="text-sm text-slate-500 py-2">—</p>}
              {buckets[c.key].map((p, i) => {
                const grp = posGroup(p.position, c.key === "G");
                return (
                  <div key={p.id} className="flex items-center gap-2 py-1.5">
                    <span className="w-4 text-[11px] text-slate-600 tabular-nums">{i + 1}</span>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.league === "NHL" ? "bg-blue-500" : "bg-amber-500/70"}`} />
                    <Link href={`/players/${p.slug}`} className={`text-sm truncate flex-1 hover:text-blue-400 ${p.injured ? "text-slate-500 line-through" : "text-slate-100"}`}>
                      {cleanName(p.name)}
                    </Link>
                    <span className={`text-sm font-bold tabular-nums shrink-0 ${ovColor(grp, p.overall)}`}>{p.overall ?? "—"}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
