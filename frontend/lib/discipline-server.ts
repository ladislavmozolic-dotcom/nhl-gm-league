// Player Safety — supplementary discipline, NHL style.
//
// After every sim day each NHL game is reviewed (regular season + playoffs):
//   • a game misconduct                                   base 40 %
//   • a major for a violent infraction (boarding, cross-checking, elbowing …) 30 %
//   • a hit that injured an opponent        3 %, +4 % if 7+ days out, +8 % if 20+, +6 % concussion
// Several on the same player in one game stack (+20 %). A repeat offender (a
// suspension in the past 18 months, CBA Art. 18-A) is 1.5× likelier; the player's
// own discipline rating (DI) shifts it ±20 %. All of it × disciplinePct/100.
// Outcome: a fine (weaker incidents, CBA max $5,000) or a suspension of 1–10 games.
// Suspended players don't dress (Player.suspendedGames) and serve in their NHL
// organisation's games. Forfeited salary (CBA): a first offender loses 1/(days in
// the season) of his salary per game, a repeat offender 1/82 — the club doesn't
// pay it, so it's credited to the club's bank. The GM may appeal within 48 h;
// the commissioner upholds, reduces or overturns (the player serves meanwhile).
import { prisma } from "./prisma";
import { RNG } from "./sim/rng";
import { REGULAR_SEASON } from "./phase";
import { loadSettings } from "./sim/settings";
import { cleanName } from "./playerName";
import { money } from "./finance";

const VIOLENT = ["Boarding", "Cross-checking", "Elbowing", "Charging", "Checking to the head", "Slew-footing", "Kneeing", "Slashing", "High-sticking", "Roughing", "Spearing", "Butt-ending", "Clipping"];
export const APPEAL_HOURS = 48;
const REPEAT_WINDOW_DAYS = 548; // 18 months
const MAX_GAMES = 10;
const FINE_MAX = 5000;

type Incident = { playerId: number; teamId: number; kind: "GM" | "MAJOR" | "HIT"; text: string; injuryDays?: number; concussion?: boolean };

const clockTxt = (period: number, seconds: number) => `${period >= 4 ? "OT" : ["1st", "2nd", "3rd"][period - 1]} ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

async function orgOf(teamId: number | null | undefined): Promise<number | null> {
  if (!teamId) return null;
  const t = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, league: true, parentTeamId: true } });
  if (!t) return null;
  return t.league === "NHL" ? t.id : t.parentTeamId ?? null;
}

async function seasonDays(season = REGULAR_SEASON): Promise<number> {
  const [a, b] = await Promise.all([
    prisma.game.findFirst({ where: { season, league: "NHL", seriesId: null }, orderBy: { gameDate: "asc" }, select: { gameDate: true } }),
    prisma.game.findFirst({ where: { season, league: "NHL", seriesId: null }, orderBy: { gameDate: "desc" }, select: { gameDate: true } }),
  ]);
  if (!a?.gameDate || !b?.gameDate) return 186;
  return Math.max(150, Math.round((b.gameDate.getTime() - a.gameDate.getTime()) / 86400000) + 1);
}

async function isRepeat(playerId: number, now = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - REPEAT_WINDOW_DAYS * 86400000);
  return (await prisma.suspension.count({ where: { playerId, kind: "SUSPENSION", status: { not: "OVERTURNED" }, createdAt: { gte: since } } })) > 0;
}

export function forfeitFor(salary: number, games: number, repeat: boolean, days: number): number {
  return Math.round((salary / (repeat ? 82 : days)) * games);
}

async function notifyClub(teamId: number | null, body: string) {
  if (!teamId) return;
  await prisma.dmMessage.create({ data: { fromTeamId: teamId, toTeamId: teamId, body, tradeUrl: "/league/player-safety" } }).catch(() => {});
}

async function credit(teamId: number | null, amount: number) {
  if (!teamId || !amount) return;
  await prisma.team.update({ where: { id: teamId }, data: { bankAccount: { increment: amount }, ledgerAdj: { increment: amount } } });
}

async function syncPlayer(playerId: number) {
  const act = await prisma.suspension.findMany({ where: { playerId, status: "ACTIVE", kind: "SUSPENSION" }, select: { games: true, gamesServed: true } });
  const left = act.reduce((t, s) => t + Math.max(0, s.games - s.gamesServed), 0);
  await prisma.player.update({ where: { id: playerId }, data: { suspendedGames: left } });
}

/** Collect reviewable incidents from one finished game. */
async function incidentsOf(gameId: number): Promise<Incident[]> {
  const [pens, injuries] = await Promise.all([
    prisma.gamePenalty.findMany({ where: { gameId }, select: { playerId: true, teamId: true, type: true, severity: true, period: true, seconds: true } }),
    prisma.gameEvent.findMany({ where: { gameId, type: "INJURY", targetId: { not: null } }, select: { targetId: true, playerId: true, teamId: true, period: true, seconds: true, meta: true } }),
  ]);
  const out: Incident[] = [];
  for (const p of pens) {
    if (p.severity === "Game Misconduct") {
      const base = pens.find((x) => x.playerId === p.playerId && x.period === p.period && x.seconds === p.seconds && x.severity !== "Game Misconduct" && x.severity !== "Misconduct");
      out.push({ playerId: p.playerId, teamId: p.teamId, kind: "GM", text: `${base ? `${base.type} ${base.severity.toLowerCase()} + ` : ""}game misconduct, ${clockTxt(p.period, p.seconds)}` });
    } else if (p.severity === "Major" && VIOLENT.includes(p.type) && !pens.some((x) => x.playerId === p.playerId && x.period === p.period && x.seconds === p.seconds && x.severity === "Game Misconduct")) {
      out.push({ playerId: p.playerId, teamId: p.teamId, kind: "MAJOR", text: `${p.type} major, ${clockTxt(p.period, p.seconds)}` });
    }
  }
  for (const i of injuries) {
    const m = (i.meta ?? {}) as { mechanism?: string; days?: number; part?: string };
    if (m.mechanism !== "Hit" && m.mechanism !== "Collision") continue;
    const [hitter, victim] = await Promise.all([
      prisma.player.findUnique({ where: { id: i.targetId! }, select: { teamId: true } }),
      i.playerId ? prisma.player.findUnique({ where: { id: i.playerId }, select: { name: true } }) : Promise.resolve(null),
    ]);
    out.push({ playerId: i.targetId!, teamId: hitter?.teamId ?? 0, kind: "HIT", injuryDays: m.days ?? 0, concussion: m.part === "Concussion",
      text: `${m.mechanism === "Hit" ? "hit" : "collision"} injuring ${victim ? cleanName(victim.name) : "an opponent"} (${m.part ?? "injury"}, ~${m.days ?? "?"} days), ${clockTxt(i.period, i.seconds)}` });
  }
  return out;
}

/** Review a set of finished games; creates rulings. Idempotent per (player, game). */
export async function reviewGames(gameIds: number[]): Promise<{ suspensions: number; fines: number }> {
  const s = await loadSettings();
  if (!s.disciplineEnabled || !gameIds.length) return { suspensions: 0, fines: 0 };
  const scale = Math.max(0, s.disciplinePct) / 100;
  const days = await seasonDays();
  let suspensions = 0, fines = 0;
  const games = await prisma.game.findMany({ where: { id: { in: gameIds }, league: "NHL", status: "FINAL" }, select: { id: true, seed: true, season: true, gameDate: true, homeTeam: { select: { code: true } }, awayTeam: { select: { code: true } } } });
  for (const g of games) {
    if (g.season !== REGULAR_SEASON) continue; // exhibition games aren't reviewed
    const inc = await incidentsOf(g.id);
    const byPlayer = new Map<number, Incident[]>();
    for (const i of inc) byPlayer.set(i.playerId, [...(byPlayer.get(i.playerId) ?? []), i]);
    for (const [playerId, list] of byPlayer) {
      if (await prisma.suspension.findFirst({ where: { playerId, gameId: g.id }, select: { id: true } })) continue;
      const pl = await prisma.player.findUnique({ where: { id: playerId }, select: { name: true, di: true, capHit: true, teamId: true } });
      if (!pl) continue;
      const rng = new RNG(((g.seed ?? g.id) * 31 + playerId * 7919) >>> 0);
      const repeat = await isRepeat(playerId);
      let p = 0;
      for (const i of list) {
        const pi = i.kind === "GM" ? 0.4 : i.kind === "MAJOR" ? 0.3 : 0.03 + ((i.injuryDays ?? 0) >= 20 ? 0.08 : (i.injuryDays ?? 0) >= 7 ? 0.04 : 0) + (i.concussion ? 0.06 : 0);
        p = Math.max(p, pi);
      }
      if (list.length > 1) p += 0.2;
      if (repeat) p *= 1.5;
      const di = pl.di ?? 50;
      p *= di < 40 ? 1.2 : di > 75 ? 0.8 : 1;
      p = Math.min(0.95, p * scale);
      if (rng.next() >= p) continue;

      const worst = list.find((i) => i.kind === "GM") ?? list.find((i) => i.kind === "HIT" && (i.injuryDays ?? 0) >= 7) ?? list[0];
      const incident = `${list.map((i) => i.text).join("; ")} — ${g.awayTeam.code} @ ${g.homeTeam.code}, ${g.gameDate?.toISOString().slice(0, 10) ?? ""}`;
      const org = await orgOf(pl.teamId);
      const name = cleanName(pl.name);
      // weaker incidents (a lone major / minor injury, no history) are often just a fine
      const fineOnly = !repeat && worst.kind !== "GM" && !((worst.injuryDays ?? 0) >= 7) && rng.next() < 0.35;
      if (fineOnly) {
        const fine = Math.round((2000 + rng.next() * (FINE_MAX - 2000)) / 100) * 100;
        await prisma.suspension.create({ data: { season: REGULAR_SEASON, playerId, playerName: name, teamId: org, gameId: g.id, incident, kind: "FINE", fine, status: "SERVED" } });
        await prisma.transaction.create({ data: { type: "DISCIPLINE", message: `⚖️ Player Safety: ${name} fined $${fine.toLocaleString("en-US")} (maximum allowed under the CBA) — ${list[0].text}.` } }).catch(() => {});
        await notifyClub(org, `⚖️ Player Safety fined ${name} $${fine.toLocaleString("en-US")} for ${list[0].text}. No games — he's available tonight.`);
        fines++;
        continue;
      }
      let games = 1;
      if (worst.kind === "GM") games += 1;
      if ((worst.injuryDays ?? 0) >= 20) games += 1;
      if (list.some((i) => i.concussion)) games += 1;
      if (repeat) games += 1 + rng.int(2);
      games += rng.next() < 0.3 ? 1 : 0;
      games = Math.min(MAX_GAMES, games);
      const forfeit = forfeitFor(pl.capHit ?? 0, games, repeat, days);
      await prisma.suspension.create({ data: { season: REGULAR_SEASON, playerId, playerName: name, teamId: org, gameId: g.id, incident, games, forfeit, repeatOffender: repeat } });
      await syncPlayer(playerId);
      await credit(org, forfeit);
      await prisma.transaction.create({ data: { type: "DISCIPLINE", message: `⚖️ Player Safety: ${name} suspended ${games} game${games === 1 ? "" : "s"}${repeat ? " (repeat offender)" : ""} — ${list[0].text}. Forfeits ${money(forfeit)}.` } }).catch(() => {});
      await notifyClub(org, `⚖️ ${name} has been suspended for ${games} game${games === 1 ? "" : "s"}${repeat ? " as a repeat offender" : ""}: ${list.map((i) => i.text).join("; ")}. He forfeits ${money(forfeit)} of salary (credited back to your bank). You can appeal to the commissioner within ${APPEAL_HOURS} hours on the Player Safety page.`);
      suspensions++;
    }
  }
  return { suspensions, fines };
}

/** Count today's games toward every active suspension issued before `before`. */
export async function serveSuspensions(gameIds: number[], before: Date): Promise<number> {
  if (!gameIds.length) return 0;
  const games = await prisma.game.findMany({ where: { id: { in: gameIds }, league: "NHL", status: "FINAL", season: REGULAR_SEASON }, select: { homeTeamId: true, awayTeamId: true } });
  const playedCount = new Map<number, number>();
  for (const g of games) for (const t of [g.homeTeamId, g.awayTeamId]) playedCount.set(t, (playedCount.get(t) ?? 0) + 1);
  const active = await prisma.suspension.findMany({ where: { status: "ACTIVE", kind: "SUSPENSION", createdAt: { lt: before } }, orderBy: { createdAt: "asc" } });
  let served = 0;
  const touched = new Set<number>();
  const usedBy = new Map<number, number>(); // playerId → games of today already credited (two stacked suspensions serve one after the other)
  for (const s of active) {
    const pl = await prisma.player.findUnique({ where: { id: s.playerId }, select: { teamId: true } });
    const org = await orgOf(pl?.teamId);
    const avail = (org ? playedCount.get(org) ?? 0 : 0) - (usedBy.get(s.playerId) ?? 0);
    if (avail <= 0) continue;
    const take = Math.min(avail, s.games - s.gamesServed);
    usedBy.set(s.playerId, (usedBy.get(s.playerId) ?? 0) + take);
    const gamesServed = s.gamesServed + take;
    await prisma.suspension.update({ where: { id: s.id }, data: { gamesServed, ...(gamesServed >= s.games ? { status: "SERVED" } : {}) } });
    touched.add(s.playerId);
    served += take;
  }
  for (const id of touched) await syncPlayer(id);
  return served;
}

// ---------------------------------------------------------------------------
// appeals + commissioner rulings
// ---------------------------------------------------------------------------

export async function appealSuspension(id: number, teamId: number, text: string): Promise<void> {
  const s = await prisma.suspension.findUnique({ where: { id } });
  if (!s || s.kind !== "SUSPENSION") throw new Error("No such suspension.");
  if (s.teamId !== teamId) throw new Error("Only the player's club can appeal.");
  if (s.appealStatus) throw new Error("This suspension has already been appealed.");
  if (s.status !== "ACTIVE") throw new Error("The suspension has already been served.");
  if (Date.now() - s.createdAt.getTime() > APPEAL_HOURS * 3600000) throw new Error(`Appeals must be filed within ${APPEAL_HOURS} hours.`);
  const body = text.trim().slice(0, 1500);
  if (body.length < 10) throw new Error("Tell the commissioner why (a sentence or two).");
  await prisma.suspension.update({ where: { id }, data: { appealStatus: "PENDING", appealText: body, appealAt: new Date() } });
  await prisma.transaction.create({ data: { type: "DISCIPLINE", message: `⚖️ ${s.playerName}'s club has appealed his ${s.games}-game suspension to the commissioner.` } }).catch(() => {});
}

/** Commissioner: uphold / reduce (to `games`) / overturn a suspension — on appeal or on his own. */
export async function ruleOnSuspension(id: number, decision: "UPHELD" | "REDUCED" | "OVERTURNED", games: number | null, note: string): Promise<void> {
  const s = await prisma.suspension.findUnique({ where: { id } });
  if (!s || s.kind !== "SUSPENSION") throw new Error("No such suspension.");
  const pl = await prisma.player.findUnique({ where: { id: s.playerId }, select: { capHit: true } });
  const days = await seasonDays(s.season);
  let newGames = s.games;
  if (decision === "OVERTURNED") newGames = 0;
  if (decision === "REDUCED") { if (games == null || games < 1 || games >= s.games) throw new Error(`Reduce to between 1 and ${s.games - 1} games.`); newGames = games; }
  const newForfeit = newGames ? forfeitFor(pl?.capHit ?? 0, newGames, s.repeatOffender, days) : 0;
  await prisma.suspension.update({ where: { id }, data: {
    games: newGames, forfeit: newForfeit, appealStatus: decision, appealNote: note.trim().slice(0, 1000) || null, appealDecidedAt: new Date(),
    status: decision === "OVERTURNED" ? "OVERTURNED" : s.gamesServed >= newGames ? "SERVED" : s.status,
  } });
  await credit(s.teamId, newForfeit - s.forfeit); // a reduction pays the player back (the club's saving shrinks)
  await syncPlayer(s.playerId);
  const verdict = decision === "UPHELD" ? `upheld (${s.games} games)` : decision === "REDUCED" ? `reduced from ${s.games} to ${newGames} games` : "overturned";
  await prisma.transaction.create({ data: { type: "DISCIPLINE", message: `⚖️ Commissioner: ${s.playerName}'s suspension ${verdict}.${note.trim() ? ` "${note.trim().slice(0, 200)}"` : ""}` } }).catch(() => {});
  await notifyClub(s.teamId, `⚖️ The commissioner has ${verdict} ${s.playerName}'s suspension.${note.trim() ? ` Note: ${note.trim()}` : ""}`);
}

/** Commissioner: a supplementary-discipline ruling of his own (suspension or fine). */
export async function issueDiscipline(d: { playerId: number; kind: "SUSPENSION" | "FINE"; games: number; fine: number; incident: string }): Promise<void> {
  const pl = await prisma.player.findUnique({ where: { id: d.playerId }, select: { name: true, capHit: true, teamId: true } });
  if (!pl) throw new Error("Player not found.");
  const incident = d.incident.trim().slice(0, 300);
  if (!incident) throw new Error("Describe the incident.");
  const org = await orgOf(pl.teamId);
  const name = cleanName(pl.name);
  if (d.kind === "FINE") {
    const fine = Math.max(0, Math.round(d.fine));
    await prisma.suspension.create({ data: { season: REGULAR_SEASON, playerId: d.playerId, playerName: name, teamId: org, incident, kind: "FINE", fine, status: "SERVED", source: "MANUAL" } });
    await prisma.transaction.create({ data: { type: "DISCIPLINE", message: `⚖️ Player Safety: ${name} fined $${fine.toLocaleString("en-US")} — ${incident}.` } }).catch(() => {});
    await notifyClub(org, `⚖️ The commissioner fined ${name} $${fine.toLocaleString("en-US")}: ${incident}.`);
    return;
  }
  const games = Math.max(1, Math.min(82, Math.round(d.games)));
  const repeat = await isRepeat(d.playerId);
  const forfeit = forfeitFor(pl.capHit ?? 0, games, repeat, await seasonDays());
  await prisma.suspension.create({ data: { season: REGULAR_SEASON, playerId: d.playerId, playerName: name, teamId: org, incident, games, forfeit, repeatOffender: repeat, source: "MANUAL" } });
  await syncPlayer(d.playerId);
  await credit(org, forfeit);
  await prisma.transaction.create({ data: { type: "DISCIPLINE", message: `⚖️ Player Safety: ${name} suspended ${games} game${games === 1 ? "" : "s"} — ${incident}. Forfeits ${money(forfeit)}.` } }).catch(() => {});
  await notifyClub(org, `⚖️ The commissioner suspended ${name} for ${games} game${games === 1 ? "" : "s"}: ${incident}. He forfeits ${money(forfeit)} of salary (credited to your bank). You can appeal within ${APPEAL_HOURS} hours on the Player Safety page.`);
}

export async function disciplineList(season = REGULAR_SEASON) {
  const rows = await prisma.suspension.findMany({ where: { season }, orderBy: { createdAt: "desc" } });
  const teams = await prisma.team.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.teamId).filter((x): x is number => x != null))] } }, select: { id: true, code: true, logoUrl: true } });
  const players = await prisma.player.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.playerId))] } }, select: { id: true, slug: true } });
  const tBy = new Map(teams.map((t) => [t.id, t])), pBy = new Map(players.map((p) => [p.id, p.slug]));
  return rows.map((r) => ({ ...r, teamCode: r.teamId ? tBy.get(r.teamId)?.code ?? null : null, teamLogo: r.teamId ? tBy.get(r.teamId)?.logoUrl ?? null : null, slug: pBy.get(r.playerId) ?? null }));
}
