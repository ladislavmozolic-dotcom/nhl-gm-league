// Prospect → Player development pipeline. A draft pick becomes a real PROSPECT
// player in the drafting org (linked via DraftProspect.playerId). Each offseason
// prospects DEVELOP — overall grows toward the scouted potential on an age curve —
// so draft picks pan out (or don't) over seasons. Draft "success" = a pick that
// develops into NHL-calibre talent. Prospects are NOT auto-dressed, so they never
// touch the sim until a GM promotes them with the normal roster tools.

import { prisma } from "./prisma";

const ATTRS = ["ck", "fg", "di", "sk", "st", "en", "du", "ph", "fo", "pa", "sc", "df", "ps", "ex", "ld", "mo"] as const;
export const NHL_CALIBRE = 78; // developed overall that counts as a draft "hit"

function slugify(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function ageFrom(birthDate: string | null, asOf = new Date()): number {
  if (!birthDate) return 18;
  const bd = new Date(`${birthDate}T00:00:00Z`);
  if (isNaN(bd.getTime())) return 18;
  let a = asOf.getUTCFullYear() - bd.getUTCFullYear();
  const m = asOf.getUTCMonth() - bd.getUTCMonth();
  if (m < 0 || (m === 0 && asOf.getUTCDate() < bd.getUTCDate())) a--;
  return Math.max(16, Math.min(45, a));
}

// Create a linked PROSPECT Player for a completed draft selection (idempotent —
// returns the existing playerId if already linked).
export async function createProspectPlayerForPick(draftProspectId: number): Promise<number | null> {
  const dp = await prisma.draftProspect.findUnique({
    where: { id: draftProspectId },
    select: { id: true, name: true, position: true, shoots: true, birthDate: true, country: true, ov: true, draftedByTeamId: true, playerId: true },
  });
  if (!dp || dp.draftedByTeamId == null) return null;
  if (dp.playerId != null) return dp.playerId;

  const isGoalie = dp.position === "G";
  const ov = Math.max(35, Math.min(80, dp.ov || 50));
  const attrObj: Record<string, number> = {};
  for (const a of ATTRS) attrObj[a] = ov;
  if (isGoalie) attrObj.du = Math.min(90, ov + 5);

  let slug = `${slugify(dp.name) || "prospect"}-p${dp.id}`;
  if (await prisma.player.findUnique({ where: { slug }, select: { id: true } })) slug = `${slug}-${Date.now() % 100000}`;

  const player = await prisma.player.create({
    data: {
      name: dp.name, slug, position: dp.position, teamId: dp.draftedByTeamId,
      rosterType: "PROSPECT", overall: ov, age: ageFrom(dp.birthDate), birthDate: dp.birthDate ?? null,
      shoots: dp.shoots ?? null, nationality: dp.country ?? null, isGoalie, condition: 100, morale: 75,
      ...attrObj,
    },
  });
  await prisma.draftProspect.update({ where: { id: dp.id }, data: { playerId: player.id } });
  return player.id;
}

// Backfill: every completed our-league draft pick (2026+) that has no linked
// Player gets one. Returns how many were created.
export async function backfillProspectPlayers(): Promise<number> {
  const picks = await prisma.draftProspect.findMany({
    where: { draftedByTeamId: { not: null }, overallPick: { not: null }, playerId: null, draftYear: { gte: 2026 } },
    select: { id: true },
  });
  let made = 0;
  for (const p of picks) { if (await createProspectPlayerForPick(p.id)) made++; }
  return made;
}

// One development step (an offseason): each PROSPECT player's overall grows toward
// its scouted potential on an age curve, and it ages a year. Ratings track overall.
export async function developProspects(): Promise<{ developed: number; nowNhlCalibre: number; topGains: { name: string; from: number; to: number }[] }> {
  const players = await prisma.player.findMany({
    where: { rosterType: "PROSPECT", overall: { not: null } },
    select: { id: true, name: true, overall: true, age: true, isGoalie: true },
  });
  // scouted potential lives on the linked DraftProspect
  const links = await prisma.draftProspect.findMany({ where: { playerId: { in: players.map((p) => p.id) } }, select: { playerId: true, potential: true } });
  const potById = new Map(links.map((l) => [l.playerId!, l.potential]));

  const gains: { name: string; from: number; to: number }[] = [];
  let developed = 0, nowNhlCalibre = 0;
  for (const p of players) {
    const ov = p.overall ?? 50;
    const pot = Math.max(ov, potById.get(p.id) ?? ov);
    const age = (p.age ?? 18) + 1;
    const gap = pot - ov;
    // growth rate by age: fast to 21, tapering to 0 after ~25
    const rate = age <= 20 ? 0.45 : age <= 22 ? 0.32 : age <= 24 ? 0.2 : age <= 26 ? 0.08 : 0;
    let grow = Math.round(gap * rate);
    if (gap > 0 && rate > 0 && grow < 1) grow = 1; // always inch forward while young
    const next = Math.min(pot, ov + grow);
    const attrObj: Record<string, number> = {};
    for (const a of ATTRS) attrObj[a] = next;
    if (p.isGoalie) attrObj.du = Math.min(92, next + 5);
    await prisma.player.update({ where: { id: p.id }, data: { overall: next, age, ...attrObj } });
    if (next > ov) { developed++; gains.push({ name: p.name, from: ov, to: next }); }
    if (next >= NHL_CALIBRE) nowNhlCalibre++;
  }
  gains.sort((a, b) => (b.to - b.from) - (a.to - a.from));
  return { developed, nowNhlCalibre, topGains: gains.slice(0, 8) };
}
