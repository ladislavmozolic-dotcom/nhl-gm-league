// Forward-looking milestone & record watch: which active players are closing in on a
// round-number career total (points / goals / games) or a club single-season record.
// Career total = archived past seasons (PlayerSeasonStat) + the live current season.

import { prisma } from "./prisma";
import { cleanName } from "./playerName";

const ACTIVE = "2026-27";
const PTS = [50, 100, 150, 200, 250, 300, 400, 500, 600, 750, 1000, 1500];
const GOALS = [25, 50, 100, 150, 200, 250, 300, 400, 500, 600, 700];
const ASSISTS = [50, 100, 150, 200, 300, 400, 500, 700, 1000];
const GP = [100, 200, 300, 400, 500, 750, 1000, 1500];
const WATCH = { points: 12, goals: 7, assists: 10, gp: 12 };

export type MilestoneItem = {
  playerId: number; name: string; slug: string | null; teamCode: string | null; teamLogo: string | null;
  kind: "points" | "goals" | "assists" | "gp"; total: number; next: number; toGo: number;
};
export type RecordChase = {
  playerId: number; name: string; slug: string | null; teamCode: string | null; teamLogo: string | null;
  metric: "points" | "goals"; season: number; record: number; holder: string; toGo: number;
};

const nextAbove = (total: number, steps: number[]) => steps.find((s) => s > total) ?? null;

export async function milestoneWatch(): Promise<{ career: MilestoneItem[]; records: RecordChase[] }> {
  // active NHL players + their club (for display)
  const players = await prisma.player.findMany({
    where: { rosterType: "NHL", isGoalie: false },
    select: { id: true, name: true, slug: true, team: { select: { code: true, logoUrl: true } } },
  });
  const meta = new Map(players.map((p) => [p.id, p]));
  const ids = players.map((p) => p.id);
  if (!ids.length) return { career: [], records: [] };

  const [archived, live] = await Promise.all([
    prisma.playerSeasonStat.groupBy({ by: ["playerId"], where: { playerId: { in: ids }, league: "NHL", isPlayoff: false }, _sum: { goals: true, assists: true, points: true, gp: true } }),
    prisma.playerGameStat.groupBy({ by: ["playerId"], where: { playerId: { in: ids }, game: { season: ACTIVE, league: "NHL", status: "FINAL", seriesId: null } }, _sum: { goals: true, assists: true, points: true }, _count: { _all: true } }),
  ]);
  const aBy = new Map(archived.map((a) => [a.playerId, a._sum]));
  const lBy = new Map(live.map((l) => [l.playerId, { s: l._sum, gp: l._count._all }]));

  const career: MilestoneItem[] = [];
  for (const id of ids) {
    const a = aBy.get(id); const l = lBy.get(id);
    const total = {
      points: (a?.points ?? 0) + (l?.s.points ?? 0),
      goals: (a?.goals ?? 0) + (l?.s.goals ?? 0),
      assists: (a?.assists ?? 0) + (l?.s.assists ?? 0),
      gp: (a?.gp ?? 0) + (l?.gp ?? 0),
    };
    const m = meta.get(id)!;
    const push = (kind: MilestoneItem["kind"], steps: number[], watch: number) => {
      const next = nextAbove(total[kind], steps); if (next == null) return;
      const toGo = next - total[kind];
      if (toGo > 0 && toGo <= watch) career.push({ playerId: id, name: cleanName(m.name), slug: m.slug, teamCode: m.team?.code ?? null, teamLogo: m.team?.logoUrl ?? null, kind, total: total[kind], next, toGo });
    };
    push("points", PTS, WATCH.points); push("goals", GOALS, WATCH.goals);
    push("assists", ASSISTS, WATCH.assists); push("gp", GP, WATCH.gp);
  }
  career.sort((x, y) => x.toGo - y.toGo);

  // ---- club single-season records (from archived seasons) being chased this season ----
  const records: RecordChase[] = [];
  const archivedSeasons = await prisma.playerSeasonStat.findMany({
    where: { league: "NHL", isPlayoff: false, season: { not: ACTIVE } },
    select: { teamId: true, playerId: true, points: true, goals: true },
  });
  if (archivedSeasons.length) {
    const nameById = new Map((await prisma.player.findMany({ where: { id: { in: [...new Set(archivedSeasons.map((r) => r.playerId))] } }, select: { id: true, name: true } })).map((p) => [p.id, cleanName(p.name)]));
    const rec = new Map<number, { points: { v: number; who: string }; goals: { v: number; who: string } }>();
    for (const r of archivedSeasons) {
      const e = rec.get(r.teamId) ?? { points: { v: 0, who: "" }, goals: { v: 0, who: "" } };
      if (r.points > e.points.v) e.points = { v: r.points, who: nameById.get(r.playerId) ?? "" };
      if (r.goals > e.goals.v) e.goals = { v: r.goals, who: nameById.get(r.playerId) ?? "" };
      rec.set(r.teamId, e);
    }
    // this season's per-player, per-club totals
    const liveTeam = await prisma.playerGameStat.groupBy({ by: ["playerId", "teamId"], where: { game: { season: ACTIVE, league: "NHL", status: "FINAL", seriesId: null }, playerId: { in: ids } }, _sum: { points: true, goals: true } });
    for (const r of liveTeam) {
      const e = rec.get(r.teamId ?? -1); if (!e) continue;
      const m = meta.get(r.playerId); if (!m) continue;
      const chase = (metric: "points" | "goals", cur: number, rc: { v: number; who: string }) => {
        if (rc.v <= 0) return; const toGo = rc.v + 1 - cur;
        if (toGo > 0 && toGo <= Math.max(8, rc.v * 0.2) && cur >= rc.v * 0.6)
          records.push({ playerId: r.playerId, name: cleanName(m.name), slug: m.slug, teamCode: m.team?.code ?? null, teamLogo: m.team?.logoUrl ?? null, metric, season: 2027, record: rc.v, holder: rc.who, toGo });
      };
      chase("points", r._sum.points ?? 0, e.points); chase("goals", r._sum.goals ?? 0, e.goals);
    }
    records.sort((a, b) => a.toGo - b.toGo);
  }

  return { career: career.slice(0, 60), records: records.slice(0, 30) };
}
