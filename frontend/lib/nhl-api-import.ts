// Live current-season import from the official NHL.com stats API. Joins four
// reports by playerId (summary → G/A/+-, realtime → hits/blocks/TK/GV,
// timeonice → SH TOI/GP) plus the team penalty-kill report (team SH TOI/GP), so
// the Player Calculator can project CK/SC/PA/DF from real form. Admin-triggered,
// a handful of requests — never per page-load. Season is a parameter (seasonId).

import { prisma } from "./prisma";

const API = "https://api.nhle.com/stats/rest/en";
const UA = "Mozilla/5.0 (compatible; ProfiNHL-League/1.0)";

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

/** NHL team abbreviation → full name (normalized) so we can join a skater's team
 *  to the team penalty-kill report. */
const TEAM_ABBR: Record<string, string> = {
  ANA: "anaheimducks", BOS: "bostonbruins", BUF: "buffalosabres", CGY: "calgaryflames",
  CAR: "carolinahurricanes", CHI: "chicagoblackhawks", COL: "coloradoavalanche", CBJ: "columbusbluejackets",
  DAL: "dallasstars", DET: "detroitredwings", EDM: "edmontonoilers", FLA: "floridapanthers",
  LAK: "losangeleskings", MIN: "minnesotawild", MTL: "montrealcanadiens", NSH: "nashvillepredators",
  NJD: "newjerseydevils", NYI: "newyorkislanders", NYR: "newyorkrangers", OTT: "ottawasenators",
  PHI: "philadelphiaflyers", PIT: "pittsburghpenguins", SJS: "sanjosesharks", SEA: "seattlekraken",
  STL: "stlouisblues", TBL: "tampabaylightning", TOR: "torontomapleleafs", UTA: "utahhockeyclub",
  VAN: "vancouvercanucks", VGK: "vegasgoldenknights", WSH: "washingtoncapitals", WPG: "winnipegjets",
};

async function getJson(url: string): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`NHL API HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

async function skaterReport(report: string, seasonId: number): Promise<any[]> {
  const out: any[] = [];
  let start = 0;
  for (;;) {
    const url = `${API}/skater/${report}?isAggregate=false&isGame=false&start=${start}&limit=100&cayenneExp=gameTypeId=2%20and%20seasonId=${seasonId}`;
    const d = (await getJson(url)).data ?? [];
    out.push(...d);
    if (d.length < 100) break;
    start += 100;
    if (start > 2000) break; // safety
  }
  return out;
}

export type NhlStatRow = {
  name: string; gp: number; g: number; a: number; hits: number; blocks: number;
  pm: number; tk: number; gv: number; shToi: number; teamShToi: number;
};

export async function fetchNhlCurrentStats(seasonId: number): Promise<NhlStatRow[]> {
  const [summary, realtime, toi, pk] = await Promise.all([
    skaterReport("summary", seasonId),
    skaterReport("realtime", seasonId),
    skaterReport("timeonice", seasonId),
    getJson(`${API}/team/penaltykill?cayenneExp=seasonId=${seasonId}%20and%20gameTypeId=2`).then((d) => d.data ?? []),
  ]);
  const R = new Map(realtime.map((r: any) => [r.playerId, r]));
  const T = new Map(toi.map((r: any) => [r.playerId, r]));
  const teamPk = new Map<string, number>(); // normalized full name → pk TOI/GP
  for (const t of pk) if (t.pkTimeOnIcePerGame != null) teamPk.set(strip(t.teamFullName), t.pkTimeOnIcePerGame);

  const rows: NhlStatRow[] = [];
  for (const s of summary) {
    const r = R.get(s.playerId), t = T.get(s.playerId);
    const abbr = String(s.teamAbbrevs ?? "").slice(0, 3).toUpperCase();
    const teamShToi = teamPk.get(TEAM_ABBR[abbr] ?? "") ?? 0;
    rows.push({
      name: s.skaterFullName, gp: s.gamesPlayed ?? 0, g: s.goals ?? 0, a: s.assists ?? 0,
      hits: r?.hits ?? 0, blocks: r?.blockedShots ?? 0, tk: r?.takeaways ?? 0, gv: r?.giveaways ?? 0,
      pm: s.plusMinus ?? 0, shToi: t?.shTimeOnIcePerGame ?? 0, teamShToi,
    });
  }
  return rows;
}

const FIRST_ALIAS: Record<string, string> = {
  mitchell: "mitch", alexander: "alex", william: "will", zachary: "zach", zack: "zach",
  joshua: "josh", matthew: "matt", benjamin: "ben", cameron: "cam", fyodor: "fedor",
  nicholas: "nick", nikolai: "nik", maxime: "max", samuel: "sam", jacob: "jake", joseph: "joe",
};
function key(name: string): string {
  const w = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if (w.length && FIRST_ALIAS[w[0]]) w[0] = FIRST_ALIAS[w[0]];
  return w.join("");
}

// ---- goalie save % (for the ELC goalie bonus) ----
export type NhlGoalieRow = { name: string; gp: number; svPct: number };
export async function fetchNhlGoalieStats(seasonId: number): Promise<NhlGoalieRow[]> {
  const out: any[] = [];
  let start = 0;
  for (;;) {
    const url = `${API}/goalie/summary?isAggregate=false&isGame=false&start=${start}&limit=100&cayenneExp=gameTypeId=2%20and%20seasonId=${seasonId}`;
    const d = (await getJson(url)).data ?? [];
    out.push(...d);
    if (d.length < 100) break;
    start += 100;
    if (start > 500) break;
  }
  return out.map((g: any) => ({ name: g.goalieFullName, gp: g.gamesPlayed ?? 0, svPct: g.savePct ?? 0 }));
}
export async function importGoalieLastSeason(rows: NhlGoalieRow[]) {
  const goalies = await prisma.player.findMany({ where: { isGoalie: true }, select: { id: true, name: true } });
  const idx = new Map(goalies.map((p) => [key(p.name), p.id]));
  let matched = 0;
  const unmatched: string[] = [];
  for (const row of rows) {
    const id = idx.get(key(row.name));
    if (id == null) { unmatched.push(row.name); continue; }
    await prisma.player.update({ where: { id }, data: { lastSeasonSvPct: row.svPct, lastSeasonGP: row.gp } });
    matched++;
  }
  return { total: rows.length, matched, unmatched };
}

export async function importNhlCurrentStats(rows: NhlStatRow[]) {
  const players = await prisma.player.findMany({ select: { id: true, name: true } });
  const idx = new Map(players.map((p) => [key(p.name), p.id]));
  let matched = 0; const unmatched: string[] = [];
  for (const row of rows) {
    const id = idx.get(key(row.name));
    if (id == null) { unmatched.push(row.name); continue; }
    await prisma.player.update({
      where: { id },
      data: {
        curSeasonGP: row.gp, curSeasonG: row.g, curSeasonA: row.a, curSeasonHits: row.hits,
        curSeasonBlocks: row.blocks, curSeasonPM: row.pm, curSeasonTK: row.tk, curSeasonGV: row.gv,
        curSeasonShToi: row.shToi, curSeasonTeamShToi: row.teamShToi,
      },
    });
    matched++;
  }
  return { total: rows.length, matched, unmatched };
}
