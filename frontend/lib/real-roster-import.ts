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

  // first-initial + last-name key, e.g. "m marner" — the fallback that bridges
  // nickname spellings (NHL "Mitch Marner" vs our "Mitchell Marner").
  const fiKey = (n: string) => { const p = n.split(" "); return p.length >= 2 ? `${p[0][0]} ${p[p.length - 1]}` : ""; };

  // 1) build name maps from the live NHL rosters, retrying each club (the API
  //    rate-limits a burst of 32 quick calls).
  const nameToAbbrev = new Map<string, string>();          // exact normalised name -> abbrev
  const fiToAbbrevs = new Map<string, Set<string>>();      // "m marner" -> {abbrev,…}
  let rostersFetched = 0;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (const ab of NHL_ABBREVS) {
    let data: Record<string, Array<{ firstName?: { default?: string }; lastName?: { default?: string } }>> | null = null;
    for (let attempt = 0; attempt < 5 && !data; attempt++) {
      try {
        const res = await fetch(`https://api-web.nhle.com/v1/roster/${ab}/current`, { cache: "no-store" });
        if (res.ok) data = await res.json();
      } catch { /* retry */ }
      if (!data) await sleep(600 * (attempt + 1));
    }
    if (!data) continue;
    rostersFetched++;
    for (const group of ["forwards", "defensemen", "goalies"]) {
      for (const p of data[group] ?? []) {
        const key = norm(`${p.firstName?.default ?? ""} ${p.lastName?.default ?? ""}`);
        if (!key) continue;
        nameToAbbrev.set(key, ab);
        const fk = fiKey(key);
        if (fk) (fiToAbbrevs.get(fk) ?? fiToAbbrevs.set(fk, new Set()).get(fk)!).add(ab);
      }
    }
    await sleep(200);
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
    const key = norm(pl.name);
    // exact name first; else a first-initial+last-name match, but only when that
    // key is unique across the whole league (no risk of the wrong club).
    let ab = nameToAbbrev.get(key);
    if (!ab) { const set = fiToAbbrevs.get(fiKey(key)); if (set && set.size === 1) ab = [...set][0]; }
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
