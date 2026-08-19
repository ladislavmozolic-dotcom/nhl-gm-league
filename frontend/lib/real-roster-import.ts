import { prisma } from "./prisma";
import { epSearchName } from "./playerName";

// The NHL API's current-roster endpoint is the authoritative "who plays where"
// — one call per club returns the real 23-man roster. We match our players to it
// by a normalised name so the ~200 players the original real-roster load missed
// (mostly names carrying suffixes like ''A'' / (NTC) / (R)) finally get a real team.
const NHL_ABBREVS = [
  "ANA", "BOS", "BUF", "CAR", "CBJ", "CGY", "CHI", "COL", "DAL", "DET", "EDM", "FLA",
  "LAK", "MIN", "MTL", "NJD", "NSH", "NYI", "NYR", "OTT", "PHI", "PIT", "SEA", "SJS",
  "STL", "TBL", "TOR", "UTA", "VAN", "VGK", "WPG", "WSH",
];

/** normalise a name for matching: strip captaincy/clause suffixes, accents, punctuation. */
const norm = (s: string) =>
  epSearchName(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ").replace(/\s{2,}/g, " ").trim();

type Options = { onlyMissing?: boolean; placeIfRealMode?: boolean };

/**
 * Fetch every NHL club's current roster and set `realTeamId` on the matching
 * players. When the league is already in "real" mode, matched players are also
 * moved straight onto their team (out of UFA) — WITHOUT touching team banks/ledgers
 * (so no finance reset, unlike a full mode re-apply).
 */
export async function importRealRosters(opts: Options = {}) {
  const { onlyMissing = true, placeIfRealMode = true } = opts;

  // 1) build normalisedName -> abbrev from the live NHL rosters
  const nameToAbbrev = new Map<string, string>();
  let rostersFetched = 0;
  for (const ab of NHL_ABBREVS) {
    try {
      const res = await fetch(`https://api-web.nhle.com/v1/roster/${ab}/current`, { cache: "no-store" });
      if (!res.ok) continue;
      const data = (await res.json()) as Record<string, Array<{ firstName?: { default?: string }; lastName?: { default?: string } }>>;
      rostersFetched++;
      for (const group of ["forwards", "defensemen", "goalies"]) {
        for (const p of data[group] ?? []) {
          const full = `${p.firstName?.default ?? ""} ${p.lastName?.default ?? ""}`;
          const key = norm(full);
          if (key) nameToAbbrev.set(key, ab);
        }
      }
    } catch {
      /* skip a club that fails to fetch */
    }
  }
  if (rostersFetched === 0) return { ok: false as const, error: "Could not reach the NHL roster API (0 clubs fetched)." };

  // 2) our team code -> id
  const teams = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, code: true } });
  const codeToId = new Map(teams.map((t) => [t.code, t.id]));

  // 3) match players
  const realMode = placeIfRealMode && (await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } }))?.rosterMode === "real";
  const players = await prisma.player.findMany({
    where: onlyMissing ? { realTeamId: null } : {},
    select: { id: true, name: true },
  });

  let matched = 0;
  const unmatched: string[] = [];
  for (const pl of players) {
    const ab = nameToAbbrev.get(norm(pl.name));
    const tid = ab ? codeToId.get(ab) : undefined;
    if (!tid) { unmatched.push(pl.name); continue; }
    await prisma.player.update({
      where: { id: pl.id },
      // set the real team; if we're live in real mode, also ice him now (no finance reset)
      data: { realTeamId: tid, ...(realMode ? { teamId: tid, rosterType: "NHL" } : {}) },
    });
    matched++;
  }

  return { ok: true as const, matched, unmatchedCount: unmatched.length, unmatched: unmatched.slice(0, 60), rostersFetched, placed: realMode };
}
