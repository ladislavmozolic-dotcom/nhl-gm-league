"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { promotePlayerToNextGen } from "@/lib/edge-params-server";

export async function promoteRookieAction(playerId: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const result = await promotePlayerToNextGen(playerId);
  if (result.ok) revalidatePath("/tools/player-calculator");
  return result;
}
