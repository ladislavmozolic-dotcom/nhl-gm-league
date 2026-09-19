"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { loadSettings } from "@/lib/sim/settings";
import { redirect } from "next/navigation";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function uniqueSlug(base: string) {
  let slug = base || "team";
  let n = 2;
  while (await prisma.team.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

async function uniqueCode(base: string) {
  let code = base || "EXP";
  let n = 2;
  while (await prisma.team.findUnique({ where: { code }, select: { id: true } })) {
    code = `${base}${n++}`.slice(0, 4);
    if (n > 20) { code = `${base.slice(0, 2)}${Date.now() % 100}`; break; }
  }
  return code;
}

export type CreateExpansionTeamInput = {
  name: string;
  arena: string;
  conference: string;
  division: string;
  capacity: string; // numeric string, optional
  logoUrl: string;
  code: string; // commissioner-editable suggestion, still uniqueness-checked
  startingCapital: string; // numeric string
};

/** Creates a new expansion NHL club: the Team row, its AHL affiliate, a placeholder
 *  Coach, and the matching ExpansionDraftState (SETUP) that wires it into the
 *  protection-list flow. Everything in one transaction. Admin only. */
export async function createExpansionTeamAction(input: CreateExpansionTeamInput) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const name = input.name.trim();
  if (!name) return { ok: false as const, error: "Team name is required." };
  const arena = input.arena.trim() || "TBD Arena";
  const conference = input.conference.trim() || null;
  const division = input.division.trim() || null;
  const capacity = input.capacity.trim() ? Math.max(0, Math.round(Number(input.capacity))) : null;
  const logoUrl = input.logoUrl.trim() || null;

  const settings = await loadSettings().catch(() => null);
  const startingCapital = input.startingCapital.trim()
    ? Math.max(0, Number(input.startingCapital))
    : (settings?.startingCapital ?? 40_000_000);

  const baseSlug = slugify(name);
  const slug = await uniqueSlug(baseSlug);
  const suggestedCode = (input.code.trim() || name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "EXP").toUpperCase();
  const code = await uniqueCode(suggestedCode);

  const affiliateName = `${name} (AHL)`;
  const affiliateSlug = await uniqueSlug(slugify(affiliateName));

  const team = await prisma.$transaction(async (tx) => {
    const t = await tx.team.create({
      data: {
        name, slug, code, arena, league: "NHL", isAffiliate: false,
        conference, division, capacity, logoUrl,
        gm: "TBD", bankAccount: startingCapital,
      },
    });
    await tx.team.create({
      data: {
        name: affiliateName, slug: affiliateSlug, gm: "TBD", arena: "TBD Arena",
        league: "AHL", isAffiliate: true, parentTeamId: t.id,
      },
    });
    await tx.coach.create({
      data: { name: "TBD", teamId: t.id },
    });
    await tx.expansionDraftState.create({ data: { teamId: t.id } });
    return t;
  });

  redirect(`/admin/expansion?created=${team.slug}`);
}
