"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function saveCapProjection(year: number, upperLimit: number, lowerLimit: number, note: string) {
  if (!(await isAdmin())) throw new Error("Unauthorized");
  await prisma.capProjection.upsert({
    where: { year },
    update: { upperLimit, lowerLimit, note: note || null },
    create: { year, upperLimit, lowerLimit, note: note || null },
  });
  revalidatePath("/admin/cap-projection");
  revalidatePath("/finance/[slug]", "page");
  revalidatePath("/teams/[slug]/salary", "page");
}

export async function resetCapProjection(year: number) {
  if (!(await isAdmin())) throw new Error("Unauthorized");
  await prisma.capProjection.deleteMany({ where: { year } });
  revalidatePath("/admin/cap-projection");
  revalidatePath("/finance/[slug]", "page");
  revalidatePath("/teams/[slug]/salary", "page");
}
