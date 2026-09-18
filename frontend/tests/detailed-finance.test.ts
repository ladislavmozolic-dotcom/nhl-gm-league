import assert from "node:assert/strict";
import test from "node:test";
import {
  MEDIA_AND_LEAGUE_DISTRIBUTION,
  MEDIA_AND_LEAGUE_LABEL,
  clubRevenueLines,
  revenueSharingTransfers,
} from "../lib/club-finance";
import { sponsorBonusEarned } from "../lib/sponsorship";

test("national media and league distribution is equal for every market", () => {
  const base = { pricing: "STANDARD" as const, sthSold: 10_000, avgAttendance: 16_000, merchTotal: 7_000_000, sponsorAav: 8_000_000 };
  for (const fanInterest of [35, 60, 95]) {
    const line = clubRevenueLines({ ...base, fanInterest }).find((l) => l.label === MEDIA_AND_LEAGUE_LABEL);
    assert.equal(line?.amount, MEDIA_AND_LEAGUE_DISTRIBUTION);
  }
});

test("revenue sharing is zero-sum and moves money from rich to weak local markets", () => {
  const transfers = revenueSharingTransfers([
    { teamId: 1, localRevenue: 120_000_000 },
    { teamId: 2, localRevenue: 90_000_000 },
    { teamId: 3, localRevenue: 60_000_000 },
  ]);
  assert.equal([...transfers.values()].reduce((sum, n) => sum + n, 0), 0);
  assert.ok((transfers.get(1) ?? 0) < 0);
  assert.equal(transfers.get(2), 0);
  assert.ok((transfers.get(3) ?? 0) > 0);
});

test("sponsor bonuses follow achieved playoff milestones", () => {
  const deal = {
    label: "Steady",
    aav: 8_000_000,
    years: 2,
    bonuses: [
      { when: "Make the playoffs", amount: 1_000_000 },
      { when: "Reach the Conference Final", amount: 2_000_000 },
      { when: "Win the Championship", amount: 3_000_000 },
    ],
  };
  assert.equal(sponsorBonusEarned(deal, { madePlayoffs: true, reachedConferenceFinal: false, wonChampionship: false }), 1_000_000);
  assert.equal(sponsorBonusEarned(deal, { madePlayoffs: true, reachedConferenceFinal: true, wonChampionship: true }), 6_000_000);
});
