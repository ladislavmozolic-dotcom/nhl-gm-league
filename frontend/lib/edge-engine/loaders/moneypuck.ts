// MoneyPuck season-skater CSV → engine SeasonStats.
//
// One CSV row = one player × one situation ("all" | "5on5" | "5on4" | "4on5" | "other").
// We fold the 5on5 / 5on4 / 4on5 / all rows into a SeasonStats, and compute the DF
// RELATIVE-to-team on-ice metrics (xGA/60, HD xGA/60, CA/60) by subtracting each player's
// team mean — exactly the "absolute + relative-to-team" the spec asks for.
//
// MoneyPuck data is free for non-commercial use WITH attribution (moneypuck.com).

import type { SeasonStats, SituationLine } from "../types";

// ── tiny CSV parser (handles quoted fields) ─────────────────────────────────
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") { if (field !== "" || row.length) { row.push(field); rows.push(row); row = []; field = ""; } if (c === "\r" && text[i + 1] === "\n") i++; }
    else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift()!;
  return rows.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const num = (r: Record<string, string>, k: string) => { const v = parseFloat(r[k]); return Number.isFinite(v) ? v : 0; };
const per60 = (v: number, toi: number) => (toi > 0 ? (v * 3600) / toi : 0);

interface Raw { playerId: string; name: string; team: string; pos: string; sit: Record<string, Record<string, string>> }

/** Group all rows of one CSV by player, keyed situation → row. */
function byPlayer(rows: Record<string, string>[]): Map<string, Raw> {
  const m = new Map<string, Raw>();
  for (const r of rows) {
    const id = r.playerId;
    if (!m.has(id)) m.set(id, { playerId: id, name: r.name, team: r.team, pos: r.position, sit: {} });
    m.get(id)!.sit[r.situation] = r;
  }
  return m;
}

/** icetime-weighted team means of on-ice-against rates, per situation. */
function teamMeans(players: Raw[], sit: "5on5" | "4on5") {
  const acc = new Map<string, { xga: number; hd: number; ca: number; toi: number }>();
  for (const p of players) {
    const row = p.sit[sit]; if (!row) continue;
    const toi = num(row, "icetime"); if (toi <= 0) continue;
    const a = acc.get(p.team) ?? { xga: 0, hd: 0, ca: 0, toi: 0 };
    a.xga += num(row, "OnIce_A_xGoals"); a.hd += num(row, "OnIce_A_highDangerxGoals");
    a.ca += num(row, "OnIce_A_shotAttempts"); a.toi += toi;
    acc.set(p.team, a);
  }
  const mean = new Map<string, { xga: number; hd: number; ca: number }>();
  for (const [team, a] of acc) mean.set(team, { xga: per60(a.xga, a.toi), hd: per60(a.hd, a.toi), ca: per60(a.ca, a.toi) });
  return mean;
}

function line(row: Record<string, string> | undefined): SituationLine {
  if (!row) return { icetime: 0 };
  const pen = num(row, "penalties"), pim = num(row, "penalityMinutes");
  return {
    icetime: num(row, "icetime"),
    goals: num(row, "I_F_goals"), xGoals: num(row, "I_F_xGoals"), shotsOnGoal: num(row, "I_F_shotsOnGoal"),
    primaryAssists: num(row, "I_F_primaryAssists"), secondaryAssists: num(row, "I_F_secondaryAssists"),
    hits: num(row, "I_F_hits"), giveaways: num(row, "I_F_giveaways"), dzGiveaways: num(row, "I_F_dZoneGiveaways"),
    takeaways: num(row, "I_F_takeaways"), blocks: num(row, "shotsBlockedByPlayer"),
    penaltiesDrawn: num(row, "penaltiesDrawn"),
    minorsTaken: pen, // MoneyPuck doesn't split minor/major cleanly; treat count as minors
    majorsTaken: Math.max(0, (pim - 2 * pen) / 5), // rough non-minor estimate (incl. fights)
    faceoffsWon: num(row, "faceoffsWon"), faceoffsLost: num(row, "faceoffsLost"),
  };
}

export interface LoadedSkater { playerId: string; name: string; team: string; pos: string; stats: SeasonStats }

/** Parse one MoneyPuck season CSV → per-player SeasonStats (with team-relative DF fields). */
export function loadMoneyPuckSeason(csvText: string, seasonLabel: string): Map<string, LoadedSkater> {
  const raws = [...byPlayer(parseCsv(csvText)).values()];
  const evMean = teamMeans(raws, "5on5");
  const pkMean = teamMeans(raws, "4on5");
  const out = new Map<string, LoadedSkater>();

  for (const p of raws) {
    const all = p.sit["all"]; if (!all) continue;
    const ev = line(p.sit["5on5"]);
    const pp = line(p.sit["5on4"]);
    const pk = line(p.sit["4on5"]);

    // DF relatives (player on-ice minus team mean)
    const evRow = p.sit["5on5"], pkRow = p.sit["4on5"];
    const tm = evMean.get(p.team);
    if (evRow && tm && ev.icetime > 0) {
      ev.xGA60Rel = per60(num(evRow, "OnIce_A_xGoals"), ev.icetime) - tm.xga;
      ev.hdXGA60Rel = per60(num(evRow, "OnIce_A_highDangerxGoals"), ev.icetime) - tm.hd;
      ev.CA60Rel = per60(num(evRow, "OnIce_A_shotAttempts"), ev.icetime) - tm.ca;
    }
    const pkm = pkMean.get(p.team);
    if (pkRow && pkm && pk.icetime > 0) pk.xGA60Rel = per60(num(pkRow, "OnIce_A_xGoals"), pk.icetime) - pkm.xga;

    const stats: SeasonStats = {
      season: seasonLabel, gamesPlayed: num(all, "games_played"),
      ev5v5: ev, pp, pk, all: line(all),
    };
    out.set(p.playerId, { playerId: p.playerId, name: p.name, team: p.team, pos: p.pos, stats });
  }
  return out;
}
