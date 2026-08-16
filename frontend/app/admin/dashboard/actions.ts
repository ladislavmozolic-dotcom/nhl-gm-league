"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const ROLES = ["gm", "agent", "co_comish", "comish"];

/** Commissioner assigns a league role to a club's GM seat. Comish also flips the
 *  isAdmin flag so co-commissioners get full commissioner powers. */
export async function setGmRoleAction(teamId: number, role: string) {
  if (!(await isAdmin())) return { ok: false as const, error: "Commissioner only." };
  if (!ROLES.includes(role)) return { ok: false as const, error: "Unknown role." };
  await prisma.team.update({
    where: { id: teamId },
    data: { gmRole: role, isAdmin: role === "comish" || role === "co_comish" },
  });
  revalidatePath("/admin/dashboard");
  return { ok: true as const };
}
