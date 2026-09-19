"use server";

import { prisma } from "@/lib/prisma";
import { canManageTeam, getTeamSession } from "@/lib/auth";
import { protectionRosterFor, validateProtection, type ProtectionFormat } from "@/lib/expansion-server";
import { revalidatePath } from "next/cache";

export async function submitProtectionListAction(input: { teamId: number; slug: string; expansionDraftId: number; format: ProtectionFormat; playerIds: number[] }) {
  if (!(await canManageTeam(input.teamId))) return { ok: false as const, error: "You can't submit for this team." };

  const draft = await prisma.expansionDraftState.findUnique({ where: { id: input.expansionDraftId } });
  if (!draft) return { ok: false as const, error: "That expansion draft no longer exists." };
  if (draft.status !== "SETUP") return { ok: false as const, error: "The protection window is closed — the draft has already started." };
  if (draft.teamId === input.teamId) return { ok: false as const, error: "The expansion team doesn't submit a protection list." };

  const roster = await protectionRosterFor(input.teamId);
  const v = validateProtection(roster, input.format, input.playerIds);
  if (!v.ok) return { ok: false as const, error: v.error };

  const me = await getTeamSession();
  const meTeam = me ? await prisma.team.findUnique({ where: { id: me }, select: { gmNickname: true, gm: true } }) : null;

  await prisma.expansionProtection.upsert({
    where: { expansionDraftId_teamId: { expansionDraftId: input.expansionDraftId, teamId: input.teamId } },
    create: { expansionDraftId: input.expansionDraftId, teamId: input.teamId, format: input.format, playerIds: input.playerIds, submittedBy: meTeam?.gmNickname || meTeam?.gm || null },
    update: { format: input.format, playerIds: input.playerIds, submittedAt: new Date(), submittedBy: meTeam?.gmNickname || meTeam?.gm || null },
  });

  revalidatePath(`/teams/${input.slug}/expansion-protection`);
  revalidatePath("/admin/expansion");
  return { ok: true as const };
}
