import Link from "next/link";
import { Card } from "@/components/ui";
import InfoTip from "@/components/InfoTip";
import { interestArrow, interestAccent, type ExpectationTier } from "@/lib/fan-interest";
import type { TeamFan } from "@/lib/fan-interest-server";

const tierAccent: Record<ExpectationTier, string> = {
  "Championship Contender": "text-fuchsia-300",
  "Playoff Team": "text-sky-300",
  "Bubble Team": "text-amber-300",
  "Rebuilding Team": "text-slate-400",
};

/** A club's Fan Interest gauge — value, swing vs preseason baseline, expectation
 *  tier, marquee star and the reasons behind the movement. */
export default function FanInterestCard({ fan, teamSlug }: { fan: TeamFan; teamSlug?: string }) {
  return (
    <Card title="Fan Interest" accent="text-fuchsia-300">
      <div className="flex items-end gap-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black tabular-nums">{fan.interest}</span>
            <span className={`text-lg font-bold ${interestAccent(fan.delta)}`}>{interestArrow(fan.delta)}{fan.delta !== 0 ? Math.abs(fan.delta) : ""}</span>
            <InfoTip text="A 0–100 gauge of how hot fan interest in the club is right now. It swings with results relative to the preseason expectation, recent form, streaks and marquee star power. The arrow shows the move vs the neutral baseline (performing exactly to expectation). It drives season tickets, attendance, merch and sponsor value." />
          </div>
          <div className="mt-1 h-2 w-40 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-fuchsia-500/70" style={{ width: `${fan.interest}%` }} />
          </div>
        </div>
        <div className="text-sm">
          <div className="text-slate-400">Preseason expectation</div>
          <div className={`font-semibold ${tierAccent[fan.tier]}`}>{fan.tier}</div>
          {fan.star && <div className="mt-1 text-[12px] text-slate-500">Marquee: <span className="text-slate-300">{fan.star.name}</span> · {fan.star.score}</div>}
        </div>
      </div>

      {fan.reasons.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Main reasons</div>
          <ul className="text-sm text-slate-300 space-y-0.5">
            {fan.reasons.map((r, i) => <li key={i}>· {r}</li>)}
          </ul>
        </div>
      )}
      {teamSlug && <Link href={`/finance/fan-interest`} className="mt-3 inline-block text-xs text-blue-400 hover:underline">League fan-interest board →</Link>}
    </Card>
  );
}
