import { prisma } from "@/lib/prisma";
import { cleanName } from "@/lib/playerName";
import { projectAllGoalies } from "@/lib/param-projection";

export type ProgressParamKey =
  | "ov"
  | "ck"
  | "pa"
  | "sc"
  | "df"
  | "sk"
  | "st"
  | "di"
  | "ph"
  | "fo"
  | "ex";

export type ParamValue = {
  actual: number;
  projected: number;
  delta: number;
};

export type PlayerProgressItem = {
  id: number;
  slug: string;
  name: string;
  cleanName: string;
  position: string;
  isGoalie: boolean;
  age: number | null;
  number: number | null;
  photoUrl: string | null;
  rosterType: string | null;
  team: {
    id: number;
    name: string;
    slug: string;
    code: string | null;
    logoUrl: string | null;
    league: string;
  };
  classification: string;
  calculatedAt: string | null;
  gp: number;
  ov: ParamValue;
  ck: ParamValue;
  pa: ParamValue;
  sc: ParamValue;
  df: ParamValue;
  allParams: Record<string, ParamValue>;
};

export type PlayerProgressData = {
  players: PlayerProgressItem[];
  lastCalculatedAt: string | null;
  latestWeight: number;
  previousWeight: number;
  latestSeason: string;
  previousSeason: string;
  totalCount: number;
  teams: Array<{ id: number; name: string; slug: string; code: string | null }>;
};

export async function getPlayerProgressData(): Promise<PlayerProgressData> {
  const [config, dbPlayers, { rows: goalieRows }] = await Promise.all([
    prisma.liveCalcConfig.findFirst(),
    prisma.player.findMany({
      where: {
        liveCalculatorRatings: { not: null as any },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        position: true,
        isGoalie: true,
        age: true,
        number: true,
        photoUrl: true,
        rosterType: true,
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            code: true,
            logoUrl: true,
            league: true,
          },
        },
        liveCalculatorRatings: true,
      },
      orderBy: { name: "asc" },
    }),
    projectAllGoalies(),
  ]);

  const players: PlayerProgressItem[] = [];
  const teamMap = new Map<number, { id: number; name: string; slug: string; code: string | null }>();

  for (const p of dbPlayers) {
    if (!p.liveCalculatorRatings) continue;
    const live = p.liveCalculatorRatings as any;
    if (!live.actual || !live.projected) continue;

    if (p.team && !teamMap.has(p.team.id)) {
      teamMap.set(p.team.id, {
        id: p.team.id,
        name: p.team.name,
        slug: p.team.slug,
        code: p.team.code,
      });
    }

    const actual = live.actual || {};
    const projected = live.projected || {};
    const delta = live.delta || {};

    const allParams: Record<string, ParamValue> = {};
    const keys = new Set([
      ...Object.keys(actual),
      ...Object.keys(projected),
      ...Object.keys(delta),
    ]);

    for (const k of keys) {
      const act = Number(actual[k] ?? 0);
      const prj = Number(projected[k] ?? act);
      const d = Number(delta[k] ?? prj - act);
      allParams[k] = { actual: act, projected: prj, delta: d };
    }

    const ovAct = Number(live.overallActual ?? actual.ov ?? 60);
    const ovPrj = Number(live.overallProjected ?? projected.ov ?? ovAct);
    const ovDelta = Number(live.overallDelta ?? ovPrj - ovAct);
    allParams.ov = { actual: ovAct, projected: ovPrj, delta: ovDelta };

    const getParamVal = (k: string): ParamValue => {
      if (allParams[k]) return allParams[k];
      const act = Number(actual[k] ?? 0);
      const prj = Number(projected[k] ?? act);
      const d = Number(delta[k] ?? prj - act);
      return { actual: act, projected: prj, delta: d };
    };

    players.push({
      id: p.id,
      slug: p.slug,
      name: p.name,
      cleanName: cleanName(p.name),
      position: p.position || "F",
      isGoalie: Boolean(p.isGoalie),
      age: p.age,
      number: p.number,
      photoUrl: p.photoUrl,
      rosterType: p.rosterType,
      team: {
        id: p.team?.id ?? 0,
        name: p.team?.name ?? "Unknown",
        slug: p.team?.slug ?? "",
        code: p.team?.code ?? null,
        logoUrl: p.team?.logoUrl ?? null,
        league: p.team?.league ?? "NHL",
      },
      classification: live.classification ?? (p.rosterType === "AHL" ? "AHL/FARM" : "NHL"),
      calculatedAt: live.calculatedAt ?? null,
      gp: Number(live.nhlGpLatest || live.ahlGpLatest || 0),
      ov: { actual: ovAct, projected: ovPrj, delta: ovDelta },
      ck: getParamVal("ck"),
      pa: getParamVal("pa"),
      sc: getParamVal("sc"),
      df: getParamVal("df"),
      allParams,
    });
  }

  // If goalies were not in liveCalculatorRatings, incorporate them from goalieRows if they have non-zero deltas or live data
  const existingPlayerIds = new Set(players.map((p) => p.id));
  for (const g of goalieRows) {
    if (existingPlayerIds.has(g.id)) continue;
    const gActual = (g.actual || {}) as Record<string, number | null>;
    const gProjected = (g.projected || {}) as Record<string, number | null>;
    const ovAct = Number(g.overall ?? 60);
    const ovPrj = Number(g.overallProjected ?? ovAct);
    const ovDelta = ovPrj - ovAct;

    const allParams: Record<string, ParamValue> = {};
    for (const [k, v] of Object.entries(gActual)) {
      const act = Number(v ?? 0);
      const prj = Number(gProjected[k] ?? act);
      allParams[k] = { actual: act, projected: prj, delta: prj - act };
    }
    allParams.ov = { actual: ovAct, projected: ovPrj, delta: ovDelta };

    players.push({
      id: g.id,
      slug: g.slug,
      name: g.name,
      cleanName: cleanName(g.name),
      position: "G",
      isGoalie: true,
      age: g.age,
      number: g.number,
      photoUrl: g.photoUrl,
      rosterType: g.rosterType,
      team: {
        id: g.teamId,
        name: "",
        slug: "",
        code: null,
        logoUrl: null,
        league: g.rosterType === "AHL" ? "AHL" : "NHL",
      },
      classification: g.classification ?? (g.rosterType === "AHL" ? "AHL/FARM" : "NHL"),
      calculatedAt: null,
      gp: g.gp ?? 0,
      ov: { actual: ovAct, projected: ovPrj, delta: ovDelta },
      ck: { actual: 0, projected: 0, delta: 0 },
      pa: { actual: 0, projected: 0, delta: 0 },
      sc: { actual: 0, projected: 0, delta: 0 },
      df: { actual: 0, projected: 0, delta: 0 },
      allParams,
    });
  }

  const sortedTeams = Array.from(teamMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return {
    players,
    lastCalculatedAt: config?.lastCalculatedAt ? config.lastCalculatedAt.toISOString() : null,
    latestWeight: config?.latestWeight ?? 0.8,
    previousWeight: config?.previousWeight ?? 0.2,
    latestSeason: config?.latestSeason ?? "20252026",
    previousSeason: config?.previousSeason ?? "20242025",
    totalCount: players.length,
    teams: sortedTeams,
  };
}
