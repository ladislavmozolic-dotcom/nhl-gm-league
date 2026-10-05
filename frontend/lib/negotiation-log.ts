import { prisma } from "@/lib/prisma";
import { getLeagueClock } from "@/lib/calendar-server";

export type NegotiationEntry = {
  playerId: number;
  playerName: string;
  teamId?: number | null;
  teamCode?: string | null;
  kind: "OFFER" | "ADMIN";
  outcome: "ACCEPTED" | "COUNTERED" | "WALKED_UFA" | "OS_ELIGIBLE" | "FORCE_SIGNED" | "FORCE_WALK" | "RESET" | "EDITED";
  round?: number | null;
  offerSalary?: number | null;
  offerYears?: number | null;
  offerLine?: number | null;
  offerPP?: boolean | null;
  offerPK?: boolean | null;
  offerClause?: string | null;
  offerTwoWay?: boolean | null;
  counterSalary?: number | null;
  counterYears?: number | null;
  askSalary?: number | null;
  askFloor?: number | null;
  askMinYears?: number | null;
  askMaxYears?: number | null;
  insulted?: boolean;
  lowballBump?: number | null;
  note?: string | null;
  actor?: string | null;
};

/** Append one row to the permanent negotiation audit trail. Never throws — an audit
 *  write must not break the actual negotiation. */
export async function logNegotiation(e: NegotiationEntry): Promise<void> {
  try {
    const phase = (await getLeagueClock()).phase;
    await prisma.negotiationLog.create({ data: { ...e, phase, insulted: e.insulted ?? false } });
  } catch (err) {
    console.error("negotiation log failed", err);
  }
}
