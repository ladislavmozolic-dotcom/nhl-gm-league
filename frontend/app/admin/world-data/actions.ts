"use server";

import { isAdmin } from "@/lib/auth";
import { seedWorldLeagueCatalog } from "@/lib/world-catalog";
import { importOhlSeason, importQmjhlSeason, importWhlSeason } from "@/lib/world-import-hockeytech";
import { revalidatePath } from "next/cache";

/** Create/update the supported competition catalog. This intentionally stores
 * no remote data itself; each official-source importer can run safely later. */
export async function seedWorldLeaguesAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const count = await seedWorldLeagueCatalog();
  revalidatePath("/around-the-world");
  revalidatePath("/admin/world-data");
  return { ok: true as const, count };
}

/** Fetch the current WHL regular-season roster and aggregate player stats from
 * the league's public HockeyTech feed. Safe to run again: rows are upserted. */
export async function importWhlAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  try {
    const result = await importWhlSeason();
    revalidatePath("/around-the-world");
    revalidatePath("/admin/world-data");
    return { ok: true as const, ...result };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "WHL import failed." };
  }
}

/** Refresh all three CHL junior leagues. Sequential processing keeps the public
 * league feeds and the local database pleasantly low-load. */
export async function importChlAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  try {
    const [whl, ohl, qmjhl] = [await importWhlSeason(), await importOhlSeason(), await importQmjhlSeason()];
    revalidatePath("/around-the-world");
    revalidatePath("/admin/world-data");
    return { ok: true as const, results: [whl, ohl, qmjhl] };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "CHL import failed." };
  }
}
