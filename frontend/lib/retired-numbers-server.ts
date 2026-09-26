// Retired numbers — each club's real NHL history (lib/data/retired-numbers-nhl.json,
// the 186 numbers on Wikipedia's "List of NHL retired numbers", incl. Gretzky's 99
// league-wide) plus the numbers GMs retire for their own UNHL legends.
//
// A GM can retire a number for a player who has retired from playing (or is in the
// UNHL Hall of Fame) and played at least `retireMinGames` UNHL games for the club
// (0 = Hall of Famers only). The ceremony is announced in League News. A retired
// number can't be handed out to anyone else on that club (existing wearers keep it).
import { prisma } from "./prisma";
import { REGULAR_SEASON } from "./phase";
import { loadSettings } from "./sim/settings";
import { cleanName } from "./playerName";
import historic from "./data/retired-numbers-nhl.json";

type Historic = { name: string; team: string; number: number; year: number | null };

export async function seedHistoricRetiredNumbers(): Promise<number> {
  const teams = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, name: true } });
  const byName = new Map(teams.map((t) => [t.name.toUpperCase(), t.id]));
  let n = 0;
  for (const h of historic as Historic[]) {
    const ids = h.team === "ALL" ? teams.map((t) => t.id) : [byName.get(h.team.toUpperCase())].filter((x): x is number => x != null);
    for (const teamId of ids) {
      const note = h.team === "ALL" ? `Retired league-wide${h.year ? ` (${h.year})` : ""}` : h.year ? `Retired ${h.year}` : null;
      await prisma.retiredNumber.upsert({
        where: { teamId_number_playerName: { teamId, number: h.number, playerName: h.name } },
        update: { note, historic: true },
        create: { teamId, number: h.number, playerName: h.name, note, historic: true },
      });
      n++;
    }
  }
  return n;
}

export async function retiredNumbersOf(teamId: number) {
  return prisma.retiredNumber.findMany({ where: { teamId }, orderBy: [{ number: "asc" }, { createdAt: "asc" }] });
}

export async function retiredSet(teamId: number): Promise<Set<number>> {
  return new Set((await prisma.retiredNumber.findMany({ where: { teamId }, select: { number: true } })).map((r) => r.number));
}

export type RetireCandidate = { playerId: number; name: string; number: number | null; gp: number; hof: boolean; retiredSeason: string | null };

/** Players this club may honour: retired (or HoF), enough UNHL games for the club. */
export async function retireCandidates(teamId: number): Promise<RetireCandidate[]> {
  const s = await loadSettings();
  const grouped = await prisma.playerGameStat.groupBy({ by: ["playerId"], where: { teamId, game: { league: "NHL", season: { not: { contains: "PRE" } } } }, _count: { _all: true } });
  const gpBy = new Map(grouped.map((g) => [g.playerId, g._count._all]));
  if (!gpBy.size) return [];
  const players = await prisma.player.findMany({ where: { id: { in: [...gpBy.keys()] }, OR: [{ rosterType: "RETIRED" }, { hofSeason: { not: null } }] }, select: { id: true, name: true, number: true, hofSeason: true, retiredSeason: true } });
  const done = new Set((await prisma.retiredNumber.findMany({ where: { teamId, playerId: { not: null } }, select: { playerId: true } })).map((r) => r.playerId));
  return players
    .map((p) => ({ playerId: p.id, name: cleanName(p.name), number: p.number, gp: gpBy.get(p.id) ?? 0, hof: !!p.hofSeason, retiredSeason: p.retiredSeason }))
    .filter((c) => !done.has(c.playerId) && (c.hof || (s.retireMinGames > 0 && c.gp >= s.retireMinGames)))
    .sort((a, b) => b.gp - a.gp);
}

export async function retireNumber(teamId: number, playerId: number, number: number, note: string, opts: { asAdmin?: boolean } = {}): Promise<void> {
  if (!Number.isInteger(number) || number < 1 || number > 99) throw new Error("A jersey number is 1–99.");
  if (!opts.asAdmin) {
    const ok = (await retireCandidates(teamId)).some((c) => c.playerId === playerId);
    if (!ok) throw new Error("This player isn't eligible — he must be retired (or in the Hall of Fame) with enough games for your club.");
  }
  const [pl, team] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId }, select: { name: true, slug: true } }),
    prisma.team.findUnique({ where: { id: teamId }, select: { name: true, id: true } }),
  ]);
  if (!pl || !team) throw new Error("Not found.");
  // the club's active players can't lose a number mid-career — wait until it's free
  const orgIds = [teamId, ...(await prisma.team.findMany({ where: { parentTeamId: teamId }, select: { id: true } })).map((t) => t.id)];
  const wearer = await prisma.player.findFirst({ where: { teamId: { in: orgIds }, number, rosterType: { in: ["NHL", "AHL"] }, id: { not: playerId } }, select: { name: true } });
  if (wearer) throw new Error(`#${number} is worn by ${cleanName(wearer.name)} — it can be retired once it's free.`);
  const name = cleanName(pl.name);
  await prisma.retiredNumber.create({ data: { teamId, number, playerId, playerName: name, season: REGULAR_SEASON, note: note.trim().slice(0, 300) || null } });
  const author = await prisma.team.findFirst({ where: { isAdmin: true }, orderBy: { id: "asc" }, select: { id: true } });
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  if (author) await prisma.newsArticle.create({ data: { authorTeamId: author.id, title: `🎽 ${team.name} retire #${number} for ${name}`, bodyHtml: `<p>Before a sold-out crowd, the <b>${esc(team.name)}</b> raised <b>${esc(name)}</b>'s #${number} to the rafters. No one will wear it for the club again.</p>${note.trim() ? `<p>${esc(note.trim())}</p>` : ""}<p><a href="${pl.slug ? `/players/${pl.slug}` : "#"}">Career</a> · <a href="/hall-of-fame">Hall of Fame</a></p>` } }).catch(() => {});
  await prisma.transaction.create({ data: { type: "RETIRED_NUMBER", message: `🎽 ${team.name} retire #${number} in honour of ${name}.` } }).catch(() => {});
}

export async function unretireNumber(id: number): Promise<void> {
  await prisma.retiredNumber.delete({ where: { id } });
}

/** Throws when a roster save hands a retired number to someone new. */
export async function assertNumbersAllowed(teamId: number, rows: { id: number; number: number | null }[]): Promise<void> {
  const org = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, league: true, parentTeamId: true } });
  const clubId = org?.league === "NHL" ? org.id : org?.parentTeamId;
  if (!clubId) return;
  const retiredRows = await prisma.retiredNumber.findMany({ where: { teamId: clubId }, select: { number: true, playerName: true, playerId: true } });
  if (!retiredRows.length) return;
  const club = await prisma.team.findUnique({ where: { id: clubId }, select: { name: true } });
  const players = new Map((await prisma.player.findMany({ where: { id: { in: rows.map((r) => r.id) } }, select: { id: true, number: true, name: true } })).map((p) => [p.id, p]));
  const norm = (s: string) => cleanName(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const msgs: string[] = [];
  for (const r of rows) {
    const p = players.get(r.id);
    if (r.number == null || !p || p.number === r.number) continue; // unchanged numbers are grandfathered
    const hits = retiredRows.filter((x) => x.number === r.number);
    if (!hits.length) continue;
    // the honoured player himself may always wear his own number
    if (hits.some((x) => x.playerId === p.id || norm(x.playerName) === norm(p.name))) continue;
    msgs.push(`#${r.number} can't be given to ${cleanName(p.name)} — ${club?.name ?? "the club"} retired it for ${hits.map((x) => x.playerName).join(" and ")}.`);
  }
  if (msgs.length) throw new Error(`${msgs.join(" ")} Pick another number.`);
}
