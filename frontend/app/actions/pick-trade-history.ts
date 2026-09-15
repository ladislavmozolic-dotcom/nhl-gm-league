"use server";

import { pickTradeHistory } from "@/lib/trade-history-server";
import { getTeamSession, isAdmin, isCommission } from "@/lib/auth";

export async function getPickTradeHistoryAction(pickId: number) {
  const [teamId, admin, commission] = await Promise.all([getTeamSession(), isAdmin(), isCommission()]);
  return pickTradeHistory(pickId, { teamId, privileged: admin || commission });
}
