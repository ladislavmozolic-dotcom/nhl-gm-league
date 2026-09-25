// Deadline Day — the NHL trade deadline as a league event: a live feed of every
// deal made in the final week with UNHL Intelligence grades, a "deadline
// tomorrow" notice to every GM 24 h out, and a recap article (winners & losers)
// posted automatically once the deadline passes. Driven by the 5-minute cron
// (runDeadlineIfDue), deduped on LeagueConfig.deadlineReminderAt / deadlineRecapAt.
import { prisma } from "./prisma";
import { getTradeDeadline } from "./trade-deadline";
import { gradeTradeCached, type TradeGrade } from "./gm-awards";

export const DEADLINE_WEEK_DAYS = 7;
const GRADE_SCORE: Record<string, number> = { "A+": 4.3, A: 4, "B+": 3.3, B: 3, C: 2, D: 1, F: 0 };
const fmt = (d: Date) => d.toLocaleString("sk-SK", { timeZone: "Europe/Bratislava", weekday: "long", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

export type DeadlineDeal = TradeGrade & {
  at: Date; fromTeamId: number; toTeamId: number;
  fromCode: string | null; toCode: string | null; fromLogo: string | null; toLogo: string | null;
  deadlineDay: boolean; // made on the deadline's own (Bratislava) calendar day
};

const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Bratislava" });

/** Accepted trades in the deadline week (or the last 7 days before `now`, when the deadline is further off). */
export async function deadlineDeals(deadline: Date | null, now = new Date()): Promise<DeadlineDeal[]> {
  const end = deadline && deadline < now ? deadline : now;
  const from = new Date(end.getTime() - DEADLINE_WEEK_DAYS * 86400000);
  const trades = await prisma.trade.findMany({
    where: { status: "ACCEPTED", respondedAt: { gte: from, lte: new Date(end.getTime() + 60000) } },
    orderBy: { respondedAt: "desc" },
    select: { id: true, respondedAt: true, fromTeamId: true, toTeamId: true },
  });
  const teams = await prisma.team.findMany({ where: { id: { in: [...new Set(trades.flatMap((t) => [t.fromTeamId, t.toTeamId]))] } }, select: { id: true, code: true, logoUrl: true } });
  const tBy = new Map(teams.map((t) => [t.id, t]));
  const out: DeadlineDeal[] = [];
  for (const t of trades) {
    const g = await gradeTradeCached(t.id);
    if (!g) continue;
    out.push({ ...g, at: t.respondedAt!, fromTeamId: t.fromTeamId, toTeamId: t.toTeamId,
      fromCode: tBy.get(t.fromTeamId)?.code ?? null, toCode: tBy.get(t.toTeamId)?.code ?? null,
      fromLogo: tBy.get(t.fromTeamId)?.logoUrl ?? null, toLogo: tBy.get(t.toTeamId)?.logoUrl ?? null,
      deadlineDay: !!deadline && dayKey(t.respondedAt!) === dayKey(deadline) });
  }
  return out;
}

export type ClubVerdict = { teamId: number; code: string | null; name: string; deals: number; avg: number; grades: string[] };

/** Per-club average grade across the deals — winners first. */
export function winnersAndLosers(deals: DeadlineDeal[]): ClubVerdict[] {
  const by = new Map<number, ClubVerdict>();
  const add = (id: number, code: string | null, name: string, g: string) => {
    const v = by.get(id) ?? { teamId: id, code, name, deals: 0, avg: 0, grades: [] };
    v.deals++; v.grades.push(g); by.set(id, v);
  };
  for (const d of deals) { add(d.fromTeamId, d.fromCode, d.fromName, d.fromGrade); add(d.toTeamId, d.toCode, d.toName, d.toGrade); }
  for (const v of by.values()) v.avg = Math.round((v.grades.reduce((t, g) => t + (GRADE_SCORE[g] ?? 2), 0) / v.grades.length) * 100) / 100;
  return [...by.values()].sort((a, b) => b.avg - a.avg || b.deals - a.deals);
}

async function notifyAllGms(body: string, url: string) {
  const clubs = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false, passwordHash: { not: null } }, select: { id: true } });
  for (const c of clubs) await prisma.dmMessage.create({ data: { fromTeamId: c.id, toTeamId: c.id, body, tradeUrl: url } }).catch(() => {});
  return clubs.length;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function postDeadlineRecap(deadline: Date): Promise<boolean> {
  const author = await prisma.team.findFirst({ where: { isAdmin: true }, orderBy: { id: "asc" }, select: { id: true } });
  if (!author) return false;
  const title = `⏰ Deadline Day ${deadline.getUTCFullYear()} — winners & losers`;
  if (await prisma.newsArticle.findFirst({ where: { title }, select: { id: true } })) return false;
  const deals = await deadlineDeals(deadline, new Date(deadline.getTime() + 60000));
  const clubs = winnersAndLosers(deals);
  const parts: string[] = [];
  parts.push(`<p>The trade deadline passed at ${esc(fmt(deadline))}. ${deals.length ? `<b>${deals.length}</b> deal${deals.length === 1 ? "" : "s"} in the final week, <b>${deals.filter((d) => d.deadlineDay).length}</b> of them on deadline day.` : "A quiet week — no deals were made."} Rosters are now frozen until each club's season is over.</p>`);
  if (clubs.length) {
    const win = clubs.filter((c) => c.avg >= 3.3).slice(0, 3), lose = [...clubs].reverse().filter((c) => c.avg < 2.5).slice(0, 3);
    if (win.length) parts.push(`<h2>🏆 Winners</h2><ul>${win.map((c) => `<li><b>${esc(c.name)}</b> — ${c.grades.join(", ")} (${c.deals} deal${c.deals === 1 ? "" : "s"})</li>`).join("")}</ul>`);
    if (lose.length) parts.push(`<h2>📉 Losers</h2><ul>${lose.map((c) => `<li><b>${esc(c.name)}</b> — ${c.grades.join(", ")}</li>`).join("")}</ul>`);
    const busiest = [...clubs].sort((a, b) => b.deals - a.deals)[0];
    if (busiest && busiest.deals > 1) parts.push(`<p>🔁 Busiest club: <b>${esc(busiest.name)}</b> with ${busiest.deals} deals.</p>`);
  }
  if (deals.length) parts.push(`<h2>📋 Every deal</h2><ul>${deals.map((d) => `<li><b>${esc(d.fromName)}</b> (${d.fromGrade}) get ${esc(d.toGives.join(", ") || "—")} · <b>${esc(d.toName)}</b> (${d.toGrade}) get ${esc(d.fromGives.join(", ") || "—")}</li>`).join("")}</ul>`);
  parts.push(`<p><i>Grades by UNHL Intelligence from the shared trade-value model at the time of the deal. Full feed: <a href="/trades/deadline">Deadline Day</a>.</i></p>`);
  await prisma.newsArticle.create({ data: { authorTeamId: author.id, title, bodyHtml: parts.join("") } });
  return true;
}

/** Cron hook: 24 h notice, then the recap once the deadline has passed. */
export async function runDeadlineIfDue(now = new Date()): Promise<string | null> {
  const deadline = await getTradeDeadline();
  if (!deadline) return null;
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { deadlineReminderAt: true, deadlineRecapAt: true } });
  const same = (d: Date | null | undefined) => !!d && d.getTime() === deadline.getTime();
  const msLeft = deadline.getTime() - now.getTime();
  if (msLeft > 0 && msLeft <= 24 * 3600000 && !same(cfg?.deadlineReminderAt)) {
    await prisma.leagueConfig.update({ where: { id: 1 }, data: { deadlineReminderAt: deadline } });
    const n = await notifyAllGms(`⏰ Trade deadline: ${fmt(deadline)} (Bratislava). After it, no trades until your season is over — tonight's sim runs with the rosters as they stand at the deadline. Follow every deal live on Deadline Day.`, "/trades/deadline");
    await prisma.commissionerAnnouncement.create({ data: { body: `⏰ The trade deadline is ${fmt(deadline)} — last call for deals.`, linkUrl: "/trades/deadline", linkLabel: "Deadline Day", active: true } }).catch(() => {});
    return `deadline reminder sent (${n})`;
  }
  if (msLeft <= 0 && msLeft > -7 * 86400000 && !same(cfg?.deadlineRecapAt)) {
    await prisma.leagueConfig.update({ where: { id: 1 }, data: { deadlineRecapAt: deadline } });
    const posted = await postDeadlineRecap(deadline);
    return posted ? "deadline recap posted" : "deadline recap skipped";
  }
  return null;
}
