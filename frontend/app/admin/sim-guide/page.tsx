import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

function Formula({ children }: { children: React.ReactNode }) {
  return <code className="block bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-[13px] text-amber-200/90 my-2 overflow-x-auto">{children}</code>;
}
function Tag({ children, c = "blue" }: { children: React.ReactNode; c?: string }) {
  const col: Record<string, string> = { blue: "bg-blue-500/15 text-blue-300 border-blue-500/30", green: "bg-green-500/15 text-green-300 border-green-500/30", amber: "bg-amber-500/15 text-amber-300 border-amber-500/30", red: "bg-red-500/15 text-red-300 border-red-500/30" };
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold border ${col[c]}`}>{children}</span>;
}

export default function SimGuidePage() {
  return (
    <div className="space-y-6 py-2 max-w-3xl">
      <PageHeader
        title="How the NHL Sim Engine Works"
        subtitle="How chemistry forms and how every rating works together to produce a game."
        right={<Link href="/admin/simulation" className="text-sm text-slate-400 hover:text-blue-400">Tune settings →</Link>}
      />

      <Card title="The one formula" accent="text-blue-400">
        <p className="text-sm text-slate-300">Every scoring chance boils down to one shooter rating run against one goalie, but that rating is never the raw card number. It is the player&apos;s attribute multiplied by his current context:</p>
        <Formula>Final skill = Base attribute × Tactics × Line chemistry × Morale × Fatigue × Score-effect</Formula>
        <p className="text-sm text-slate-400">The chance itself is then a match-up: <code className="text-slate-300">shooter vs goalie</code>, adjusted by shot danger, momentum, clutch, and special teams. Because everything is a <b>ratio</b> (never a hard <code>if A &gt; B</code>) with a floor, even a heavy underdog steals games sometimes — upsets sit at a realistic ~42%.</p>
      </Card>

      <Card title="Two engines" accent="text-blue-400">
        <ul className="text-sm text-slate-300 space-y-2">
          <li><Tag>Shot-volume</Tag> Fast statistical model — shot totals come from team ratings, each shot is converted by finishing vs goalie. Proven & calibrated. The default.</li>
          <li><Tag c="amber">Possession decision-tree</Tag> A 1-second-per-tick state machine: a puck carrier moves through zones (D→N→O) and at every step an attribute match-up decides keep-vs-strip (SK vs DF), shoot-vs-pass (SC vs PA), block (DF vs SC), the shot (SC vs goalie) and rebounds (RB). Shots &amp; goals are <b>emergent</b>. The most realistic model.</li>
        </ul>
        <p className="text-[12px] text-slate-500 mt-2">Every modifier below feeds <i>both</i> engines. Switch engine in the Simulation settings.</p>
      </Card>

      <Card title="Line Chemistry — how it forms" accent="text-green-400">
        <ul className="text-sm text-slate-300 space-y-2 list-disc pl-5">
          <li>Each forward trio &amp; defense pair has a chemistry from <b>0–100</b>. New lines start low (~35).</li>
          <li>Every game a unit plays <b>intact</b>, chemistry grows (~2/game); ~40–50 games together reaches the top.</li>
          <li>Break a unit (injury, call-up, a trade) and it drops back toward base — keep your lines stable to build it.</li>
          <li><b>Role diversity matters</b>: a line wants a playmaker + a sniper + a grinder; a pair wants an offensive + a stay-at-home D. Three of the same type never fully click.</li>
          <li><b>Off-position caps it</b>: if even one player is out of his natural spot, that unit can never fully gel (capped, e.g. ~55%).</li>
          <li>A gelled line shoots &amp; defends at full strength; a fresh or mismatched one is quietly penalised — so chemistry never inflates league scoring, it only rewards stability.</li>
        </ul>
        <p className="text-[12px] text-slate-500 mt-2">Special teams: put your <b>intact</b> 5v5 top line on <b>PP1</b> and its chemistry carries — a gelled PP1 is deadly. A gelled PK1 shields. Don&apos;t split a chemistry line across units.</p>
      </Card>

      <Card title="Positioning (LD/RD & wings)" accent="text-green-400">
        <p className="text-sm text-slate-300 mb-2">A defenseman&apos;s natural side comes from <b>Shoots</b> (left-shot = left side). A forward&apos;s spots come from his position (a &quot;C/RW&quot; is a universal — no penalty). Out of position he is still playable, but weaker:</p>
        <ul className="text-sm text-slate-300 space-y-1.5">
          <li><Tag c="amber">~7%</Tag> wrong wing, or a D on his off-hand side</li>
          <li><Tag c="amber">~17%</Tag> a winger at center or a center on the wing — <b>plus</b> the winger&apos;s faceoff collapses to ~30%</li>
          <li><Tag c="red">~35%</Tag> a forward on defense (or a D up front) — a real disaster</li>
        </ul>
        <p className="text-[12px] text-slate-500 mt-2">On the power play / penalty kill the position penalty is <b>waived</b> (you can run 4 forwards on the PP).</p>
      </Card>

      <Card title="Conditioning (CON) — fatigue" accent="text-amber-400">
        <ul className="text-sm text-slate-300 space-y-1.5 list-disc pl-5">
          <li><b>Post-game</b>: a heavy night (F ≥ 22 min, D ≥ 25 min) shaves a CON point; a playoff OT marathon costs one per extra period (1st OT → 98, 2nd → 97…). It recovers on rest days.</li>
          <li><b>In-game</b> (possession engine): a long shift drains a player&apos;s effective attributes; high Endurance (EN) slows the drain — so a fresh 4th line can outskate a gassed, over-used top line.</li>
          <li><b>Goalies</b>: CON falls with shot-load and a back-to-back; a tired goalie is measurably weaker.</li>
        </ul>
      </Card>

      <Card title="Momentum, Clutch & Morale" accent="text-amber-400">
        <ul className="text-sm text-slate-300 space-y-2 list-disc pl-5">
          <li><b>Momentum</b> — a goal gives the scoring team a short hot streak (better finishing for a few minutes); the team that conceded sags. <b>Leadership (LD)</b> stretches the streak, <b>Experience (EX)</b> steadies a team after a goal against. This is why goals come in bunches.</li>
          <li><b>Clutch</b> — in the last minutes of a tight 3rd, in OT, and (amplified) in the playoffs, high EX/LD/composure players rise and score the winners.</li>
          <li><b>Morale</b> — a persistent mood: wins &amp; production lift it, losses sink it. Below neutral a player is penalised; riding high he plays over his head. It mean-reverts so the league stays balanced.</li>
        </ul>
      </Card>

      <Card title="Shot quality & flow" accent="text-blue-400">
        <ul className="text-sm text-slate-300 space-y-1.5 list-disc pl-5">
          <li><b>Danger</b>: a point shot from a D is low (×0.35), a forward&apos;s own-rush shot medium (×1.0), a one-timer off a pass or a rebound high (×1.85+). High chemistry → more clean passes → more high-danger looks automatically.</li>
          <li><b>Pressure</b>: sustained shots in one shift (screens, rebounds, a tiring goalie) each get a small boost.</li>
          <li><b>Physicality</b>: heavier players throw more hits and win more net-front battles.</li>
          <li><b>Home ice</b> &amp; a <b>score-effect</b> catch-up (the team in front eases off, the trailing team presses) keep results realistic — few blowouts, plenty of 3:2 / 4:2 games.</li>
          <li><b>Frustration</b>: a team down two-plus goals reaches and hooks more — its penalty rate climbs.</li>
        </ul>
      </Card>

      <Card title="Calibration targets (what &quot;correct&quot; looks like)" accent="text-slate-200">
        <div className="overflow-x-auto">
          <table className="text-sm w-full">
            <tbody className="[&_td]:py-1 [&_td:first-child]:text-slate-400 [&_td:last-child]:text-right [&_td:last-child]:font-semibold [&_td:last-child]:tabular-nums">
              <tr><td>Shots on goal / team</td><td>25–35</td></tr>
              <tr><td>Save % (SV%)</td><td>89.0–92.5%</td></tr>
              <tr><td>Power-play %</td><td>15–25%</td></tr>
              <tr><td>Home win %</td><td>~54%</td></tr>
              <tr><td>Games to OT/SO</td><td>~23%</td></tr>
              <tr><td>Upset rate (worse team wins)</td><td>~42%</td></tr>
              <tr><td>Typical scores</td><td>3:2 · 4:2 · 2:1</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-slate-500 mt-2">Both engines are tuned to these. Change a Game Option and re-check — if you see lots of 0:0 or 8:7 games, the danger/shot dials are off.</p>
      </Card>
    </div>
  );
}
