// Prospect development — a franchise's drafted prospects grow toward their scouted
// potential over the offseasons, so draft picks pan out (or don't). Kept entirely
// on the DraftProspect record: no Player rows are created (the roster/reserve list
// stays clean; a GM promotes a prospect to a real player with the normal tools).
// Draft "success" = a pick whose developed OV reaches NHL-calibre.

import { prisma } from "./prisma";

export const NHL_CALIBRE = 78;

// The DraftProspect `source` that belongs to the active roster world:
//   real mode  → "real" (the imported real NHL draft)
//   profinhl   → this league's own draft (source null or "profinhl")
export async function draftSourceFilter(): Promise<Record<string, unknown>> {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } });
  return cfg?.rosterMode === "real" ? { source: "real" } : { OR: [{ source: null }, { source: "profinhl" }] };
}

// One development step (an offseason): each drafted prospect's OV grows a fraction
// of the way toward its scouted potential.
export async function developProspects(): Promise<{ developed: number; nowNhlCalibre: number; topGains: { name: string; from: number; to: number }[] }> {
  const src = await draftSourceFilter();
  const picks = await prisma.draftProspect.findMany({
    where: { draftedByTeamId: { not: null }, overallPick: { not: null }, draftYear: { gte: 2026 }, ...src },
    select: { id: true, name: true, ov: true, potential: true },
  });
  const gains: { name: string; from: number; to: number }[] = [];
  let developed = 0, nowNhlCalibre = 0;
  for (const p of picks) {
    const ov = p.ov ?? 50;
    const pot = Math.max(ov, p.potential ?? ov);
    const gap = pot - ov;
    let grow = Math.round(gap * 0.3);
    if (gap > 0 && grow < 1) grow = 1;
    const next = Math.min(pot, ov + grow);
    if (next > ov) { await prisma.draftProspect.update({ where: { id: p.id }, data: { ov: next } }); developed++; gains.push({ name: p.name, from: ov, to: next }); }
    if (next >= NHL_CALIBRE) nowNhlCalibre++;
  }
  gains.sort((a, b) => (b.to - b.from) - (a.to - a.from));
  return { developed, nowNhlCalibre, topGains: gains.slice(0, 8) };
}
