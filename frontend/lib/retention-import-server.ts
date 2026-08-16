"use server";

// Import salary retentions from profinhl.cz/RetainedSalary.php and store the
// retained amount on the matching player. Columns: TEAM, PLAYER, TRADED TO,
// RETAINED SALARY (full contract), TOTAL SALARY RETENTION (the dead-money amount).

import { prisma } from "./prisma";

const URL = "https://profinhl.cz/RetainedSalary.php";
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z ]+/g, "").replace(/\s+/g, " ").trim();
const eur = (s: string) => Number(s.replace(/[^0-9]/g, "")) || 0; // "1.700.000$" → 1700000
const strip = (h: string) => h.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();

export async function importRetentionsFromProfinhl(): Promise<{ applied: number; cleared: number; names: string[] }> {
  const html = await (await fetch(URL, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];

  // clear any prior retentions first (so removed ones reset to 0)
  const cleared = (await prisma.player.updateMany({ where: { retainedSalary: { gt: 0 } }, data: { retainedSalary: 0 } })).count;

  const names: string[] = [];
  let applied = 0;
  for (const r of rows) {
    const cells = (r.match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? []).map(strip);
    if (cells.length < 6) continue;
    const player = cells[1];
    const retention = eur(cells[5]); // TOTAL SALARY RETENTION
    if (!player || player === "-" || retention <= 0) continue;

    // match only on the full name (no last-name fallback — that mis-hits e.g.
    // Marc Staal → Jordan Staal). Abbreviated first names ("C. De Haan") won't
    // match, which is correct: those are bought-out veterans not on our rosters.
    const p = await prisma.player.findFirst({ where: { name: { contains: player, mode: "insensitive" } }, select: { id: true, name: true } });
    if (!p) continue;
    await prisma.player.update({ where: { id: p.id }, data: { retainedSalary: retention } });
    names.push(`${p.name} ($${(retention / 1e6).toFixed(2)}M)`);
    applied++;
  }
  return { applied, cleared, names };
}
