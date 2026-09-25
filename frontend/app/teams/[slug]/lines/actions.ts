"use server";

import { prisma } from "@/lib/prisma";
import { canManageTeam } from "@/lib/auth";
import { saveTeamLines, autoLines, type TeamLinesData, type ForwardLine, type DefensePair } from "@/lib/sim/lines";
import { PRESETS, systemFit, type RosterProfile, type TeamTactics } from "@/lib/sim/tactics";
import { tacticalFitForwards, tacticalFitDefense, type TacticalFitPlayer } from "@/lib/sim/tactical-fit";
import { reshuffleBySlot } from "@/lib/sim/line-reshuffle";
import { displayName } from "@/lib/playerName";
import { revalidatePath } from "next/cache";

export async function saveLines(slug: string, data: TeamLinesData) {
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true } });
  if (!team) throw new Error("Team not found");
  if (!(await canManageTeam(team.id))) throw new Error("Not authorized for this team");
  const saved = await saveTeamLines(team.id, data, { strict: true });
  revalidatePath(`/teams/${slug}/lines`);
  return saved;
}

type Atk = { id: number; name: string; position: string; overall: number; shoots: string | null; sc: number; pa: number; ck: number; df: number; st: number; fg: number; fo: number; ph: number; sk: number; en: number; weight: number };
const A = (v: number | null | undefined, d = 50) => v ?? d;
const fitPlayer = (p: Atk | undefined): TacticalFitPlayer | null => p == null
  ? null
  : { position: p.position, shoots: p.shoots, pa: p.pa, sc: p.sc, sk: p.sk, ck: p.ck, df: p.df, st: p.st, fo: p.fo, en: p.en, weight: p.weight, ph: p.ph };
const lastName = (byId: Map<number, Atk>, id: number) => displayName(byId.get(id)?.name ?? `#${id}`).split(" ").pop();

/** AI GM Assistance — suggest a full lineup + per-line tactics + team system from
 *  the current roster. Returns lines the GM can Apply or discard. Pure analysis of
 *  the players' attributes (no external AI). */
export async function suggestLinesAction(slug: string): Promise<{ ok: false; error: string } | { ok: true; lines: TeamLinesData; system: string; rationale: string[] }> {
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, league: true } });
  if (!team) return { ok: false, error: "Team not found." };
  if (!(await canManageTeam(team.id))) return { ok: false, error: "Not authorized for this team." };
  const rosterType = team.league === "AHL" ? "AHL" : "NHL";
  const rows = await prisma.player.findMany({
    where: { teamId: team.id, rosterType, injuryDaysLeft: { lte: 0 }, scratched: false },
    select: { id: true, name: true, position: true, overall: true, isGoalie: true, shoots: true, sc: true, pa: true, ck: true, df: true, st: true, fg: true, fo: true, ph: true, sk: true, en: true, weight: true },
  });
  const skaters: Atk[] = rows.filter((p) => !p.isGoalie).map((p) => ({ id: p.id, name: p.name, position: p.position ?? "C", overall: p.overall ?? 50, shoots: p.shoots, sc: A(p.sc), pa: A(p.pa), ck: A(p.ck), df: A(p.df), st: A(p.st), fg: A(p.fg), fo: A(p.fo), ph: A(p.ph, 75), sk: A(p.sk), en: A(p.en), weight: p.weight ?? 90 }));
  const goalies = rows.filter((p) => p.isGoalie).map((p) => ({ id: p.id, overall: p.overall ?? 50 }));
  if (skaters.length < 5) return { ok: false, error: "Príliš málo hráčov na návrh zostavy." };

  // position-aware base lineup, then data-driven tactics
  const lines = autoLines(skaters.map((p) => ({ id: p.id, position: p.position, overall: p.overall, shoots: p.shoots })), goalies);
  const byId = new Map(skaters.map((p) => [p.id, p]));
  const rationale: string[] = [];
  const clamp = (n: number) => Math.max(0, Math.min(5, Math.round(n)));

  // team system — the preset whose fit is highest for this roster. Resolved
  // BEFORE the archetype reshuffle below so that pass judges each line's
  // Tactical Fit against the system we're actually about to apply, not a
  // placeholder.
  const top = [...skaters].sort((a, b) => b.overall - a.overall).slice(0, 18);
  const m = (f: (p: Atk) => number) => top.reduce((s, p) => s + f(p), 0) / Math.max(1, top.length);
  const profile: RosterProfile = { sk: m((p) => p.sk), en: m((p) => p.en), ck: m((p) => p.ck), sc: m((p) => p.sc), pa: m((p) => p.pa), df: m((p) => p.df), st: m((p) => p.st), weight: m((p) => p.weight) };
  let bestName = "Balanced", bestFit = -Infinity;
  for (const [name, t] of Object.entries(PRESETS)) { const f = systemFit(profile, t); if (f > bestFit) { bestFit = f; bestName = name; } }
  const chosenTactics: TeamTactics = PRESETS[bestName];
  lines.system = { ...(lines.system ?? {}), ...chosenTactics };
  rationale.push(`Tímový systém: <b>${bestName}</b> — najlepšie sadne na tento roster (SK ${Math.round(profile.sk)}, DF ${Math.round(profile.df)}, CK ${Math.round(profile.ck)}).`);

  // archetype reshuffle: swap same-SLOT players ACROSS lines/pairs (LW<->LW,
  // C<->C, ... never changing WHO dresses, only WHICH line/pair they play on)
  // whenever it raises total Tactical Fit — so a grinder autoLines() happened
  // to slot onto the 1st line by raw overall alone moves to where his real
  // scouting archetype actually fits (see lib/sim/tactical-fit.ts, Rules §16).
  const fScore = (fs: ForwardLine[]) => fs.reduce((sum, l, i) =>
    sum + tacticalFitForwards([l.lw, l.c, l.rw].map((id) => id != null ? fitPlayer(byId.get(id)) : null), chosenTactics, l.puck, i), 0);
  const { units: reshuffledF, swaps: fSwaps } = reshuffleBySlot(lines.forwardLines, ["c", "lw", "rw"], fScore,
    (a, b, key, i, j) => `${lastName(byId, a)} ↔ ${lastName(byId, b)} (${String(key).toUpperCase()}, ${i + 1}. ↔ ${j + 1}. lajna) — lepšie sedia na opačnú líniu`);
  lines.forwardLines = reshuffledF;
  const dScore = (ds: DefensePair[]) => ds.reduce((sum, p, i) =>
    sum + tacticalFitDefense([p.ld, p.rd].map((id) => id != null ? fitPlayer(byId.get(id)) : null), chosenTactics, p.dzone, i), 0);
  const { units: reshuffledD, swaps: dSwaps } = reshuffleBySlot(lines.defensePairs, ["ld", "rd"], dScore,
    (a, b, key, i, j) => `${lastName(byId, a)} ↔ ${lastName(byId, b)} (${String(key).toUpperCase()}, ${i + 1}. ↔ ${j + 1}. pár) — lepšie sedia na opačný pár`);
  lines.defensePairs = reshuffledD;
  for (const s of fSwaps) rationale.push(`Výmena na útoku: ${s}`);
  for (const s of dSwaps) rationale.push(`Výmena v obrane: ${s}`);

  // forward lines: allocate a 5-point PHY/DF/OF budget from the (now reshuffled) trio's profile
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
    const names = trio.map((p) => displayName(p.name).split(" ").pop()).join("-");
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
    const dnames = pair.map((x) => displayName(x.name).split(" ").pop()).join("-");
    rationale.push(`${i + 1}. obranný pár (${dnames}): ${why} → PHY ${p.tactic.phy} / DF ${p.tactic.df} / OF ${p.tactic.of}`);
  });

  return { ok: true, lines, system: bestName, rationale };
}
