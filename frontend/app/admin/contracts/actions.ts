"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Admin: set a player's salary (cap hit, in dollars) and contract length. When
 *  the Agent signing flow lands it will write these automatically; this is the
 *  manual override. Regenerates the display contract string too. */
export async function updateContract(formData: FormData) {
  if (!(await isAdmin())) throw new Error("Only a league admin can edit contracts.");
  const slug = String(formData.get("slug") ?? "");
  // salaries move in 50k steps (so a half-retained deal lands cleanly, e.g. 8.1M → 4.05M)
  const capHit = Math.max(0, Math.round((Number(formData.get("capHit")) || 0) / 50000) * 50000);
  const contractYears = Math.max(0, Math.round(Number(formData.get("contractYears")) || 0));
  const expiryRaw = formData.get("contractExpiry");
  const contractExpiry = expiryRaw && String(expiryRaw).trim() ? Number(expiryRaw) : null;
  // keep the shown contract string in sync (e.g. "9,000,000$ / 2yrs")
  const contractText = capHit ? `${capHit.toLocaleString("en-US")}$ / ${contractYears}yr${contractYears === 1 ? "" : "s"}` : null;

  await prisma.player.update({
    where: { slug },
    data: { capHit, contractYears, contractExpiry, contractText },
  });

  for (const p of ["/admin/contracts", `/admin/contracts/${slug}`, "/salary-cap", `/players/${slug}`]) revalidatePath(p);
  redirect(`/admin/contracts/${slug}?saved=1`);
}
