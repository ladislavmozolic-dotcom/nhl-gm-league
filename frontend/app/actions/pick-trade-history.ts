"use server";

import { pickTradeHistory } from "@/lib/trade-history-server";

export async function getPickTradeHistoryAction(pickId: number) {
  return pickTradeHistory(pickId);
}
