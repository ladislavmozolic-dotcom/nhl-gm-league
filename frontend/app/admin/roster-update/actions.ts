"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { applyReconcileOne, previewReconciliation } from "@/lib/roster-reconcile";
import { fetchAhlGp, importAhlGp } from "@/lib/ahl-import";

/** Admin: refresh last-season AHL games played from theahl.com. */
export async function refreshAhlGpAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Only a league admin can refresh AHL data." };
  try {
    const r = await importAhlGp(await fetchAhlGp());
    revalidatePath("/admin/roster-update");
    return { ok: true as const, matched: r.matched, total: r.total };
  } catch (e) {
    return { ok: false as const, error: `Could not reach theahl.com: ${(e as Error).message}` };
  }
}

export async function applyReconcileOneAction(id: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Only a league admin can apply this." };
  const ok = await applyReconcileOne(id);
  for (const p of ["/admin/roster-update", "/teams", "/free-agents"]) revalidatePath(p);
  return { ok: ok as boolean };
}

export async function applyAllReconcileAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Only a league admin can apply this." };
  const list = await previewReconciliation();
  let applied = 0;
  for (const r of list) if (await applyReconcileOne(r.id)) applied++;
  for (const p of ["/admin/roster-update", "/teams", "/free-agents", "/finance"]) revalidatePath(p);
  return { ok: true as const, applied };
}
