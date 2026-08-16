"use server";

import { revalidatePath } from "next/cache";
import { canManageTeam } from "@/lib/auth";
import { placeOnWaivers, claimWaiver, cancelWaiver } from "@/lib/waivers-server";

export async function placeOnWaiversAction(playerId: number, teamId: number) {
  if (!(await canManageTeam(teamId))) return { ok: false as const, error: "You don't manage this team." };
  const r = await placeOnWaivers(playerId, teamId);
  revalidatePath("/waivers");
  return r;
}

export async function claimWaiverAction(waiverId: number, teamId: number) {
  if (!(await canManageTeam(teamId))) return { ok: false as const, error: "You don't manage this team." };
  const r = await claimWaiver(waiverId, teamId);
  revalidatePath("/waivers");
  return r;
}

export async function cancelWaiverAction(waiverId: number, teamId: number) {
  if (!(await canManageTeam(teamId))) return { ok: false as const, error: "You don't manage this team." };
  const r = await cancelWaiver(waiverId, teamId);
  revalidatePath("/waivers");
  return r;
}
