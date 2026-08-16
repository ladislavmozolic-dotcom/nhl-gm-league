"use server";

// Import coach salaries (+ links + attributes) from profinhl.cz/Coaches.php and
// attach them as each team's headCoach (NHL + AHL affiliates), matched by name.

import { prisma } from "./prisma";

const URL = "https://profinhl.cz/Coaches.php";
const norm = (s: string) => s.replace(/\(.*?\)/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const num = (s: string) => Number(s.replace(/[^0-9]/g, "")) || 0;
const strip = (h: string) => h.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();

export async function importCoachSalariesFromProfinhl(): Promise<{ linked: number; missed: number }> {
  const html = await (await fetch(URL, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];

  const teams = await prisma.team.findMany({ select: { id: true, name: true } });
  const byName = new Map(teams.map((t) => [norm(t.name), t.id]));

  let linked = 0, missed = 0;
  const seen = new Set<number>();
  for (const r of rows) {
    const cells = (r.match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? []).map(strip);
    if (cells.length < 14) continue;
    const [teamName, coachName, country, style, ph, df, of, pd, ex, ld, ov, age, salary, contract] = cells;
    const teamId = byName.get(norm(teamName));
    if (!teamId || seen.has(teamId)) { if (!teamId) missed++; continue; }
    seen.add(teamId);

    const data = { name: coachName, country: country || null, style: style || "Balanced", ph: num(ph), df: num(df), of: num(of), pd: num(pd), ex: num(ex), ld: num(ld), overall: num(ov), age: num(age) || null, salary: num(salary), contract: num(contract) };
    await prisma.coach.upsert({ where: { teamId }, update: data, create: { teamId, ...data } });
    await prisma.team.update({ where: { id: teamId }, data: { coach: coachName } });
    linked++;
  }
  return { linked, missed };
}
