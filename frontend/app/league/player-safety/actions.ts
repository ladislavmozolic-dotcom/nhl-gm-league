"use server";
import { revalidatePath } from "next/cache";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { appealSuspension, ruleOnSuspension, issueDiscipline } from "@/lib/discipline-server";
import { prisma } from "@/lib/prisma";

const refresh = () => { revalidatePath("/league/player-safety"); revalidatePath("/admin/discipline"); };
const wrap = async (fn: () => Promise<unknown>) => { try { await fn(); refresh(); return { ok: true as const }; } catch (e) { return { ok: false as const, error: (e as Error).message }; } };

export async function appealSuspensionAction(id: number, text: string) {
  const teamId = await getTeamSession();
  if (teamId == null) return { ok: false as const, error: "Log in as the club's GM." };
  return wrap(() => appealSuspension(id, teamId, text));
}

export async function ruleOnSuspensionAction(id: number, decision: "UPHELD" | "REDUCED" | "OVERTURNED", games: number | null, note: string) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  return wrap(() => ruleOnSuspension(id, decision, games, note));
}

export async function issueDisciplineAction(d: { playerQuery: string; kind: "SUSPENSION" | "FINE"; games: number; fine: number; incident: string }) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const q = d.playerQuery.trim();
  const byId = /^\d+$/.test(q) ? await prisma.player.findUnique({ where: { id: Number(q) }, select: { id: true } }) : null;
  const matches = byId ? [byId] : await prisma.player.findMany({ where: { name: { contains: q, mode: "insensitive" }, rosterType: { in: ["NHL", "AHL"] } }, select: { id: true, name: true }, take: 5 });
  if (matches.length !== 1) return { ok: false as const, error: matches.length ? `Several players match: ${(matches as { name?: string }[]).map((m) => m.name).join(", ")} — be more specific or use the player id.` : "No player found." };
  return wrap(() => issueDiscipline({ playerId: matches[0].id, kind: d.kind, games: d.games, fine: d.fine, incident: d.incident }));
}
