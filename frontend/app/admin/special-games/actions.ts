"use server";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { applyRealSpecialGames, setSpecialGame, type EventKind } from "@/lib/special-games";

const refresh = () => { for (const p of ["/admin/special-games", "/calendar", "/schedule"]) revalidatePath(p); };

export async function applyRealSpecialGamesAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const r = await applyRealSpecialGames();
  refresh();
  return { ok: true as const, ...r };
}

export async function setSpecialGameAction(gameId: number, kind: EventKind | null, title: string, venue: string, capacity: number | null) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  try { await setSpecialGame(gameId, { kind, title, venue, capacity }); refresh(); return { ok: true as const }; }
  catch (e) { return { ok: false as const, error: (e as Error).message }; }
}
