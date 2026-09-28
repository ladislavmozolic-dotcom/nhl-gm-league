// Real NHL players who are dressing for a real NHL club right now but have NO
// Player row in our database at all — not a Prospect, not a UFA, nothing. This is
// the second half of the Rookie Calculator ask ("alebo nie sú v prospektoch ani
// nikde inde, ale začnú NHL hrať"): a true debutant our league has never tracked.
// On-demand only (loops all 32 NHL rosters) — never called from a page render.

import { prisma } from "./prisma";
import { NHL_ABBREVS, norm, fiKeyOf } from "./real-roster-import";
import { fetchNhlCurrentStats, importNhlSkaterStats } from "./nhl-api-import";
import { getLiveCalculatorConfig } from "./live-calculator-config";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type DebutantCandidate = {
  nhlId: number;
  name: string;
  teamAbbrev: string;
  position: string;
  isGoalie: boolean;
  heightCm: number | null;
  weightKg: number | null;
  birthDate: string | null;
  shoots: string | null;
  number: number | null;
  photoUrl: string | null;
};

type NhlRosterPlayer = {
  id: number;
  firstName?: { default?: string };
  lastName?: { default?: string };
  positionCode?: string;
  heightInCentimeters?: number;
  weightInKilograms?: number;
  birthDate?: string;
  shootsCatches?: string;
  sweaterNumber?: number;
  headshot?: string;
};

/** Scan every real NHL club roster for players whose name/nhlId matches NOTHING
 *  in our Player table — a genuine gap where the normal import jobs never had a
 *  row to attach real stats to in the first place. */
export async function findMissingNhlPlayers(): Promise<{ ok: boolean; candidates: DebutantCandidate[]; error?: string }> {
  const rosterRows: DebutantCandidate[] = [];
  let fetched = 0;
  for (const ab of NHL_ABBREVS) {
    let data: Record<string, NhlRosterPlayer[]> | null = null;
    for (let attempt = 0; attempt < 4 && !data; attempt++) {
      try {
        const res = await fetch(`https://api-web.nhle.com/v1/roster/${ab}/current`, { cache: "no-store" });
        if (res.ok) data = await res.json();
      } catch { /* retry */ }
      if (!data) await sleep(500 * (attempt + 1));
    }
    if (!data) continue;
    fetched++;
    for (const group of ["forwards", "defensemen", "goalies"] as const) {
      for (const p of data[group] ?? []) {
        const name = `${p.firstName?.default ?? ""} ${p.lastName?.default ?? ""}`.trim();
        if (!name || p.id == null) continue;
        rosterRows.push({
          nhlId: p.id,
          name,
          teamAbbrev: ab,
          position: p.positionCode ?? (group === "goalies" ? "G" : group === "defensemen" ? "D" : "F"),
          isGoalie: group === "goalies",
          heightCm: p.heightInCentimeters ?? null,
          weightKg: p.weightInKilograms ?? null,
          birthDate: p.birthDate ?? null,
          shoots: p.shootsCatches ?? null,
          number: p.sweaterNumber ?? null,
          photoUrl: p.headshot ?? null,
        });
      }
    }
    await sleep(200);
  }
  if (fetched === 0) return { ok: false, candidates: [], error: "Could not reach the NHL roster API (0 clubs fetched)." };

  const existing = await prisma.player.findMany({ select: { name: true, nhlId: true } });
  const nhlIdSet = new Set(existing.filter((p) => p.nhlId != null).map((p) => p.nhlId as number));
  const nameSet = new Set(existing.map((p) => norm(p.name)));
  const fiSet = new Set(existing.map((p) => fiKeyOf(norm(p.name))));

  const candidates = rosterRows.filter((r) => {
    if (nhlIdSet.has(r.nhlId)) return false;
    const n = norm(r.name);
    if (nameSet.has(n)) return false;
    if (fiSet.has(fiKeyOf(n))) return false; // nickname/spelling variant already tracked
    return true;
  });
  return { ok: true, candidates };
}

const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Create a brand-new Player row for a real NHL debutant we've never tracked,
 *  parked in his real club's PROSPECT pool (Player.rosterType = "PROSPECT"), and
 *  immediately pull his current-season stats (skaters only — no live goalie feed
 *  exists yet) so a debutant who already has real games shows up with real
 *  parameter details right away, instead of waiting for the next unrelated
 *  whole-league stat refresh to happen to run. Nothing about any existing roster
 *  is touched; a genuine 0-GP prospect just gets curSeasonGP: 0, as expected. */
export async function createDebutantAsProspect(c: DebutantCandidate): Promise<{ ok: boolean; playerId?: number; statsGP?: number; error?: string }> {
  const dupe = await prisma.player.findFirst({ where: { nhlId: c.nhlId }, select: { id: true } });
  if (dupe) return { ok: false, error: "Already tracked (nhlId already on file)." };

  const team = await prisma.team.findFirst({ where: { code: c.teamAbbrev, league: "NHL", isAffiliate: false }, select: { id: true } });
  if (!team) return { ok: false, error: `No team found for ${c.teamAbbrev}.` };

  const base = slugify(c.name) || "player";
  let slug = base;
  for (let i = 2; await prisma.player.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;

  const player = await prisma.player.create({
    data: {
      slug, name: c.name, position: c.position, isGoalie: c.isGoalie,
      teamId: team.id, rosterType: "PROSPECT", nhlId: c.nhlId,
      height: c.heightCm ? `${c.heightCm} cm` : null, weight: c.weightKg ?? null,
      birthDate: c.birthDate, shoots: c.shoots, number: c.number, photoUrl: c.photoUrl,
      condition: 100, morale: 50,
    },
  });

  let statsGP: number | undefined;
  if (!c.isGoalie) {
    try {
      const { latestSeason } = await getLiveCalculatorConfig();
      const rows = await fetchNhlCurrentStats(Number(latestSeason));
      await importNhlSkaterStats(rows, "cur");
      const refreshed = await prisma.player.findUnique({ where: { id: player.id }, select: { curSeasonGP: true } });
      statsGP = refreshed?.curSeasonGP ?? 0;
    } catch {
      // creation already succeeded; a failed live-stat pull just means he waits
      // for the next regular refresh, same as before this fix.
    }
  }
  return { ok: true, playerId: player.id, statsGP };
}
