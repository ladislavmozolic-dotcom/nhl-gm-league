"use server";

import { prisma } from "@/lib/prisma";
import { canManageTeam } from "@/lib/auth";
import { saveTeamLines, autoLines, type TeamLinesData } from "@/lib/sim/lines";
import { PRESETS, systemFit, type RosterProfile } from "@/lib/sim/tactics";
import { cleanName } from "@/lib/playerName";
import { revalidatePath } from "next/cache";

export async function saveLines(slug: string, data: TeamLinesData) {
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true } });
  if (!team) throw new Error("Team not found");
  if (!(await canManageTeam(team.id))) throw new Error("Not authorized for this team");
  await saveTeamLines(team.id, data);
  revalidatePath(`/teams/${slug}/lines`);
}

type Atk = { id: number; name: string; position: string; overall: number; shoots: string | null; sc: number; pa: number; ck: number; df: number; st: number; fg: number; sk: number; en: number; weight: number };
const A = (v: number | null | undefined, d = 50) => v ?? d;

/** AI GM Assistance — suggest a full lineup + per-line tactics + team system from
 *  the current roster. Returns lines the GM can Apply or discard. Pure analysis of
 *  the players' attributes (no external AI). */
export async function suggestLinesAction(slug: string): Promise<{ ok: false; error: string } | { ok: true; lines: TeamLinesData; system: string; rationale: string[] }> {
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, league: true } });
  if (!team) return { ok: false, error: "Team not found." };
  if (!(await canManageTeam(team.id))) return { ok: false, error: "Not authorized for this team." };
  const rosterType = team.league === "AHL" ? "AHL" : "NHL";
  const rows = await prisma.player.findMany({
    where: { teamId: team.id, rosterType, injuryDaysLeft: { lte: 0 } },
    select: { id: true, name: true, position: true, overall: true, isGoalie: true, shoots: true, sc: true, pa: true, ck: true, df: true, st: true, fg: true, sk: true, en: true, weight: true },
  });
  const skaters: Atk[] = rows.filter((p) => !p.isGoalie).map((p) => ({ id: p.id, name: p.name, position: p.position ?? "C", overall: p.overall ?? 50, shoots: p.shoots, sc: A(p.sc), pa: A(p.pa), ck: A(p.ck), df: A(p.df), st: A(p.st), fg: A(p.fg), sk: A(p.sk), en: A(p.en), weight: p.weight ?? 90 }));
  const goalies = rows.filter((p) => p.isGoalie).map((p) => ({ id: p.id, overall: p.overall ?? 50 }));
  if (skaters.length < 5) return { ok: false, error: "Príliš málo hráčov na návrh zostavy." };

  // position-aware base lineup, then data-driven tactics
  const lines = autoLines(skaters.map((p) => ({ id: p.id, position: p.position, overall: p.overall, shoots: p.shoots })), goalies);
  const byId = new Map(skaters.map((p) => [p.id, p]));
  const rationale: string[] = [];
  const clamp = (n: number) => Math.max(0, Math.min(5, Math.round(n)));

  // forward lines: allocate a 5-point PHY/DF/OF budget from the trio's profile
  lines.forwardLines.forEach((l, i) => {
    const trio = [l.lw, l.c, l.rw].map((id) => (id != null ? byId.get(id) : null)).filter(Boolean) as Atk[];
    if (!trio.length) return;
    const avg = (f: (p: Atk) => number) => trio.reduce((s, p) => s + f(p), 0) / trio.length;
    const off = avg((p) => (p.sc + p.pa) / 2), def = avg((p) => p.df), phy = avg((p) => (p.ck + p.st + p.fg) / 3);
    let t: { phy: number; df: number; of: number }, why: string;
    if (off - def >= 6) { t = { phy: 0, df: 1, of: 4 }; why = "ofenzívna elitná lajna (vysoké SC/PA)"; }
    else if (def - off >= 5) { t = { phy: 1, df: 3, of: 1 }; why = "obranná/checkerská lajna (vysoké DF)"; }
    else if (phy >= 62 && off < 58) { t = { phy: 2, df: 2, of: 1 }; why = "energia/fyzická lajna (vysoké CK/ST/FG)"; }
    else if (i <= 1) { t = { phy: 1, df: 1, of: 3 }; why = "vyvážená útočná lajna"; }
    else { t = { phy: 1, df: 2, of: 2 }; why = "vyvážená stredná lajna"; }
    l.tactic = { phy: clamp(t.phy), df: clamp(t.df), of: clamp(t.of) };
    const names = trio.map((p) => cleanName(p.name).split(" ").pop()).join("-");
    rationale.push(`${i + 1}. útok (${names}): ${why} → PHY ${l.tactic.phy} / DF ${l.tactic.df} / OF ${l.tactic.of}`);
  });

  // defence pairs: top pair two-way, then by their offensive punch
  lines.defensePairs.forEach((p, i) => {
    const pair = [p.ld, p.rd].map((id) => (id != null ? byId.get(id) : null)).filter(Boolean) as Atk[];
    if (!pair.length) return;
    const off = pair.reduce((s, x) => s + (x.sc + x.pa) / 2, 0) / pair.length;
    const def = pair.reduce((s, x) => s + x.df, 0) / pair.length;
    let t: { phy: number; df: number; of: number }, why: string;
    if (i === 0) { t = { phy: 1, df: 2, of: 2 }; why = "prvý pár — dvojcestný"; }
    else if (off >= 58) { t = { phy: 1, df: 2, of: 2 }; why = "ofenzívny pár (dobré SC/PA)"; }
    else if (def >= 66) { t = { phy: 1, df: 4, of: 0 }; why = "shut-down pár (vysoké DF)"; }
    else { t = { phy: 1, df: 3, of: 1 }; why = "obranný pár"; }
    p.tactic = { phy: clamp(t.phy), df: clamp(t.df), of: clamp(t.of) };
    const dnames = pair.map((x) => cleanName(x.name).split(" ").pop()).join("-");
    rationale.push(`${i + 1}. obranný pár (${dnames}): ${why} → PHY ${p.tactic.phy} / DF ${p.tactic.df} / OF ${p.tactic.of}`);
  });

  // team system — the preset whose fit is highest for this roster
  const top = [...skaters].sort((a, b) => b.overall - a.overall).slice(0, 18);
  const m = (f: (p: Atk) => number) => top.reduce((s, p) => s + f(p), 0) / Math.max(1, top.length);
  const profile: RosterProfile = { sk: m((p) => p.sk), en: m((p) => p.en), ck: m((p) => p.ck), sc: m((p) => p.sc), pa: m((p) => p.pa), df: m((p) => p.df), st: m((p) => p.st), weight: m((p) => p.weight) };
  let bestName = "Balanced", bestFit = -Infinity;
  for (const [name, t] of Object.entries(PRESETS)) { const f = systemFit(profile, t); if (f > bestFit) { bestFit = f; bestName = name; } }
  lines.system = { ...(lines.system ?? {}), ...PRESETS[bestName] };
  rationale.unshift(`Tímový systém: <b>${bestName}</b> — najlepšie sadne na tento roster (SK ${Math.round(profile.sk)}, DF ${Math.round(profile.df)}, CK ${Math.round(profile.ck)}).`);

  return { ok: true, lines, system: bestName, rationale };
}
