"use server";

import { prisma } from "@/lib/prisma";
import { getTradeDeadline, DEADLINE_TZ } from "@/lib/trade-deadline";

export type DeadlineFeed = {
  deadline: string | null;
  isDeadlineDay: boolean;
  trades: { id: number; message: string; at: string }[];
};

const dayStr = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: DEADLINE_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** Public, read-only: the deadline and every trade completed on deadline day
 *  (polled by the site-wide ticker and the home-page live feed). */
export async function deadlineFeedAction(): Promise<DeadlineFeed> {
  const deadline = await getTradeDeadline();
  if (!deadline) return { deadline: null, isDeadlineDay: false, trades: [] };
  const isDeadlineDay = dayStr(new Date()) === dayStr(deadline);
  if (!isDeadlineDay) return { deadline: deadline.toISOString(), isDeadlineDay, trades: [] };
  const since = new Date(Date.now() - 24 * 3600000);
  const rows = await prisma.transaction.findMany({
    where: { type: "TRADE", message: { contains: "traded" }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" }, take: 40, select: { id: true, message: true, createdAt: true },
  });
  // keep only today's (Bratislava) rows
  const today = dayStr(new Date());
  return { deadline: deadline.toISOString(), isDeadlineDay, trades: rows.filter((r) => dayStr(r.createdAt) === today).map((r) => ({ id: r.id, message: r.message, at: r.createdAt.toISOString() })) };
}
