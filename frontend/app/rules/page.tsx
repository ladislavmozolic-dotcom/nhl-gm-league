import { PageHeader, Card } from "@/components/ui";

export const metadata = { title: "League Rules" };

type Sec = { id: string; title: string; intro?: string; groups: { h?: string; points: (string | string[])[] }[] };

const SECTIONS: Sec[] = [
  {
    id: "season", title: "1 · Season & Simulation",
    intro: "The league runs the real NHL schedule and is simulated day by day by the commissioner.",
    groups: [
      { points: [
        "The regular season uses the real NHL schedule (~84 games per team). Games are played one day at a time from the Schedule page (Sim Next Day). The current day is highlighted; the Sim button stays pinned at the top.",
        "Each game is decided by an event-driven engine: shots, shot quality (expected goals by rink zone), goalie quality, special teams, chemistry, coaching, fatigue and an \"any-given-night\" form swing all feed the result — that's where upsets come from.",
        "Results are reproducible: the same fixture sims the same way. Re-simulating a game or rebuilding the schedule re-rolls it. Every sim is written to the Audit Log (who/when/seed); a re-sim is flagged.",
        "Game Variance is commissioner-tunable (default ~108%). Higher = more wild nights; lower = tighter, chalk results.",
      ] },
    ],
  },
  {
    id: "rosters", title: "2 · Rosters & the Farm",
    groups: [
      { h: "Active roster", points: [
        "A legal game lineup dresses 12 forwards, 6 defensemen and 2 goalies. Up to 23 players may be on the NHL roster.",
        "If a club owns fewer than 12F / 6D / 2G, the sim promotes the best available farm players onto the NHL roster before the next game — durably (they count against the cap and stay until you send them down).",
      ] },
      { h: "AHL farm", points: [
        "Every NHL club has an AHL affiliate. The AHL schedule mirrors the NHL schedule (affiliates meet when their parent clubs meet).",
        "AHL rosters are managed by the parent club's GM login. Players below ~$775k cap hit are farm-eligible.",
        "When NHL call-ups leave a farm short of a legal lineup, the farm automatically activates its own healthy scratches so its games still simulate.",
      ] },
    ],
  },
  {
    id: "con", title: "3 · Condition (CON), Fatigue & Injuries",
    groups: [
      { h: "Condition", points: [
        "Every player has a CON value (0–100). It drops as he plays and recovers on rest days (skaters and goalies ~+1–2 per off day). CON is shown on the roster; injured players show a live decimal value.",
        "A skater must be at CON ≥ 95 to dress — below that he's still hurt or rusty and sits.",
      ] },
      { h: "Injuries", points: [
        "Injuries are driven by physical play: heavy hits, blocked shots, fights and non-contact knocks. A chippy, heavy opponent injures more of your players.",
        "Rate is calibrated to ~1 injury per ~5–6 games per team. Most are day-to-day (1–6 days); some are week-to-week; long-term/season-ending injuries are rare.",
        "A player can't be injured twice in one game. Injuries heal by one day for every day that passes, whether you step day-by-day or rest. Each team's injured list shows on its page (Injury Report).",
      ] },
    ],
  },
  {
    id: "goalies", title: "4 · Goalies",
    groups: [
      { points: [
        "Auto-rotation: a goalie must be at CON ≥ 98 on game day to start. If his CON has dipped below it, the fresher goalie gets the net — so no starter is ridden into the ground. (If both are below the bar, the freshest one plays anyway.)",
        "Starting on back-to-back days makes a goalie's night more volatile (wider boom/bust). Goalies recover CON on their rest days.",
        "A goalie's form on the night (hot/cold) swings the whole game — a hot goalie steals wins, a cold one gets shelled.",
      ] },
    ],
  },
  {
    id: "stats", title: "5 · Statistics",
    groups: [
      { points: [
        "Season stats are split into NHL and AHL blocks, each with regular season and playoffs. A player who suits up in both leagues shows both.",
        "Career counts NHL only (the AHL is shown separately under Player Stats).",
        "Game Log (per player, NHL) lists every game: opponent, result and the full scoring line — click any row for the box score.",
        "Plus/Minus follows the real rule: even-strength AND short-handed goals count (the scorer and his on-ice mates get +1, the conceding side −1). Power-play goals don't count.",
        "Each goal records who was on the ice for and against (shown in the box score's play-by-play).",
        "Leaderboards (SV%, GAA, Edge, Advanced) use a sample minimum that scales up as the season matures, so leaders show from the early games.",
      ] },
    ],
  },
  {
    id: "cap", title: "6 · Salary Cap & Finance",
    groups: [
      { points: [
        "Every club must stay under the salary cap. The cap ceiling and floor are set by the commissioner (profinhl or real-NHL values).",
        "In the off-season the ceiling carries a +10% cushion; on opening day the strict ceiling applies and non-compliant clubs are publicly warned and must shed salary.",
        "LTIR: a player parked on long-term injury relief comes off the cap. Buyouts and retained salary are tracked against the club's books.",
      ] },
    ],
  },
  {
    id: "fa", title: "7 · Free Agency",
    intro: "How and when you can sign free agents depends on the phase of the year.",
    groups: [
      { h: "Off-season — the Free Agent Frenzy (July)", points: [
        "The Frenzy is offer-based over three weekly rounds. GMs table offers (money + term + role + special-teams); the player weighs every suitor and signs the best fit when the round resolves.",
        "The first day of each round is a commissioner-office head-start; GMs join from day two. From round 2 on, only clubs already negotiating a player may keep bidding on him.",
        "Two-way vs one-way, granted no-trade clauses (a discount) and term all shape his ask.",
      ] },
      { h: "Regular season — open market", points: [
        "Both your own UFAs and the open market are open. An acceptable offer signs the player immediately — no waiting for a resolution day. Fall short and he tells you what it'll take.",
        "An unsigned free agent softens his demands the deeper the season gets (nobody's biting) — down to roughly −45% late in the year.",
      ] },
      { h: "Playoffs", points: [
        "You may re-sign your OWN pending UFAs (immediate), but the open market is closed.",
      ] },
    ],
  },
  {
    id: "rfa", title: "8 · RFAs, Offer Sheets & Franchise Tags",
    groups: [
      { points: [
        "Restricted free agents must be tendered; their own club gets re-sign rounds before they're exposed.",
        "Offer sheets are allowed against a commissioner-editable compensation ladder — the signing club forfeits its own original draft picks per the tier, verified by the league.",
        "Each club may place one Franchise Tag, which buys the tagged player two re-sign rounds before offer sheets can reach him.",
        "(A league may instead run the 'simple' free-agency system, where everyone tests the market and there are no tags or offer sheets — the commissioner sets this.)",
      ] },
    ],
  },
  {
    id: "contracts", title: "9 · Contracts & Clauses",
    groups: [
      { points: [
        "Contracts have a cap hit and a term. Two-way deals pay less on the farm; an established player past 25 won't take one (except a settling veteran late in the Frenzy).",
        "No-trade / no-move clauses are real: NTC, NMC and modified-NTC (a player-named list of 6/12/18/24 teams). Granting a clause signs the player for a little less.",
        "A player with a clause must consent to a trade that touches it (an agent fee may apply), per the league's clause settings.",
      ] },
    ],
  },
  {
    id: "trades", title: "10 · Trades",
    groups: [
      { points: [
        "Build trades in the Trade Builder (players, prospects and draft picks). You can start one straight from a GM's chat via 'Propose trade'.",
        "Salary retention is supported. No-trade / no-move clauses must be respected — a protected player has to consent.",
        "Depending on league settings, trades may require commissioner approval. Every trade is logged.",
      ] },
    ],
  },
  {
    id: "waivers", title: "11 · Waivers",
    groups: [
      { points: [
        "Waivers can be turned on or off by the commissioner.",
        "When on: exposed players clear a one-day window; claims go by reverse-standings priority, otherwise the player clears to the AHL. Entry-level players are typically waiver-exempt.",
      ] },
    ],
  },
  {
    id: "draft", title: "12 · Entry Draft",
    groups: [
      { points: [
        "Draft order follows reverse standings, with a verifiable NHL-style lottery (14 balls / 1001 combinations) for the top picks.",
        "The Draft Room supports live picking, manual phase control, admin bonus rounds and off-board custom picks. The real NHL draft class is imported for the current year.",
      ] },
    ],
  },
  {
    id: "awards", title: "13 · Awards",
    groups: [
      { points: [
        "Statistical trophies (scoring, wins, etc.) are awarded automatically. The rest (Hart, Norris, Vezina, Calder, Selke and more) are decided by a GM ballot; clubs with no human GM cast a stat-based AI ballot.",
        "Season history, records and a team trophy case are kept under History / League.",
      ] },
    ],
  },
  {
    id: "messages", title: "14 · Messages",
    groups: [
      { points: [
        "GMs can direct-message each other from the Messages tab — chat history, emoji, delivered ✓ / read ✓✓ receipts, and a Propose-trade button that opens the Trade Builder against that GM. A badge flags new messages.",
      ] },
    ],
  },
];

export default function RulesPage() {
  return (
    <div className="space-y-6 py-2 max-w-4xl">
      <PageHeader title="League Rules" subtitle="How everything works — the full rulebook for UNHL." />

      {/* quick index */}
      <Card>
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="text-xs px-2.5 py-1 rounded-full bg-slate-800/70 text-slate-300 hover:bg-blue-600 hover:text-white transition-colors">{s.title}</a>
          ))}
        </div>
      </Card>

      <div className="space-y-5">
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-24">
            <Card title={s.title} accent="text-blue-400">
              {s.intro && <p className="text-sm text-slate-400 mb-3">{s.intro}</p>}
              <div className="space-y-4">
                {s.groups.map((g, gi) => (
                  <div key={gi}>
                    {g.h && <div className="text-xs font-bold uppercase tracking-wide text-emerald-400/90 mb-1.5">{g.h}</div>}
                    <ul className="space-y-1.5 text-slate-300 text-sm list-disc list-inside marker:text-slate-600">
                      {g.points.map((p, i) => Array.isArray(p)
                        ? <ul key={i} className="ml-5 space-y-1 list-[circle] list-inside text-slate-400">{p.map((x, j) => <li key={j}>{x}</li>)}</ul>
                        : <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        ))}
      </div>

      <p className="text-xs text-slate-500 text-center pb-4">Some values (cap, variance, injury rate, FA/waivers systems) are commissioner-tunable and may differ per league.</p>
    </div>
  );
}
