import { loadLeagueSlots, rankSlot, slotById, type SlotDef, type SlotTeamRow } from "./leagueSlots";

// "Find Trade Partner" — the third GM Assistant function. Given a slot (e.g.
// the "2.–3. pár RD" a GM's own Analyze My Roster flagged as weak), it ranks
// every other NHL club at that exact same slot — the same computation
// Analyze My Roster already ranks your own club against — so a "candidate"
// is simply a club that currently ranks better than you there. No trade
// value model, no willingness-to-deal guess: just the same transparent
// slot ranking, read from the other side.

export interface TradePartnerCandidate extends SlotTeamRow {
  rank: number;
}

export interface TradePartnerResult {
  slot: SlotDef;
  leagueSize: number;
  myTeamId: number;
  myRank: number | null; // null = my club has nobody eligible for this slot at all
  myAvg: number | null;
  myAuto: boolean;
  // clubs ranked ABOVE my club at this slot, best first — potential sellers of
  // a surplus there. Clubs at/below my own rank are omitted: they have no
  // depth advantage at this exact slot to trade from.
  candidates: TradePartnerCandidate[];
}

export async function findTradePartners(myTeamId: number, slotId: string): Promise<TradePartnerResult | null> {
  const slot = slotById(slotId);
  if (!slot) return null;

  const data = await loadLeagueSlots();
  const rows = rankSlot(data, slot);
  const myIdx = rows.findIndex((r) => r.teamId === myTeamId);

  const candidates: TradePartnerCandidate[] = rows
    .map((r, i) => ({ ...r, rank: i + 1 }))
    .filter((r) => r.teamId !== myTeamId && (myIdx === -1 || r.rank < myIdx + 1));

  return {
    slot,
    leagueSize: rows.length,
    myTeamId,
    myRank: myIdx === -1 ? null : myIdx + 1,
    myAvg: myIdx === -1 ? null : rows[myIdx].avg,
    myAuto: myIdx === -1 ? false : rows[myIdx].isAuto,
    candidates,
  };
}
