import { bratislavaLocalToUtc } from "./trade-deadline";

// Round 1 of a draft opens automatically one week before the real NHL Entry Draft
// (Europe/Bratislava wall-clock). Years without an entry have no time gate.
const ROUND1_OPENS_LOCAL: Record<number, string> = {
  2027: "2027-06-18T20:00",
};

/** When round 1 of this draft year opens (UTC), or null if the year has no scheduled start. */
export function draftRound1OpensAt(year: number): Date | null {
  const local = ROUND1_OPENS_LOCAL[year];
  return local ? bratislavaLocalToUtc(local) : null;
}

/** Open round 1 by itself once the scheduled start passes (lottery drawn, nothing live yet).
 *  Called from the Draft Room render so any viewer's visit triggers it; the guarded
 *  updateMany makes concurrent visitors race-safe. Returns true if it opened the round. */
export async function autoOpenRound1IfDue(year: number): Promise<boolean> {
  const opensAt = draftRound1OpensAt(year);
  if (!opensAt || Date.now() < opensAt.getTime()) return false;
  const { prisma } = await import("./prisma");
  const [lot, s] = await Promise.all([
    prisma.draftLottery.count({ where: { year } }),
    prisma.draftState.findUnique({ where: { year } }),
  ]);
  if (lot === 0 || (s && (s.status !== "IDLE" || s.liveRound !== 0))) return false;
  if (!s) await prisma.draftState.upsert({ where: { year }, create: { year }, update: {} });
  const first = await prisma.draftLottery.findFirst({ where: { year }, orderBy: { pick: "asc" }, select: { pick: true } });
  const res = await prisma.draftState.updateMany({
    where: { year, status: "IDLE", liveRound: 0 },
    data: { liveRound: 1, status: "LIVE", currentPick: first?.pick ?? 1, onClockAt: new Date() },
  });
  return res.count > 0;
}
