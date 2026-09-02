import { prisma } from "./prisma";
import { epSearchName } from "./playerName";
import { MAX_TERM } from "./free-agency";

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// CapWages player slug: lower-case, accents stripped, every non-alphanumeric run → a
// single hyphen (so "Ryan O'Reilly" → ryan-o-reilly, "J.J. Moser" → j-j-moser).
const capwagesSlug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const dollars = (s: string) => { const n = parseInt(s.replace(/[^0-9]/g, ""), 10); return Number.isFinite(n) ? n : null; };
const fiKeyOf = (n: string) => { const p = n.split(" "); return p.length >= 2 ? `${p[0][0]} ${p[p.length - 1]}` : ""; };

async function fetchJson(url: string): Promise<unknown | null> {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
    } catch { /* retry */ }
    await sleep(500 * (i + 1));
  }
  return null;
}
async function mapPool<T, R>(items: T[], concurrency: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (idx < items.length) { const k = idx++; out[k] = await fn(items[k]); }
  }));
  return out;
}

// EliteProspects NHL team ids → our team code (EP ids are stable).
const EP_TEAMS: Array<[number, string, string]> = [
  [1580, "anaheim-ducks", "ANA"], [52, "boston-bruins", "BOS"], [53, "buffalo-sabres", "BUF"], [54, "calgary-flames", "CGY"],
  [55, "carolina-hurricanes", "CAR"], [56, "chicago-blackhawks", "CHI"], [57, "colorado-avalanche", "COL"], [58, "columbus-blue-jackets", "CBJ"],
  [59, "dallas-stars", "DAL"], [60, "detroit-red-wings", "DET"], [61, "edmonton-oilers", "EDM"], [62, "florida-panthers", "FLA"],
  [79, "los-angeles-kings", "LAK"], [63, "minnesota-wild", "MIN"], [64, "montreal-canadiens", "MTL"], [65, "nashville-predators", "NSH"],
  [66, "new-jersey-devils", "NJD"], [67, "new-york-islanders", "NYI"], [68, "new-york-rangers", "NYR"], [69, "ottawa-senators", "OTT"],
  [70, "philadelphia-flyers", "PHI"], [71, "pittsburgh-penguins", "PIT"], [73, "san-jose-sharks", "SJS"], [27336, "seattle-kraken", "SEA"],
  [74, "st-louis-blues", "STL"], [75, "tampa-bay-lightning", "TBL"], [76, "toronto-maple-leafs", "TOR"], [40261, "utah-mammoth", "UTA"],
  [77, "vancouver-canucks", "VAN"], [22211, "vegas-golden-knights", "VGK"], [78, "washington-capitals", "WSH"], [9966, "winnipeg-jets", "WPG"],
];
const unesc = (s: string) => s.replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&#039;/g, "'").replace(/&quot;/g, '"');

/**
 * Rebuild the real-source prospect pool from EliteProspects' "in the system" page
 * for every club — the original NHL-rankings import left many teams with few or no
 * prospects (DET/VAN/UTA had 0). Replaces `source:"real"` prospects per team.
 */
export async function importRealProspects() {
  const teams = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, code: true } });
  const codeToId = new Map(teams.map((t) => [t.code, t.id]));
  const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
  let inserted = 0, teamsDone = 0;
  const perTeam: Record<string, number> = {};
  for (const [epId, slug, code] of EP_TEAMS) {
    const tid = codeToId.get(code);
    if (!tid) continue;
    let html: string | null = null;
    for (let i = 0; i < 4 && !html; i++) {
      try { const r = await fetch(`https://www.eliteprospects.com/team/${epId}/${slug}/in-the-system`, { headers: { "User-Agent": UA }, cache: "no-store" }); if (r.ok) html = await r.text(); } catch { /* retry */ }
      if (!html) await sleep(700 * (i + 1));
    }
    if (!html) continue;
    const re = /\/player\/(\d+)\/([a-z0-9-]+)"[^>]*>\s*([^<>]{2,40}?)\s*</g;
    const seen = new Map<string, { name: string; epUrl: string }>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const [, pid, pslug, raw] = m;
      const name = unesc(raw).trim();
      if (name && !/^\d+$/.test(name) && name.includes(" ") && !seen.has(pid)) seen.set(pid, { name, epUrl: `https://www.eliteprospects.com/player/${pid}/${pslug}` });
    }
    const list = [...seen.values()];
    await prisma.prospect.deleteMany({ where: { teamId: tid, source: "real" } });
    if (list.length) await prisma.prospect.createMany({ data: list.map((p) => ({ name: p.name, teamId: tid, source: "real", epUrl: p.epUrl })) });
    inserted += list.length; teamsDone++; perTeam[code] = list.length;
    await sleep(500);
  }
  if (teamsDone === 0) return { ok: false as const, error: "Could not reach EliteProspects." };
  return { ok: true as const, inserted, teamsDone, perTeam };
}

/**
 * Pull each rostered player's REAL cap hit from CapWages (capwages.com) and store it
 * in `realCapHit` — and, when the league is in real mode, the live `capHit` too so
 * salaries match reality. Names come from the NHL rosters (which match CapWages'
 * naming), matched back to our players by normalised name (+ initial/last fallback).
 */
export async function importRealCapHits() {
  // 1) current CapWages buildId (its _next/data path is versioned)
  let buildId = "";
  try {
    const html = await (await fetch("https://capwages.com/players/mitch-marner", { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" })).text();
    buildId = (html.match(/"buildId":"([^"]+)"/) ?? [])[1] ?? "";
  } catch { /* handled below */ }
  if (!buildId) return { ok: false as const, error: "Could not read CapWages (buildId not found)." };

  // 2) NHL roster names (match CapWages naming: "Mitch", "J.J.", …)
  const names: string[] = [];
  for (const ab of NHL_ABBREVS) {
    const d = (await fetchJson(`https://api-web.nhle.com/v1/roster/${ab}/current`)) as Record<string, Array<{ firstName?: { default?: string }; lastName?: { default?: string } }>> | null;
    if (!d) continue;
    for (const g of ["forwards", "defensemen", "goalies"]) for (const p of d[g] ?? []) {
      const nm = `${p.firstName?.default ?? ""} ${p.lastName?.default ?? ""}`.trim();
      if (nm) names.push(nm);
    }
    await sleep(150);
  }
  if (!names.length) return { ok: false as const, error: "Could not reach the NHL roster API." };

  // clause from CapWages "terms": NMC / NTC / M-NTC (else no clause)
  const clauseOf = (raw: string | null | undefined): string | null => {
    const t = (raw ?? "").toUpperCase();
    if (!t) return null;
    if (t.includes("M") && t.includes("NTC")) return "M_NTC";
    if (t.includes("NMC")) return "NMC";
    if (t.includes("NTC")) return "NTC";
    return null;
  };

  // 3) cap hit + clause per player from CapWages (bounded concurrency)
  const caps = await mapPool([...new Set(names)], 6, async (nm) => {
    const j = await fetchJson(`https://capwages.com/_next/data/${buildId}/players/${capwagesSlug(nm)}.json`);
    const s = j ? JSON.stringify(j) : "";
    const m = s.match(/"capHit":"(\$[0-9,]+)"/);
    const tm = s.match(/"terms":"([^"]*)"/);
    // years left on the deal, e.g. "yearsRemaining":"5 UFA" → 5 (0 = expiring / UFA-RFA now)
    const yr = s.match(/"yearsRemaining":"\s*(\d+)/);
    return { nm, cap: m ? dollars(m[1]) : null, clause: clauseOf(tm?.[1]), years: yr ? Number(yr[1]) : null };
  });
  const exact = new Map<string, number>();
  const fi = new Map<string, number[]>();
  const clauseByName = new Map<string, string | null>();
  const yearsByName = new Map<string, number | null>();
  let fetched = 0;
  for (const { nm, cap, clause, years } of caps) {
    if (cap == null) continue;
    fetched++;
    exact.set(norm(nm), cap);
    clauseByName.set(norm(nm), clause);
    yearsByName.set(norm(nm), years);
    const f = fiKeyOf(norm(nm)); if (f) (fi.get(f) ?? fi.set(f, []).get(f)!).push(cap);
  }

  // 4) write realCapHit + realContractYears + realTradeClause (+ live capHit/contractYears/
  //    tradeClause in real mode). The term is what keeps a multi-year deal (e.g. Caufield
  //    signed through 2030-31) OUT of the re-sign list — before, every real deal imported
  //    with only its cap hit and a stale 1-year length looked like it was expiring.
  const realMode = (await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } }))?.rosterMode === "real";
  const players = await prisma.player.findMany({ where: { realTeamId: { not: null } }, select: { id: true, name: true } });
  let updated = 0;
  for (const pl of players) {
    const key = norm(pl.name);
    let cap = exact.get(key);
    if (cap == null) { const arr = fi.get(fiKeyOf(key)); if (arr && arr.length === 1) cap = arr[0]; }
    if (cap == null) continue;
    const clause = clauseByName.get(key) ?? null;
    const years = yearsByName.get(key) ?? null; // CapWages years remaining (null = unknown)
    // store the true remaining term in realContractYears, but our league caps contract
    // LENGTH at MAX_TERM (4) — a real 8-year deal is carried as a 4-year deal here.
    const leagueYears = years != null ? Math.min(years, MAX_TERM) : null;
    await prisma.player.update({ where: { id: pl.id }, data: {
      realCapHit: cap, realTradeClause: clause, realContractYears: years,
      ...(realMode ? { capHit: cap, tradeClause: clause, ...(leagueYears != null ? { contractYears: leagueYears } : {}) } : {}),
    } });
    updated++;
  }
  return { ok: true as const, fetched, updated, total: players.length, placed: realMode };
}

/**
 * Fill real cap hits for players `importRealCapHits` never reaches: it only builds
 * its candidate list from each club's CURRENT 23-man NHL roster (the NHL API), so
 * anyone on an AHL assignment, IR, or otherwise off that day's active roster is
 * skipped entirely and stays at whatever placeholder value they were seeded with
 * (often $0 or a token amount) — a genuine data gap, not the deliberate profinhl
 * salary scale that active NHL-rostered players intentionally carry. This looks
 * each gap player up on CapWages directly by their OWN name instead of relying on
 * the active-roster scrape (so it also reaches players `realTeamId` was never set
 * for — that field comes from the same active-roster-only scrape and has the exact
 * same AHL/farm blind spot), and — unlike importRealCapHits — writes the live
 * capHit/contractYears/tradeClause unconditionally (not gated on real mode), since
 * there's no legitimate profinhl value here to preserve.
 */
export async function importRealCapHitsForGaps() {
  let buildId = "";
  try {
    const html = await (await fetch("https://capwages.com/players/mitch-marner", { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" })).text();
    buildId = (html.match(/"buildId":"([^"]+)"/) ?? [])[1] ?? "";
  } catch { /* handled below */ }
  if (!buildId) return { ok: false as const, error: "Could not read CapWages (buildId not found)." };

  const clauseOf = (raw: string | null | undefined): string | null => {
    const t = (raw ?? "").toUpperCase();
    if (!t) return null;
    if (t.includes("M") && t.includes("NTC")) return "M_NTC";
    if (t.includes("NMC")) return "NMC";
    if (t.includes("NTC")) return "NTC";
    return null;
  };

  const gaps = await prisma.player.findMany({ where: { rosterType: { in: ["NHL", "AHL"] }, realCapHit: null }, select: { id: true, name: true } });
  const results = await mapPool(gaps, 6, async (pl) => {
    const j = await fetchJson(`https://capwages.com/_next/data/${buildId}/players/${capwagesSlug(pl.name)}.json`);
    const s = j ? JSON.stringify(j) : "";
    const m = s.match(/"capHit":"(\$[0-9,]+)"/);
    const tm = s.match(/"terms":"([^"]*)"/);
    const yr = s.match(/"yearsRemaining":"\s*(\d+)/);
    return { pl, cap: m ? dollars(m[1]) : null, clause: clauseOf(tm?.[1]), years: yr ? Number(yr[1]) : null };
  });

  let updated = 0;
  for (const { pl, cap, clause, years } of results) {
    if (cap == null) continue;
    const leagueYears = years != null ? Math.min(years, MAX_TERM) : null;
    await prisma.player.update({ where: { id: pl.id }, data: {
      realCapHit: cap, realTradeClause: clause, realContractYears: years,
      capHit: cap, tradeClause: clause, ...(leagueYears != null ? { contractYears: leagueYears } : {}),
    } });
    updated++;
  }
  return { ok: true as const, checked: gaps.length, updated, stillMissing: gaps.length - updated };
}

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
    select: { id: true, name: true, rosterType: true, faDecisionAt: true },
  });
  // A UFA currently under real in-game negotiation (a standing offer, or mid
  // deliberation) must NOT be silently overwritten by this real-world snapshot —
  // his own club's/rivals' actual offers are real GM decisions this league has
  // already made, and this importer has no way to log or explain undoing them (no
  // Transaction/SigningLog, unlike every real signing path). Traced a real incident
  // from exactly this: a UFA with an active $5.5M offer got placed onto his live
  // real-life team with zero trace, twice, each time this import ran. Placing is
  // still correct for a UFA with no live activity — that's the tool's whole point.
  const activeOfferIds = new Set(
    (await prisma.faOffer.groupBy({ by: ["playerId"], where: { playerId: { in: players.map((p) => p.id) }, status: { in: ["PENDING", "COUNTERED", "SHORTLISTED"] } } }))
      .map((o) => o.playerId),
  );

  let matched = 0, skippedActive = 0;
  const unmatched: string[] = [];
  for (const pl of players) {
    const key = norm(pl.name);
    // exact name first; else a first-initial+last-name match, but only when that
    // key is unique across the whole league (no risk of the wrong club).
    let ab = nameToAbbrev.get(key);
    if (!ab) { const set = fiToAbbrevs.get(fiKey(key)); if (set && set.size === 1) ab = [...set][0]; }
    const tid = ab ? codeToId.get(ab) : undefined;
    if (!tid) { unmatched.push(pl.name); continue; }
    const underNegotiation = pl.rosterType === "UFA" && (activeOfferIds.has(pl.id) || pl.faDecisionAt != null);
    await prisma.player.update({
      where: { id: pl.id },
      // set the real team; if we're live in real mode AND he's not mid-negotiation,
      // also ice him now (no finance reset)
      data: { realTeamId: tid, ...(realMode && !underNegotiation ? { teamId: tid, rosterType: "NHL" } : {}) },
    });
    if (underNegotiation) skippedActive++;
    matched++;
  }

  return { ok: true as const, matched, unmatchedCount: unmatched.length, unmatched: unmatched.slice(0, 60), rostersFetched, placed: realMode, skippedActive };
}
