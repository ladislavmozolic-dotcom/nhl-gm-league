"use client";

import { useState, useTransition } from "react";
import type { EngineSettings } from "@/lib/sim/settings";
import { DEFAULT_SETTINGS } from "@/lib/sim/settings";
import { compensationLabel } from "@/lib/offer-sheet";

type Props = {
  initial: EngineSettings;
  onSave: (values: EngineSettings) => Promise<void>;
};

const GAME_OPTIONS: Array<{ key: keyof EngineSettings; label: string; hint: string }> = [
  { key: "goalsPct", label: "Goals", hint: "scoring / shot conversion" },
  { key: "shotsPct", label: "Shots", hint: "shot volume" },
  { key: "powerPlayPct", label: "Power Play", hint: "PP conversion" },
  { key: "penaltiesPct", label: "Penalties", hint: "penalty frequency" },
  { key: "hitsPct", label: "Hits", hint: "hits per game" },
  { key: "fightsPct", label: "Fights", hint: "fight frequency" },
  { key: "injuryChancePct", label: "Injuries", hint: "injury frequency — 100% ≈ NHL-realistic (~44/team/season); lower = fewer, higher = more" },
  { key: "parityPct", label: "Parity", hint: "how much a talent gap is compressed — 0% = raw talent (blowouts, huge streaks), 100% = NHL-like (best beats worst ~75%), higher = more upsets" },
  { key: "gameVariancePct", label: "Game Variance", hint: "“any given night” swing — hot/cold goalies & offences per game. 0% = deterministic, 100%+ = livelier single-game results" },
  { key: "homeAdvPct", label: "Home Advantage", hint: "home-ice edge (shots + conversion)" },
  { key: "homeLastChangePct", label: "Home Last Change", hint: "how much home matchups smother opponent chance danger" },
  { key: "defenseTalentPct", label: "Defence Impact", hint: "how strongly the D in front lowers goals-against (0 = goalie only)" },
];

export default function SimSettingsForm({ initial, onSave }: Props) {
  const [s, setS] = useState<EngineSettings>(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof EngineSettings>(k: K, v: EngineSettings[K]) => {
    setS((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
  };
  const num = (k: keyof EngineSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(k, Number(e.target.value) as EngineSettings[typeof k]);

  const save = () => start(async () => { await onSave(s); setSaved(true); });
  const reset = () => { setS(DEFAULT_SETTINGS); setSaved(false); };

  // offer-sheet compensation tier editors
  const setTierAav = (i: number, m: number) =>
    set("osCompTiers", s.osCompTiers.map((t, j) => (j === i ? { ...t, maxAav: Math.max(0, Math.round(m * 1e6)) } : t)));
  const setTierRound = (i: number, round: number, count: number) =>
    set("osCompTiers", s.osCompTiers.map((t, j) => {
      if (j !== i) return t;
      const others = t.picks.filter((x) => x !== round);
      const add = Array.from({ length: Math.max(0, Math.min(4, count)) }, () => round);
      return { ...t, picks: [...others, ...add].sort((a, b) => a - b) };
    }));

  const Slider = ({ k, label, hint }: { k: keyof EngineSettings; label: string; hint: string }) => (
    <div className="grid grid-cols-[150px_1fr_60px] items-center gap-3 py-1.5">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[11px] text-slate-500">{hint}</div>
      </div>
      <input type="range" min={0} max={200} step={5} value={s[k] as number}
        onChange={num(k)} className="accent-blue-500" />
      <div className="text-right tabular-nums text-sm font-bold">{s[k] as number}%</div>
    </div>
  );

  const NumField = ({ k, label, step = 1, w = "w-24" }: { k: keyof EngineSettings; label: string; step?: number; w?: string }) => (
    <label className="flex items-center justify-between gap-3 text-sm py-1">
      <span className="text-slate-300">{label}</span>
      <input type="number" step={step} value={s[k] as number} onChange={num(k)}
        className={`${w} bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right tabular-nums`} />
    </label>
  );

  const Toggle = ({ k, label }: { k: keyof EngineSettings; label: string }) => (
    <label className="flex items-center gap-2 text-sm py-1 cursor-pointer">
      <input type="checkbox" checked={s[k] as boolean} onChange={(e) => set(k, e.target.checked as EngineSettings[typeof k])}
        className="accent-blue-500 w-4 h-4" />
      <span>{label}</span>
    </label>
  );

  const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400 mb-3">{title}</h2>
      {children}
    </section>
  );

  return (
    <div className="space-y-5 pb-24">
      <Card title="Simulation Model">
        <label className="flex items-center justify-between gap-3 text-sm py-1">
          <span className="text-slate-300">Engine</span>
          <select value={s.engineModel}
            onChange={(e) => set("engineModel", e.target.value as EngineSettings["engineModel"])}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm">
            <option value="volume">Shot-volume (calibrated, proven)</option>
            <option value="possession">Possession decision-tree (default)</option>
          </select>
        </label>
        <p className="text-[11px] text-slate-500 mt-1">
          {s.engineModel === "possession"
            ? "Each possession is a chain of attribute micro-battles — zone entry (SK vs DF), shoot/pass (SC vs PA), block (DF vs SC), the shot (SC vs goalie) and rebounds (RB). Shots & goals are emergent."
            : "Fast statistical model: shot volume from team ratings, each shot converted by finishing vs goalie. All the chemistry/momentum/clutch/morale modifiers apply to both models."}
        </p>
      </Card>

      <Card title="Competitiveness">
        <p className="text-[11px] text-slate-500 mb-3">
          How strongly team quality decides games. Higher = the better club dominates and reliably climbs the
          standings (chalk); lower = coin-flip games with more upsets and noisier standings.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <NumField k="possessionSkillPct" label="Team skill weight" step={0.1} />
          <NumField k="catchUpStrength" label="Score-effect catch-up" step={0.005} w="w-28" />
        </div>
      </Card>

      <Card title="Rivalry & Discipline">
        <div className="flex items-center justify-between mb-2"><Toggle k="rivalryEnabled" label="Rivalry games enabled" /></div>
        <p className="text-[11px] text-slate-500 mb-3">
          Heated games between declared rivals — more fights, net-front scrums, misconducts and rare 100+ PIM
          brawls. A team over the PIM threshold in a game is fined (deducted from its bank).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div>
            <NumField k="rivalryFightMult" label="Rivalry fight ×" step={0.1} />
            <NumField k="rivalryPenaltyMult" label="Rivalry penalty ×" step={0.1} />
            <NumField k="scrumChance" label="Scrum chance" step={0.05} w="w-28" />
            <NumField k="brawlChance" label="Brawl (100+ PIM) chance" step={0.01} w="w-28" />
          </div>
          <div>
            <NumField k="abuseOfficialChance" label="Abuse-of-official chance" step={0.01} w="w-28" />
            <NumField k="coachFinePimThreshold" label="Coach fine PIM threshold" />
            <NumField k="coachFineAmount" label="Coach fine ($)" step={25000} w="w-32" />
          </div>
        </div>
      </Card>

      <Card title="Game Options">
        {GAME_OPTIONS.map((o) => <Slider key={o.key} k={o.key} label={o.label} hint={o.hint} />)}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card title="Toggles">
          <Toggle k="penaltiesEnabled" label="Penalties enabled" />
          <Toggle k="fightsEnabled" label="Fights enabled" />
          <Toggle k="injuriesEnabled" label="Injuries enabled" />
          <Toggle k="playByPlayEnabled" label="Play-by-play output" />
          <div className="mt-3 pt-3 border-t border-slate-800">
            <NumField k="starExponent" label="Star separation (exponent)" step={0.1} />
            <p className="text-[11px] text-slate-500 mt-1">Higher = elite players take a bigger share of scoring.</p>
          </div>
        </Card>

        <Card title="Point System">
          <NumField k="winPts" label="Win" />
          <NumField k="otWinPts" label="OT / SO win" />
          <NumField k="otLossPts" label="OT / SO loss" />
          <NumField k="lossPts" label="Regulation loss" />
        </Card>
      </div>

      <Card title="Playoffs">
        <label className="flex items-center justify-between gap-3 text-sm py-1">
          <span className="text-slate-300">Bracket format</span>
          <select value={s.playoffFormat}
            onChange={(e) => set("playoffFormat", e.target.value as EngineSettings["playoffFormat"])}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm">
            <option value="division">Division + wild cards (real NHL)</option>
            <option value="conference">Top 8 by points (conference)</option>
          </select>
        </label>
        <p className="text-[11px] text-slate-500 mb-2">
          {s.playoffFormat === "division"
            ? "Top 3 per division qualify + 2 wild cards; division winners host."
            : "Top 8 teams per conference by points, seeded 1v8 / 4v5 / 3v6 / 2v7."}
        </p>
        <div className="grid grid-cols-2 gap-x-6">
          <NumField k="playoffTeamsPerConf" label="Teams / conference" />
          <NumField k="playoffBestOf" label="Series length (best of)" />
        </div>
      </Card>

      <Card title="Finance & Salary Cap">
        <label className="flex items-center justify-between gap-3 text-sm py-1 mb-2 border-b border-slate-800 pb-3">
          <span className="text-slate-300">Finance system</span>
          <select value={s.financeMode} onChange={(e) => set("financeMode", e.target.value as EngineSettings["financeMode"])}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm">
            <option value="base">Base — ticket-revenue finance</option>
            <option value="detailed">Detailed — fan interest, merch, sponsors (coming soon)</option>
          </select>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div>
            <NumField k="startingCapital" label="Starting capital / club" step={1000000} w="w-32" />
            <NumField k="salaryCapUpper" label="Salary cap (upper)" step={100000} w="w-32" />
            <NumField k="salaryCapLower" label="Salary floor (lower)" step={100000} w="w-32" />
            <NumField k="rosterOverFinePerDay" label="Over-roster fine / day" step={50000} w="w-32" />
            <NumField k="buyoutPctSeason" label="Buyout % (in-season)" />
            <NumField k="buyoutPctOffseason" label="Buyout % (off-season)" />
          </div>
          <div>
            <NumField k="retentionMaxPct" label="Retention max %" />
            <NumField k="retentionMinSalary" label="Retention min salary" step={50000} w="w-32" />
            <NumField k="retentionMaxPlayers" label="Max retained players" />
            <div className="mt-1"><Toggle k="clausesEnabled" label="Enforce NTC / NMC / M-NTC clauses" /></div>
            <NumField k="rewardPlayoff" label="Reward: playoff berth" step={500000} w="w-32" />
            <NumField k="rewardCup" label="Reward: Cup winner" step={500000} w="w-32" />
            <NumField k="rewardAhlCup" label="Reward: Calder winner" step={500000} w="w-32" />
          </div>
        </div>
      </Card>

      <Card title="Offer-sheet compensation">
        <div className="mb-2"><Toggle k="osCompEnabled" label="Enforce offer-sheet draft-pick compensation" /></div>
        <p className="text-[11px] text-slate-500 mb-3">Picks the poaching club owes the old club, by the offer sheet&apos;s yearly salary. AAV cap in $M (0 = the top open-ended tier). A club may only surrender its own original picks — the engine verifies ownership.</p>
        <div className="space-y-2">
          {s.osCompTiers.map((t, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[130px_1fr_130px] items-center gap-2 border-b border-slate-800/60 pb-2">
              <label className="flex items-center gap-2 text-xs text-slate-400">≤ AAV ($M)
                <input type="number" step={0.5} min={0} value={(t.maxAav / 1e6).toString()} onChange={(e) => setTierAav(i, Number(e.target.value))}
                  className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right tabular-nums" />
              </label>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                {[1, 2, 3].map((r) => (
                  <label key={r} className="flex items-center gap-1">{r === 1 ? "1st" : r === 2 ? "2nd" : "3rd"}
                    <input type="number" min={0} max={4} value={t.picks.filter((x) => x === r).length} onChange={(e) => setTierRound(i, r, Number(e.target.value))}
                      className="w-12 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right tabular-nums" />
                  </label>
                ))}
              </div>
              <span className="text-xs text-emerald-300 sm:text-right">{compensationLabel(t.picks)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Free agency & RFA">
        <label className="flex items-center justify-between gap-3 text-sm py-1">
          <span className="text-slate-300">Free-agency system</span>
          <select value={s.faMode} onChange={(e) => set("faMode", e.target.value as EngineSettings["faMode"])}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm">
            <option value="full">Full — RFA, franchise tags & offer sheets</option>
            <option value="simple">Simple — everyone a UFA to the open market</option>
          </select>
        </label>
        <p className="text-[11px] text-slate-500 mb-3">Simple mode drops RFA rights, franchise tags and offer sheets: every expiring player just tests the open market, and you re-sign your own before he gets there.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div>
            <div className="text-xs text-slate-500 mb-1">Two-way contracts</div>
            <NumField k="faTwoWayOlderAge" label="Barrier applies over age" />
            <NumField k="faTwoWayNhlGpLimit" label="NHL games = established" />
            <NumField k="faTwoWayAhlMaxYears" label="Max term — no NHL games (yrs)" />
            <NumField k="faTwoWayFewGpMaxYears" label="Max term — a few NHL games (yrs)" />
            <NumField k="faTwoWayMaxYears" label="Max term — relaxed established (yrs)" />
            <NumField k="faTwoWayRelaxRound" label="Older veteran relaxes from round" />
            <NumField k="faTwoWayWeakOverall" label="Weak/4th-line overall at or below" />
            <NumField k="faTwoWayWeakRound" label="Weak established relaxes from round" />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">RFA / offer sheets</div>
            <NumField k="rfaMaxAge" label="RFA max age (≤)" />
            <NumField k="osOpenDay" label="Offer-sheet opens (day)" />
            <NumField k="osCloseDay" label="Offer-sheet closes (day)" />
            <NumField k="osDecisionDay" label="Offer-sheet decided by (day)" />
            <div className="mt-1"><Toggle k="waiversEnabled" label="Enforce the waiver wire" /></div>
            <div className="mt-1"><Toggle k="aiTradesEnabled" label="Advanced AI GM negotiates trades" /></div>
            <div className="mt-1"><Toggle k="aiInitiateTrades" label="Advanced AI GM initiates trade offers" /></div>
          </div>
        </div>
      </Card>

      <Card title="Goalie Fatigue (CON)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div>
            <div className="text-xs text-slate-500 mb-1">Normal goalie (DU &lt; threshold) — shots before CON −1 / −2</div>
            <NumField k="conShotsLow1" label="≤ shots → −1" />
            <NumField k="conShotsLow2" label="≤ shots → −2 (else −3)" />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Workhorse goalie (DU ≥ threshold)</div>
            <NumField k="conShotsHigh1" label="≤ shots → −1" />
            <NumField k="conShotsHigh2" label="≤ shots → −2 (else −3)" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 mt-3 pt-3 border-t border-slate-800">
          <div>
            <NumField k="duHighThreshold" label="Workhorse DU threshold" />
            <NumField k="conRecovery" label="CON recovery / day" />
            <NumField k="conRecoveryHighDu" label="CON recovery / day (high DU)" />
          </div>
          <div>
            <NumField k="conSlope" label="Save loss per CON point" step={0.001} w="w-28" />
            <NumField k="b2bFatigue" label="Back-to-back save multiplier" step={0.005} w="w-28" />
          </div>
        </div>
      </Card>

      <Card title="Skater Fatigue (CON)">
        <p className="text-[11px] text-slate-500 mb-3">
          Post-game conditioning. A heavy game shaves a point (F ≥ forward minutes, D ≥ defense minutes);
          a playoff OT marathon costs one per extra period (1st OT → 98, 2nd → 97…). Recovers between games.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div>
            <NumField k="skaterFwdConMinutes" label="Forward overwork (min)" />
            <NumField k="skaterDefConMinutes" label="Defense overwork (min)" />
            <NumField k="skaterConDrop" label="CON drop when overworked" />
          </div>
          <div>
            <NumField k="skaterOtDrop" label="CON drop per OT period" />
            <NumField k="skaterConRecovery" label="CON recovery / rest day" />
            <NumField k="skaterConSlope" label="Rating loss per CON point" step={0.001} w="w-28" />
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          Rating loss is <b>0</b> by default (CON is tracked &amp; shown only). Raise it to make chronic
          overuse actually weaken a skater — e.g. 0.006 makes a player at CON 95 ~3% less effective.
        </p>
      </Card>

      <Card title="Momentum">
        <div className="flex items-center justify-between mb-2">
          <Toggle k="momentumEnabled" label="Momentum enabled" />
        </div>
        <p className="text-[11px] text-slate-500 mb-3">
          Goals come in bunches: a team that scores rides a short hot streak (higher conversion) while the
          team that conceded sags, decaying back to normal over a few minutes. Leadership (LD) stretches the
          streak; Experience (EX) steadies a team after a goal against. Adds realistic swings & comebacks
          without changing total scoring.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div>
            <NumField k="momentumBoostPct" label="Conversion boost @1.0" step={0.01} w="w-28" />
            <NumField k="momentumGoalSpike" label="Surge on scoring" step={0.1} />
            <NumField k="momentumConcedeDip" label="Sag on conceding" step={0.1} />
          </div>
          <div>
            <NumField k="momentumDecaySec" label="Decay time (sec)" step={10} />
            <NumField k="momentumMax" label="Max |momentum|" step={0.1} />
          </div>
        </div>
      </Card>

      <Card title="Line Chemistry">
        <div className="flex items-center justify-between mb-2">
          <Toggle k="chemistryEnabled" label="Chemistry enabled" />
        </div>
        <p className="text-[11px] text-slate-500 mb-3">
          Units (manager lines, else depth-chart trios/pairs) gel while intact and drop when broken by
          injury/call-up. Penalty-only: a fully gelled unit (≥ neutral) sims at full strength; a fresh or
          disrupted one scores slightly less — so it never inflates league-wide offense.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div>
            <NumField k="chemistryBase" label="Starting chemistry (new line)" />
            <NumField k="chemistryGrowth" label="Growth / game intact" />
            <NumField k="chemistryDrop" label="Drop when broken" />
          </div>
          <div>
            <NumField k="chemistryNeutral" label="Fully-gelled threshold" />
            <NumField k="chemistryPenaltyPct" label="Max penalty (0 chem)" step={0.01} w="w-28" />
            <NumField k="chemistryRolePenaltyPct" label="Role-redundancy penalty" step={0.01} w="w-28" />
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          Role-redundancy penalises a line of three similar players (or two offensive D) — the sim rewards a
          playmaker + sniper + grinder up front and an offensive + stay-at-home pairing on the blue line.
        </p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card title="Clutch">
          <Toggle k="clutchEnabled" label="Clutch enabled" />
          <p className="text-[11px] text-slate-500 my-2">
            High EX/LD/composure players rise in the last {Math.round(s.clutchWindowSec / 60)} min of a tight
            3rd, in OT, and (amplified) in the playoffs — they score the winners.
          </p>
          <NumField k="clutchBoostPct" label="Clutch swing" step={0.01} w="w-28" />
          <NumField k="clutchWindowSec" label="Clutch window (sec)" step={30} />
          <NumField k="clutchPlayoffMult" label="Playoff multiplier" step={0.1} />
        </Card>

        <Card title="Morale">
          <Toggle k="moraleEnabled" label="Morale enabled" />
          <p className="text-[11px] text-slate-500 my-2">
            Persistent mood: wins &amp; production lift it, losses sink it, mean-reverting to base. Below neutral
            a player is penalised; above it he plays over his head.
          </p>
          <NumField k="moraleBase" label="Base / reset" />
          <NumField k="moraleWin" label="Win/loss swing (±)" />
          <NumField k="moraleNeutral" label="Neutral (no effect)" />
          <NumField k="moraleSlope" label="Rating per morale point" step={0.001} w="w-28" />
        </Card>
      </div>

      <Card title="Physicality (weight)">
        <Toggle k="physicalityEnabled" label="Physicality enabled" />
        <p className="text-[11px] text-slate-500 my-2">
          Heavier players throw more of the hits and win more net-front / board battles (a small conversion
          edge). Centered on the league-mean weight so it stays ~zero-sum.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <NumField k="physicalityMeanLbs" label="League-mean weight (lbs)" />
          <NumField k="physicalityPct" label="Edge per lb from mean" step={0.0001} w="w-28" />
        </div>
      </Card>

      <Card title="Off-Position Penalties">
        <p className="text-[11px] text-slate-500 mb-3">
          Graduated skill cut for a skater out of his natural spot (waived on PP/PK). An off-position unit&apos;s
          chemistry is also capped. A defenseman&apos;s natural side comes from Shoots; a multi-position forward is a universal.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div>
            <NumField k="offPosWingPct" label="Wrong wing / off-hand D" step={0.01} w="w-28" />
            <NumField k="offPosCenterPct" label="Wing ↔ center" step={0.01} w="w-28" />
          </div>
          <div>
            <NumField k="offPosDefPct" label="Forward ↔ defense" step={0.01} w="w-28" />
            <NumField k="offPosChemCap" label="Off-position chemistry cap" />
          </div>
        </div>
      </Card>

      {/* sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/90 border-t border-slate-800 backdrop-blur px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button onClick={save} disabled={pending}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm disabled:opacity-50">
            {pending ? "Saving…" : "Save settings"}
          </button>
          <button onClick={reset} className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm">
            Reset to defaults
          </button>
          {saved && <span className="text-green-400 text-sm">✓ Saved — applies to the next simulation</span>}
        </div>
      </div>
    </div>
  );
}
