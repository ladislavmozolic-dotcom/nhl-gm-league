import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { isAdmin, getTeamSession } from "@/lib/auth";
import { lotteryTeams, LOTTERY_ODDS_PCT, lotteryBlocks, seasonForDraftYear } from "@/lib/draft-lottery";
import { currentDraftYear } from "@/lib/draft-class-import";
import LotteryBroadcast, { type OddsRow } from "@/components/LotteryBroadcast";
import LotteryVerify, { type VerifyBlock } from "@/components/LotteryVerify";

export const dynamic = "force-dynamic";

export default async function DraftLotteryPage() {
  // The lottery determines draft order for the draft happening at THIS season's end
  // (currentDraftYear), run off THIS season's standings — not nextDraftYear's, whose
  // season hasn't been played yet and would have no games to draw a lottery order from.
  const year = await currentDraftYear();
  const [{ nonPlayoff }, teams, admin, me] = await Promise.all([
    lotteryTeams(seasonForDraftYear(year)),
    prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, code: true, name: true, logoUrl: true } }),
    isAdmin(),
    getTeamSession(),
  ]);
  const t = new Map(teams.map((x) => [x.id, x]));
  const lottery16 = nonPlayoff.slice(0, 16);
  const odds: OddsRow[] = lottery16.map((row, i) => ({
    pos: i + 1, code: t.get(row.teamId)?.code ?? "—", logo: t.get(row.teamId)?.logoUrl ?? null, points: row.points, pct: LOTTERY_ODDS_PCT[i] ?? 0.5,
  }));
  // deterministic combo assignment for the current standings — the same rule the draw uses
  const blocks: VerifyBlock[] = lotteryBlocks(lottery16.map((r) => r.teamId)).map((b) => ({
    pos: b.pos, code: t.get(b.teamId)?.code ?? "—", name: t.get(b.teamId)?.name ?? "—", logo: t.get(b.teamId)?.logoUrl ?? null,
    pct: b.pct, count: b.count, startRank: b.startRank, endRank: b.endRank,
  }));

  return (
    <div className="space-y-6 py-2">
      <PageHeader title={`${year} Draft Lottery`} subtitle="16 non-playoff clubs · two weighted draws · a club may climb at most 10 spots · live for the whole league" />
      <LotteryBroadcast year={year} odds={odds} admin={admin} myTeamId={me} />
      <LotteryVerify blocks={blocks} />
      <LotteryExplainer />
    </div>
  );
}

/** Always-on primer so every GM knows exactly how the draw is run. */
function LotteryExplainer() {
  const steps = [
    { n: "1", t: "Who's in the draw", d: "The 16 clubs that missed the playoffs enter the lottery. The worse a club's regular-season record, the better its odds — from 18.5% for the last-place club down to 0.5% (see the odds table above)." },
    { n: "2", t: "The balls & combinations", d: "14 numbered ping-pong balls go into the drum. Four are drawn to form a combination — of the 1,001 possible four-ball combinations, each club is assigned a share matching its odds. The club holding the drawn combination wins." },
    { n: "3", t: "Two weighted draws", d: "Two separate draws are held — one for the 1st overall pick and one for the 2nd. A club can win only one; if its combination comes up twice, the second draw is re-done." },
    { n: "4", t: "The 10-spot cap", d: "A club can climb at most 10 spots in the draft order. If a lottery win would move a club up more than 10 places, that win is skipped and the next combination is drawn." },
    { n: "5", t: "Filling the rest of round 1", d: "The two lottery winners take picks #1 and #2. The remaining non-playoff clubs slot in by record (worst pick earliest). Playoff clubs pick #17–32, ordered by how far they went — first-round losers pick first, the champion picks last." },
  ];
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-2">
        <span className="text-lg">📋</span>
        <span className="text-sm font-semibold text-slate-100">How the Draft Lottery works</span>
      </div>
      <ol className="divide-y divide-slate-800/70">
        {steps.map((s) => (
          <li key={s.n} className="flex gap-4 px-5 py-4">
            <span className="flex-none w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-sm font-bold grid place-items-center">{s.n}</span>
            <div>
              <div className="text-sm font-semibold text-slate-100">{s.t}</div>
              <div className="text-sm text-slate-400 mt-0.5 leading-relaxed">{s.d}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
