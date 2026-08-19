"use server";

import { prisma } from "@/lib/prisma";
import { loadSettings, saveSettings } from "@/lib/sim/settings";
import { isAdmin } from "@/lib/auth";
import { importRealRosters, importRealCapHits, importRealProspects } from "@/lib/real-roster-import";
import { autoLines } from "@/lib/sim/lines-core";
import { saveTeamLines } from "@/lib/sim/lines";
import { revalidatePath } from "next/cache";

/** Admin: fill in missing `realTeamId`s from the live NHL rosters so players the
 *  original real-roster load missed (name-suffix mismatches) stop landing in UFA
 *  when the league runs on Real NHL Rosters. Places matched players immediately if
 *  already in real mode (no bank/ledger reset). */
export async function fillRealTeamsAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Only a league admin can do this." };
  const r = await importRealRosters({ onlyMissing: true });
  if (!r.ok) return r;
  for (const p of ["/admin/rosters", "/free-agents", "/teams", "/tools/all-rosters"]) revalidatePath(p);
  return r;
}

/** Admin: pull real cap hits from CapWages into `realCapHit` (and live `capHit` in
 *  real mode) so player salaries match reality. Takes ~1-2 min (one lookup per
 *  rostered player). */
export async function fillRealCapsAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Only a league admin can do this." };
  const r = await importRealCapHits();
  if (!r.ok) return r;
  for (const p of ["/admin/rosters", "/finance", "/salary-cap", "/teams"]) revalidatePath(p);
  return r;
}

/** Admin: rebuild the real-source prospect pool per team from EliteProspects'
 *  "in the system" pages (fixes clubs that had few or zero real prospects). */
export async function fillRealProspectsAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Only a league admin can do this." };
  const r = await importRealProspects();
  if (!r.ok) return r;
  for (const p of ["/admin/rosters", "/tools/all-rosters", "/draft"]) revalidatePath(p);
  return r;
}

/**
 * Switch which roster the league uses. Reversible via the ProfiNHL snapshot.
 *  - "profinhl": restore each player's ProfiNHL team, roster type and cap hit; cap ceiling → 85.9M.
 *  - "real": put every player on their real NHL team with their real cap hit; cap ceiling → real NHL limit.
 *            Players not on any real NHL roster become free agents (UFA).
 * The league salary-cap ceiling (a key league value) changes automatically with the mode.
 */
export async function applyRosterMode(mode: "profinhl" | "real") {
  const cfg = await getRosterConfig();

  if (mode === "profinhl") {
    await prisma.$executeRawUnsafe(`UPDATE "Player" SET "teamId"="profinhlTeamId", "rosterType"=COALESCE("profinhlRosterType",'NHL'), "capHit"="profinhlCapHit", "tradeClause"="profinhlTradeClause" WHERE "profinhlTeamId" IS NOT NULL`);
    // ProfiNHL mode: real scraped bank balances (fallback 50M); reset the transaction ledger
    await prisma.$executeRawUnsafe(`UPDATE "Team" SET "bankAccount"=COALESCE("profinhlBank", 50000000), "ledgerAdj"=0`);
  } else {
    // NHL 23-man roster — real cap hit AND real clause (kept separate from ProfiNHL)
    await prisma.$executeRawUnsafe(`UPDATE "Player" SET "teamId"="realTeamId", "rosterType"='NHL', "capHit"=COALESCE("realCapHit","profinhlCapHit"), "tradeClause"="realTradeClause", "contractYears"=COALESCE("realContractYears","contractYears") WHERE "realTeamId" IS NOT NULL`);
    // AHL farm → the parent org's affiliate team
    const affiliates = await prisma.team.findMany({ where: { isAffiliate: true, parentTeamId: { not: null } }, select: { id: true, parentTeamId: true } });
    for (const aff of affiliates)
      await prisma.$executeRawUnsafe(`UPDATE "Player" SET "teamId"=${aff.id}, "rosterType"='AHL', "capHit"=COALESCE("realCapHit","profinhlCapHit") WHERE "realFarmTeamId"=${aff.parentTeamId} AND "realTeamId" IS NULL`);
    // everyone else → free agents
    await prisma.$executeRawUnsafe(`UPDATE "Player" SET "rosterType"='UFA' WHERE "realTeamId" IS NULL AND "realFarmTeamId" IS NULL AND "rosterType" IN ('NHL','AHL')`);
    // NHL mode: every team starts with a 50M bank; reset the transaction ledger
    await prisma.$executeRawUnsafe(`UPDATE "Team" SET "bankAccount"=50000000, "ledgerAdj"=0`);
  }

  // swap the league salary-cap ceiling to match the mode
  const settings = await loadSettings();
  settings.salaryCapUpper = mode === "real" ? cfg.realCapUpper : cfg.profinhlCapUpper;
  settings.salaryCapLower = mode === "real" ? cfg.realCapLower : cfg.profinhlCapLower;
  await saveSettings(settings);

  await prisma.leagueConfig.update({ where: { id: 1 }, data: { rosterMode: mode } });
  revalidatePath("/admin/rosters"); revalidatePath("/teams"); revalidatePath("/tools/all-rosters");
  revalidatePath("/free-agents"); revalidatePath("/finance"); revalidatePath("/salary-cap");
  return { mode, capUpper: settings.salaryCapUpper };
}

/**
 * League-wide reset: for every NHL club, build position-aware auto lines from the
 * whole org (NHL + farm), keep exactly those dressed players on the NHL roster, and
 * send every other healthy player down to the affiliate. Injured players are left
 * untouched (they stay on the NHL roster / IR). Saves the auto lines for each team.
 */
export async function normalizeAllRostersAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Only a league admin can do this." };
  const teams = await prisma.team.findMany({
    where: { league: "NHL", isAffiliate: false },
    include: { affiliateTeams: { select: { id: true } } },
  });
  const dressedOf = (lines: ReturnType<typeof autoLines>) => {
    const s = new Set<number>();
    for (const l of lines.forwardLines) for (const id of [l.lw, l.c, l.rw]) if (id != null) s.add(id);
    for (const p of lines.defensePairs) for (const id of [p.ld, p.rd]) if (id != null) s.add(id);
    const g = lines.situations.others;
    if (g.starter != null) s.add(g.starter);
    if (g.backup != null) s.add(g.backup);
    return s;
  };
  const toSk = (p: { id: number; position: string | null; overall: number | null; shoots: string | null }) => ({ id: p.id, position: p.position ?? "C", overall: p.overall ?? 50, shoots: p.shoots });

  let done = 0, sentDown = 0, scratched = 0;
  for (const team of teams) {
    const aff = team.affiliateTeams[0];
    if (!aff) continue;
    const orgIds = [team.id, aff.id];
    const org = await prisma.player.findMany({
      where: { teamId: { in: orgIds } },
      select: { id: true, position: true, overall: true, isGoalie: true, shoots: true, injuryDaysLeft: true, contractType: true },
    });
    const healthy = org.filter((p) => (p.injuryDaysLeft ?? 0) <= 0);

    // NHL = the best auto-lined 20 PLUS every one-way player (one-way can't be sent down).
    const nhlLines = autoLines(healthy.filter((p) => !p.isGoalie).map(toSk), healthy.filter((p) => p.isGoalie).map(toSk));
    const nhl = dressedOf(nhlLines);
    for (const p of healthy) if (p.contractType === "ONE_WAY") nhl.add(p.id);

    // farm = the rest; dress the best 20 there, the remainder are healthy scratches.
    const farmPool = healthy.filter((p) => !nhl.has(p.id));
    const farmLines = autoLines(farmPool.filter((p) => !p.isGoalie).map(toSk), farmPool.filter((p) => p.isGoalie).map(toSk));
    const farmActive = dressedOf(farmLines);
    const nhlIds = [...nhl];
    const farmActiveIds = farmPool.filter((p) => farmActive.has(p.id)).map((p) => p.id);
    const farmScratchIds = farmPool.filter((p) => !farmActive.has(p.id)).map((p) => p.id);

    await prisma.$transaction([
      prisma.player.updateMany({ where: { id: { in: nhlIds } }, data: { teamId: team.id, rosterType: "NHL", scratched: false } }),
      prisma.player.updateMany({ where: { id: { in: farmActiveIds } }, data: { teamId: aff.id, rosterType: "AHL", scratched: false } }),
      prisma.player.updateMany({ where: { id: { in: farmScratchIds } }, data: { teamId: aff.id, rosterType: "AHL", scratched: true } }),
    ]);
    await saveTeamLines(team.id, nhlLines);
    await saveTeamLines(aff.id, farmLines);
    sentDown += farmActiveIds.length + farmScratchIds.length;
    scratched += farmScratchIds.length;
    done++;
  }
  for (const p of ["/teams", "/tools/all-rosters", "/admin/rosters"]) revalidatePath(p);
  return { ok: true as const, teams: done, sentDown, scratched };
}

export async function getRosterConfig() {
  return (await prisma.leagueConfig.findUnique({ where: { id: 1 } })) ?? (await prisma.leagueConfig.create({ data: { id: 1 } }));
}
