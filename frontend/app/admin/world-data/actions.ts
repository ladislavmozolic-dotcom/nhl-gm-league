"use server";

import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seedWorldLeagueCatalog } from "@/lib/world-catalog";
import { importAhlSeason, importOhlSeason, importQmjhlSeason, importWhlSeason } from "@/lib/world-import-hockeytech";
import { importNcaaSeason } from "@/lib/world-import-ncaa";
import { importLiigaProspects } from "@/lib/world-import-liiga";
import { importCzechExtraligaProspects, importShlProspects } from "@/lib/world-import-europe";
import { importEuropeanJuniorLeagues } from "@/lib/world-import-juniors";
import { importRussianProspects } from "@/lib/world-import-russia";
import { importKhlLeague } from "@/lib/world-import-khl";
import { importDelLeague } from "@/lib/world-import-del";
import { reconcileAllProspects, resolveWorldPlayer } from "@/lib/world-player-identity";
import { backfillWorldBirthDates } from "@/lib/world-birthdate-backfill";
import { revalidatePath } from "next/cache";

/** Create/update the supported competition catalog. */
export async function seedWorldLeaguesAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const count = await seedWorldLeagueCatalog();
  revalidatePath("/around-the-world");
  revalidatePath("/admin/world-data");
  return { ok: true as const, count };
}

/** Refresh all three CHL junior leagues (WHL, OHL, QMJHL). */
export async function importChlAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  try {
    const [whl, ohl, qmjhl] = [await importWhlSeason(), await importOhlSeason(), await importQmjhlSeason()];
    await reconcileAllProspects();
    revalidatePath("/around-the-world");
    revalidatePath("/admin/world-data");
    return { ok: true as const, results: [whl, ohl, qmjhl] };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "CHL import failed." };
  }
}

/** Refresh American Hockey League (AHL). */
export async function importAhlAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  try {
    const ahl = await importAhlSeason();
    await reconcileAllProspects();
    revalidatePath("/around-the-world");
    revalidatePath("/admin/world-data");
    return { ok: true as const, ...ahl };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "AHL import failed." };
  }
}

/** Refresh NCAA Division I college rosters & clubs. */
export async function importNcaaAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  try {
    const ncaa = await importNcaaSeason();
    await reconcileAllProspects();
    revalidatePath("/around-the-world");
    revalidatePath("/admin/world-data");
    return { ok: true as const, ...ncaa };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "NCAA import failed." };
  }
}

/** Refresh European leagues (Liiga, SHL, Czech Extraliga, Slovak Extraliga, European juniors). */
export async function importEuropeAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  try {
    const [liiga, shl, cze, juniors] = await Promise.all([
      importLiigaProspects(),
      importShlProspects(),
      importCzechExtraligaProspects(),
      importEuropeanJuniorLeagues(),
    ]);
    await reconcileAllProspects();
    revalidatePath("/around-the-world");
    revalidatePath("/admin/world-data");
    return { ok: true as const, liiga, shl, cze, juniors };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Europe import failed." };
  }
}

/** Refresh Russian prospects (KHL, MHL). */
export async function importRussiaAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  try {
    const russia = await importRussianProspects();
    await reconcileAllProspects();
    revalidatePath("/around-the-world");
    revalidatePath("/admin/world-data");
    return { ok: true as const, ...russia };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Russia import failed." };
  }
}

/** Refresh KHL full league rosters & stats. */
export async function importKhlAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  try {
    const khl = await importKhlLeague();
    await reconcileAllProspects();
    revalidatePath("/around-the-world");
    revalidatePath("/admin/world-data");
    return { ok: true as const, ...khl };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "KHL import failed." };
  }
}

/** Refresh German DEL full league rosters & stats. */
export async function importDelAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  try {
    const del = await importDelLeague();
    await reconcileAllProspects();
    revalidatePath("/around-the-world");
    revalidatePath("/admin/world-data");
    return { ok: true as const, ...del };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "DEL import failed." };
  }
}

/** Run prospect reconciliation to match unlinked prospects to existing WorldPlayers. */
export async function reconcileProspectsAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  try {
    const result = await reconcileAllProspects();
    revalidatePath("/around-the-world");
    revalidatePath("/admin/world-data");
    return { ok: true as const, ...result };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Reconciliation failed." };
  }
}

/** One-click sync for all Around the World competitions and prospect links. */
export async function importAllWorldDataAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  try {
    const { runFullWorldSync } = await import("@/lib/world-sync");
    const result = await runFullWorldSync();

    revalidatePath("/around-the-world");
    revalidatePath("/admin/world-data");
    return { ok: true as const, ...result };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "All world sync failed." };
  }
}

/** Manually assign a prospect to a real-world team and league (e.g. for KHL or custom leagues). */
export async function manualLinkProspectAction(input: {
  prospectId: number;
  teamName: string;
  leagueCode: string;
  epUrl?: string;
  season?: string;
  gamesPlayed?: number;
  goals?: number;
  assists?: number;
  points?: number;
  isGoalie?: boolean;
}) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  try {
    const prospect = await prisma.prospect.findUnique({ where: { id: input.prospectId } });
    if (!prospect) return { ok: false as const, error: "Prospect not found." };

    const league = await prisma.worldLeague.upsert({
      where: { code: input.leagueCode.toUpperCase() },
      update: {},
      create: { code: input.leagueCode.toUpperCase(), name: input.leagueCode.toUpperCase(), region: "Europe" },
    });

    const slug = input.teamName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const team = await prisma.worldTeam.upsert({
      where: { leagueId_slug: { leagueId: league.id, slug } },
      update: { name: input.teamName },
      create: { leagueId: league.id, slug, name: input.teamName },
    });

    const { player } = await resolveWorldPlayer({
      provider: "manual",
      externalId: `manual:${prospect.id}`,
      name: prospect.name,
      position: prospect.position ?? (input.isGoalie ? "G" : "F"),
      currentTeamId: team.id,
    });

    if (input.epUrl || prospect.epUrl) {
      await prisma.worldPlayer.update({
        where: { id: player.id },
        data: { epUrl: input.epUrl || prospect.epUrl },
      });
    }

    if (input.gamesPlayed !== undefined || input.points !== undefined) {
      const seasonLabel = input.season || "2026-27";
      const isGoalie = Boolean(input.isGoalie || prospect.position === "G");
      await prisma.worldPlayerSeasonStat.upsert({
        where: { playerId_leagueId_season: { playerId: player.id, leagueId: league.id, season: seasonLabel } },
        update: {
          teamId: team.id,
          isGoalie,
          gamesPlayed: input.gamesPlayed ?? 0,
          goals: input.goals ?? 0,
          assists: input.assists ?? 0,
          points: input.points ?? 0,
          source: "manual-entry",
          syncedAt: new Date(),
        },
        create: {
          playerId: player.id,
          leagueId: league.id,
          teamId: team.id,
          season: seasonLabel,
          isGoalie,
          gamesPlayed: input.gamesPlayed ?? 0,
          goals: input.goals ?? 0,
          assists: input.assists ?? 0,
          points: input.points ?? 0,
          source: "manual-entry",
        },
      });
    }

    // Link prospect
    await prisma.prospect.update({
      where: { id: prospect.id },
      data: { worldPlayerId: player.id },
    });

    revalidatePath("/around-the-world");
    revalidatePath("/admin/world-data");
    return { ok: true as const, playerName: prospect.name, team: team.name };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Manual link failed." };
  }
}

/** Set (or clear, with an empty grade) the commissioner's manual projection grade for a prospect.
 *  Applies to every Prospect row of the same name so profinhl/real copies stay consistent. */
export async function setProspectGradeAction(formData: FormData) {
  if (!(await isAdmin())) return;
  const id = Number(formData.get("prospectId"));
  const raw = String(formData.get("grade") ?? "").toUpperCase();
  const grade = ["A", "B", "C", "D", "F"].includes(raw) ? raw : null;
  const prospect = await prisma.prospect.findUnique({ where: { id }, select: { name: true } });
  if (!prospect) return;
  await prisma.prospect.updateMany({ where: { name: prospect.name }, data: { gradeOverride: grade } });
  for (const path of ["/around-the-world", "/admin/world-data", "/tools/all-rosters", "/players/all"]) revalidatePath(path);
  revalidatePath("/teams/[slug]/prospects", "page");
}

/** Admin button: fill missing prospect birth dates (improves the age part of the grade). */
export async function backfillBirthDatesAction() {
  if (!(await isAdmin())) return;
  await backfillWorldBirthDates(300);
  for (const path of ["/around-the-world", "/admin/world-data", "/tools/all-rosters", "/players/all"]) revalidatePath(path);
  revalidatePath("/teams/[slug]/prospects", "page");
}
