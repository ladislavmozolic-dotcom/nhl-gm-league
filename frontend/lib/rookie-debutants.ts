// Real NHL players who are dressing for a real NHL club right now but have NO
// Player row in our database at all — not a Prospect, not a UFA, nothing. This is
// the second half of the Rookie Calculator ask ("alebo nie sú v prospektoch ani
// nikde inde, ale začnú NHL hrať"): a true debutant our league has never tracked.
// On-demand only (loops all 32 NHL rosters) — never called from a page render.

import { prisma } from "./prisma";
import { NHL_ABBREVS, norm, fiKeyOf } from "./real-roster-import";
import { fetchNhlCurrentStats, fetchNhlGoalieStats, importNhlSkaterStats, type NhlStatRow } from "./nhl-api-import";
import { getLiveCalculatorConfig } from "./live-calculator-config";
import { fetchOne as fetchEdgeSpeedOne, EDGE_SEASON_CUR, EDGE_SEASON_LAST } from "./nhl-edge-speed-import";

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
  gp: number; // real games played THIS season — only players who have actually debuted show up
  alreadyProspect: boolean; // already sitting in a team's Prospect (scouting) pool
  prospectTeamCode: string | null;
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

type RosterRow = Omit<DebutantCandidate, "gp" | "alreadyProspect" | "prospectTeamCode">;

/** Scan every real NHL club roster for players whose name/nhlId matches NOTHING
 *  in our Player table AND who have actually logged a real NHL game this season —
 *  a genuine "started playing, nobody in the league has him" gap. A drafted junior
 *  who hasn't debuted yet (e.g. still property of a club but playing major junior)
 *  is deliberately excluded here: there is nothing to rate yet, and he's almost
 *  always already sitting in that team's Prospect (scouting) pool, which is a
 *  separate, lighter-weight table this function also checks so the admin can see
 *  a real debutant is already scouted rather than assuming a duplicate. */
export async function findMissingNhlPlayers(): Promise<{ ok: boolean; candidates: DebutantCandidate[]; error?: string }> {
  const rosterRows: RosterRow[] = [];
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

  const notYetTracked = rosterRows.filter((r) => {
    if (nhlIdSet.has(r.nhlId)) return false;
    const n = norm(r.name);
    if (nameSet.has(n)) return false;
    if (fiSet.has(fiKeyOf(n))) return false; // nickname/spelling variant already tracked
    return true;
  });
  if (!notYetTracked.length) return { ok: true, candidates: [] };

  // Real GP across BOTH the current and the prior real season, so a not-yet-debuted
  // draftee (0 games anywhere) doesn't flood the list, but someone whose only real
  // action was last season (e.g. scanning in the offseason, or early in a new season
  // before anyone has played 10+ games yet) still counts — exactly like the Live
  // Calculator blends cur+last instead of only ever looking at "this year".
  const { latestSeason, previousSeason, weights } = await getLiveCalculatorConfig();
  const minScanGp = weights.rookie?.minScanGp ?? 1;
  const [curSkaters, curGoalies, lastSkaters, lastGoalies] = await Promise.all([
    fetchNhlCurrentStats(Number(latestSeason)).catch(() => []),
    fetchNhlGoalieStats(Number(latestSeason)).catch(() => []),
    fetchNhlCurrentStats(Number(previousSeason)).catch(() => []),
    fetchNhlGoalieStats(Number(previousSeason)).catch(() => []),
  ]);
  const gpByName = new Map<string, number>();
  const addGp = (rows: { name: string; gp: number }[]) => {
    for (const r of rows) gpByName.set(norm(r.name), (gpByName.get(norm(r.name)) ?? 0) + (r.gp ?? 0));
  };
  addGp(curSkaters); addGp(curGoalies); addGp(lastSkaters); addGp(lastGoalies);

  // already scouted in a team's Prospect pool — informational, not exclusionary
  const prospects = await prisma.prospect.findMany({ select: { name: true, team: { select: { code: true } } } });
  const prospectTeamByName = new Map(prospects.map((p) => [norm(p.name), p.team.code]));

  const candidates: DebutantCandidate[] = notYetTracked
    .map((r) => {
      const n = norm(r.name);
      return { ...r, gp: gpByName.get(n) ?? 0, alreadyProspect: prospectTeamByName.has(n), prospectTeamCode: prospectTeamByName.get(n) ?? null };
    })
    .filter((c) => c.gp >= minScanGp);
  return { ok: true, candidates };
}

const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Create a brand-new Player row for a real NHL debutant we've never tracked,
 *  parked in his real club's PROSPECT pool (Player.rosterType = "PROSPECT").
 *  Stats are NOT pulled here — the caller (scanAndSyncDebutants) does one shared
 *  league-wide stat fetch/import after every candidate is created, so a batch of
 *  N new debutants doesn't refetch the same NHL stats endpoint N+1 times. */
async function createDebutantAsProspect(c: DebutantCandidate): Promise<{ ok: boolean; playerId?: number; error?: string }> {
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
  return { ok: true, playerId: player.id };
}

export type ScanAndSyncResult = {
  ok: boolean;
  created: { name: string; teamAbbrev: string; isGoalie: boolean; gp: number; alreadyProspect: boolean; prospectTeamCode: string | null; error?: string }[];
  statsRefreshed: number;
  error?: string;
};

/** The full "Skenovať" action: find every real NHL debutant we've never tracked,
 *  create a Player row for each one automatically (no manual per-player review —
 *  real GP > 0 in EITHER real season already means he's worth tracking), then
 *  ALSO re-pull BOTH the current and the prior real season's stats for the WHOLE
 *  league (every rosterType, including players already sitting in a PROSPECT pool
 *  from an earlier scan) — exactly the two seasons edgeRatings() blends, same as
 *  the Live Calculator. This matters most right when a new real season hasn't
 *  started yet (curSeasonGP is 0 for literally everyone): without the "last"
 *  season backfill, a genuine rookie from the season that just ended would show
 *  up with no games anywhere and no rating, instead of being judged on the real
 *  rookie season he actually just had. Re-running the scan later keeps every
 *  rookie's underlying stats — and therefore his live-computed rating in
 *  rookieCalculatorRows() — current, not just newly discovered names. */
export async function scanAndSyncDebutants(): Promise<ScanAndSyncResult> {
  const found = await findMissingNhlPlayers();
  if (!found.ok) return { ok: false, created: [], statsRefreshed: 0, error: found.error };

  const { latestSeason, previousSeason } = await getLiveCalculatorConfig();
  const [curRows, lastRows]: [NhlStatRow[], NhlStatRow[]] = await Promise.all([
    fetchNhlCurrentStats(Number(latestSeason)).catch(() => []),
    fetchNhlCurrentStats(Number(previousSeason)).catch(() => []),
  ]);
  const gpByName = new Map<string, number>();
  for (const r of [...curRows, ...lastRows]) gpByName.set(norm(r.name), (gpByName.get(norm(r.name)) ?? 0) + (r.gp ?? 0));

  const created: ScanAndSyncResult["created"] = [];
  for (const c of found.candidates) {
    const res = await createDebutantAsProspect(c);
    created.push({
      name: c.name, teamAbbrev: c.teamAbbrev, isGoalie: c.isGoalie, gp: gpByName.get(norm(c.name)) ?? c.gp,
      alreadyProspect: c.alreadyProspect, prospectTeamCode: c.prospectTeamCode, error: res.ok ? undefined : res.error,
    });
  }

  // Real NHL EDGE skating-speed data (SK) for every Rookie Calculator player, new
  // or already tracked — SK was silently staying blank because nothing ever called
  // this until now (see syncLiveCalculatorData for the same fix league-wide). The
  // PROSPECT pool is small, so doing every one of them here (not just the ones
  // founded just now) is cheap, unlike a full-league edge-speed pass.
  try {
    const prospects = await prisma.player.findMany({ where: { rosterType: "PROSPECT", isGoalie: false, nhlId: { not: null } }, select: { id: true, nhlId: true } });
    for (const p of prospects) {
      const [cur, last] = await Promise.all([fetchEdgeSpeedOne(p.nhlId!, EDGE_SEASON_CUR), fetchEdgeSpeedOne(p.nhlId!, EDGE_SEASON_LAST)]);
      if (cur || last) await prisma.player.update({ where: { id: p.id }, data: { edgeSpeed: { cur: cur ?? undefined, last: last ?? undefined } } });
    }
  } catch { /* best-effort — SK just waits for the next scan or the general Sync Live Data */ }

  let statsRefreshed = 0;
  try {
    if (curRows.length) statsRefreshed = (await importNhlSkaterStats(curRows, "cur")).matched;
    if (lastRows.length) await importNhlSkaterStats(lastRows, "last");
  } catch { /* creation already succeeded either way */ }

  return { ok: true, created, statsRefreshed };
}
