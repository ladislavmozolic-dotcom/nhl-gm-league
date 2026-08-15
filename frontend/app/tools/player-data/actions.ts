"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { parseCalculatorSheet, importPlayerStats } from "@/lib/player-stats-import";
import { fetchHockeyRefStats } from "@/lib/hockeyref-import";
import { fetchNhlCurrentStats, importNhlCurrentStats, fetchNhlGoalieStats, importGoalieLastSeason } from "@/lib/nhl-api-import";

/** Admin: upload the ProfiNHL "Players Calculator" workbook to refresh every
 *  player's last-season games + points (which power the FA demand engine's
 *  performance / down-season signal). */
export async function refreshPlayerStatsAction(formData: FormData) {
  if (!(await isAdmin())) return { ok: false as const, error: "Only a league admin can refresh player data." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false as const, error: "No file selected." };
  let rows;
  try {
    rows = parseCalculatorSheet(new Uint8Array(await file.arrayBuffer()));
  } catch {
    return { ok: false as const, error: "Could not read the workbook — is it the Players Calculator .xlsx?" };
  }
  if (rows.length === 0) return { ok: false as const, error: "No player rows found in the workbook (expected the calculator's data table)." };
  const res = await importPlayerStats(rows);
  for (const p of ["/free-agents", "/tools/player-data"]) revalidatePath(p);
  return { ok: true as const, total: res.total, matched: res.matched, unmatched: res.unmatched.slice(0, 40), unmatchedCount: res.unmatched.length };
}

/** Admin: pull stats LIVE from hockey-reference (whole league in one request) —
 *  no file needed. `which` = "last" (completed 2025-26) or "current" (2026-27,
 *  which powers the Player Calculator projection once the season is underway). */
export async function refreshFromHockeyReferenceAction(which: "last" | "current" = "last") {
  if (!(await isAdmin())) return { ok: false as const, error: "Only a league admin can refresh player data." };
  const season = which === "current" ? 2027 : 2026;
  let rows;
  try {
    rows = await fetchHockeyRefStats(season);
  } catch (e) {
    return { ok: false as const, error: `Could not reach hockey-reference: ${(e as Error).message}` };
  }
  if (rows.length === 0) return { ok: false as const, error: which === "current" ? "No current-season games yet — the 2026-27 season hasn't started." : "hockey-reference returned no rows (page format may have changed)." };
  const res = await importPlayerStats(rows, which);
  // hockey-reference's skater page has no goalies — pull last-season goalie SV%
  // from the NHL API (feeds the ELC goalie bonus).
  let goalies = 0;
  if (which === "last") {
    try { goalies = (await importGoalieLastSeason(await fetchNhlGoalieStats(20252026))).matched; } catch { /* non-fatal */ }
  }
  for (const p of ["/free-agents", "/tools/player-data", "/tools/player-calculator"]) revalidatePath(p);
  return { ok: true as const, total: res.total, matched: res.matched, goalies, unmatched: res.unmatched.slice(0, 40), unmatchedCount: res.unmatched.length };
}

/** Admin: pull the CURRENT season live from the NHL.com stats API (goals, assists,
 *  +/-, hits, blocks, takeaways, giveaways, SH TOI, team PK TOI) — everything the
 *  Player Calculator needs to project CK/SC/PA/DF from real form. */
export async function refreshCurrentSeasonNhlAction(seasonId = 20262027) {
  if (!(await isAdmin())) return { ok: false as const, error: "Only a league admin can refresh player data." };
  let rows;
  try {
    rows = await fetchNhlCurrentStats(seasonId);
  } catch (e) {
    return { ok: false as const, error: `Could not reach the NHL API: ${(e as Error).message}` };
  }
  if (rows.length === 0) return { ok: false as const, error: `No games for season ${seasonId} yet — has it started?` };
  const res = await importNhlCurrentStats(rows);
  for (const p of ["/free-agents", "/tools/player-data", "/tools/player-calculator"]) revalidatePath(p);
  return { ok: true as const, total: res.total, matched: res.matched, unmatched: res.unmatched.slice(0, 40), unmatchedCount: res.unmatched.length };
}
