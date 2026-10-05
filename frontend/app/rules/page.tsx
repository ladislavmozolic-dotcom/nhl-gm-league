import { PageHeader, Card } from "@/components/ui";
import { getLang } from "@/lib/lang-server";

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
        "Worthy-goalie rule: every club must carry at least one NHL-roster goalie who is either rated 72 overall or higher, started 35+ real games last season, or started more than 15 real games at a save % above 90 — an OV that hasn't caught up to a proven real-life track record still counts. A club with no qualifying goalie (a trade, a send-down) shows a warning on its own Goalies section, in the trade builder's fit check, and on the Commissioner Dashboard's pre-flight checklist — sign, trade for, or call up a qualifying goalie to clear it. A goalie who clears the bar is marked in green.",
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
      { h: "Buyouts", points: [
        "Any NHL-roster player with an active contract can be bought out. The annual dead-cap charge is 66% of his current cap hit during the regular season or playoffs, and 33% during the off-season, Free Agent Frenzy or preseason, rounded to the nearest $500.",
        "That annual charge counts against the cap for twice his remaining contract years (e.g. 4 years left on his deal → 8 years of dead cap). A buyout never deducts cash from the team's bank account.",
        "The bought-out player instantly becomes a UFA and loses the captaincy. There's no age-based discount (unlike the real NHL's under/over-26 split), no protection from no-trade or no-movement clauses, and no seasonal blackout window — only the in-season vs off-season timing changes the price.",
        "The public Buyout Calculator uses exactly the same calculation as the live Buy out button. Its player picker includes every NHL and AHL/farm player with an active contract and a salary above $100,000, so farm contracts can also be tested.",
      ] },
      { h: "Coach contracts & buyouts", points: [
        "Each club carries one head coach. His salary and contract length (up to 4 years) are set automatically by his overall rating — a GM doesn't negotiate a coach's terms, only whether to sign him. Coach salary doesn't count against the salary cap, but it does draw down the bank like any other club expense.",
        "Firing a coach pays out his ENTIRE remaining contract (salary × years left) from the team bank in one lump sum, immediately — no age or timing discount, no proration for years already served. He returns to the free-agent coaching pool the moment he's fired, and can be re-signed by any club, including yours, on a fresh contract reflecting his rating.",
      ] },
    ],
  },
  {
    id: "fa", title: "7 · Free Agency",
    intro: "How and when you can sign free agents depends on the phase of the year.",
    groups: [
      { h: "Off-season — the Free Agent Frenzy", points: [
        "The Frenzy has three rounds. Each round gives every GM 4 days for first offers (money + term + role + special teams), followed by a 2-day improvement stage for the clubs that made the cut.",
        "At the end of the 2-day stage the Agent evaluates the live offers. Unsigned players return immediately for the next round with softer demands.",
        "After round 3, remaining UFAs enter a continuous market: a first offer opens 24 hours; if another club joins, the current bidders receive a final 24 hours to improve before the player decides.",
        "Two-way vs one-way, granted no-trade clauses (a discount) and term all shape his ask.",
      ] },
      { h: "Regular season — open market", points: [
        "Both your own UFAs and the open market are open. Players remaining from the Frenzy continue under the 24-hour window system.",
        "An unsigned free agent softens his demands the deeper the season gets (nobody's biting) — down to roughly −45% late in the year.",
      ] },
      { h: "Playoffs", points: [
        "You may re-sign your OWN pending UFAs (immediate), but the open market is closed.",
      ] },
      { h: "Two-way contracts — who'll actually sign one", points: [
        "No real NHL games last season (a pure farm player): he'll take a two-way up to 3 years, any round.",
        "Some NHL games, but not enough to count as established: up to 2 years, any round.",
        "An established NHL player (well past the \"prospect\" games-played mark) refuses a two-way outright — UNLESS the market's gone cold for him (he drew no offer at all in round 1), in which case one of two things can bring him around, always for a single 1-year \"prove it\" deal: he's older (past the league's set age) and settles from round 2; or he isn't older but grades out as fringe/4th-line caliber and settles from round 3. A genuinely good established player keeps refusing a two-way no matter how many rounds pass — offer him a one-way instead.",
      ] },
    ],
  },
  {
    id: "rfa", title: "8 · Re-Signing Your Own Players — UFA & RFA",
    intro: "Everything about extending one of your OWN expiring players: how the Agent negotiates, what a qualifying offer is, arbitration, offer sheets, the Franchise Tag and what moves a player's price. Start from Finance & Contracts → Team Contracts.",
    groups: [
      { h: "The basics", points: [
        "The longest one-way contract is 4 seasons; a two-way deal is at most 2 seasons (and only players who are willing will sign one — see the two-way rules in the Free Agency section).",
        "Your cap space for next season is on your team page under Finance & Contracts → Salary Cap. The players whose deals end after the season are under Finance & Contracts → Team Contracts.",
        "You don't have to extend anybody. A UFA you leave alone simply walks to the open market after the season. An RFA you leave alone stays with you only as long as the qualifying-offer rules below hold.",
      ] },
      { h: "Who's a UFA, who's an RFA", points: [
        "His status is decided by his age on June 30 of the year his CURRENT deal expires — not his age today. 27 or older by then = unrestricted; younger = restricted.",
        "(A league may instead run the 'simple' free-agency system, where everyone tests the open market — no RFA rights, tags or offer sheets. The commissioner sets this.)",
      ] },
      { h: "When you can negotiate", points: [
        "Any time he's in the final year of his deal or it's already expired — except during the Free Agent Frenzy itself (the open market has its own flow) and the first days of a new regular season (commissioner-set window, lets rosters settle first; the commissioner can exempt an individual club from that window, e.g. for testing).",
      ] },
      { h: "Step 1 — his demand", points: [
        "When you open negotiations he states his demand: an approximate cap hit and the term he prefers, shown as a range (for example: looking for roughly 3.40M–4.04M / 3 years). The salary and term boxes start blank — you enter your own numbers.",
        "Price depends on term. A player up to roughly 33–34 asks LESS for one year than for four (Quinn Hughes wants less on a 1-year deal than on a 4-year one). An older player runs the other way — Alex Killorn asks MORE for one year and less for three. All numbers are cap hits.",
        "You only ever see the range at HIS preferred term. His exact demand at any other length stays hidden, so you have to feel your way.",
      ] },
      { h: "Step 2 — your offer and his reaction (not like real life)", points: [
        "Example (invented): Cutter Gauthier's hidden demands are 10M for 1 year, 11M for 2, 12M for 3 and 13M for 4. You only see about 11.55M–12.5M for his preferred 3 years. You want him for 4, so you offer 4 years — his real demand there (13M) stays hidden.",
        "In real life a club would counter low and meet in the middle. Here the PLAYER has the leverage: undershoot his demand by too much and he takes offence — his next demand goes UP (13M can become about 14.5M).",
        "How far you can undershoot depends on his price tier: under $3M ≈ 33 %, $3–5M ≈ 25 %, $5–10M ≈ 20 %, $10–15M ≈ 15 %, $15M+ ≈ 10 %. At a 13M demand, an offer of roughly 11.05M or less insults him.",
        "An insult is remembered for your club (about 200 days) and stacks: the first counter after an insult already shows the raised range, there is room for roughly two insults, and after TWO of them he only accepts his full ask. On his last round he names the exact minimum he will sign for.",
        "If your offer is below his demand but NOT an insult, he turns it down without raising anything — he only tells you it isn't enough.",
        "Players who ask for less will usually knock off about 250,000; more expensive ones up to about 500,000. How you use that is up to you.",
      ] },
      { h: "How many offers you get", points: [
        "UFA: up to 3 offers. After each he either accepts, or rejects and tells you why (raising his demand if you undershot). After the 3rd rejection he announces he'll test the open market after the season and you can no longer extend him.",
        "RFA (no tag): 2 offers. Reject his counter to the 2nd and talks stop for now — he waits for an offer sheet from a rival club.",
        "RFA with your Franchise Tag: 3 offers (one extra round); he is protected from offer sheets until those rounds are used up.",
        "An RFA nobody signed through offer sheets comes straight back to you: from then on you negotiate directly, offer after offer, with no cap on rounds and no second trip to offer sheets.",
      ] },
      { h: "Qualifying offer (QO) — RFAs only", points: [
        "Every RFA has a qualifying offer on RFA Central: normally 100 % of his current AAV and at least the league minimum (both are commissioner settings). Tender it by the deadline (June 25) to keep his restricted rights.",
        "A QO is tendered automatically the moment you start negotiating with him — a club that is already talking to a player can't lose him to a missed deadline. A week before the deadline you also get a reminder (a DM plus a banner on Team Contracts) listing every RFA still without a QO.",
        "A QO is also what makes a player reachable by offer sheets: without one he can't receive any.",
        "Missing the deadline with no QO and no negotiation releases his rights: he becomes a UFA — even at 26 or younger.",
        "A normal Re-sign is always available and closes any QO or arbitration case immediately. Arbitration is never required just to extend an RFA.",
      ] },
      { h: "Salary arbitration — RFAs only", points: [
        "Eligibility: age 24+ OR 40+ NHL games last season (commissioner settings). Either the club or the player may file once a QO has been tendered. While an arbitration case is open, ordinary re-sign offers are blocked.",
        "The arbitrator compares six similar players (same position, similar rating and age) and sets a band: 80–120 % of their median cap hit, never below the QO. The club's and the player's submissions default to the bottom and the top of the band.",
        "The verdict arrives automatically 48 hours after the filing (the commissioner can issue it sooner). The salary is the midpoint of the two submissions, inside the band.",
        "The term (1 or 2 years) is chosen by the side that did NOT file: if the club filed, the player picks (1 year); if the player filed, the club picks (2 years — 1 year when the award is walk-away money).",
        "A two-way award pays him the FULL salary on the farm too — it never counts against the salary cap, only against Finance. A two-way isn't possible at $1.3M or more, or for an established NHLer (180+ games over 3 seasons, 60+ last season, no waivers).",
        "Below $4.5M the club must accept the award. At $4.5M or more it may walk away, and he then becomes a UFA. The new contract STARTS when his current deal expires — an award handed out during the season never changes this season's salary or cap hit.",
      ] },
      { h: "Offer sheets (RFA only)", points: [
        "Only an RFA whose club tendered a QO can reach offer sheets. Open July 1–8 of the off-season; resolved July 10. A commissioner-set compensation ladder (his old club's own original draft picks, by AAV tier) is what the poaching club pays if he signs.",
        "His AI picks the single best sheet that both meets his asking price AND beats YOUR last standing offer to him — there's no old-NHL 'right to match', so your own offer's number is what a raider actually has to clear.",
        "An arbitration award closes the offer-sheet path: the player either signs the award or the club walks away and he enters normal UFA free agency.",
      ] },
      { h: "Franchise Tag", points: [
        "One per club, RFA-age players only. The tag gives you a 3rd offer and protects him from offer sheets through those rounds. If they end without a deal he becomes available to offer sheets like any other RFA (the tag falls away if a rival signs him); if nobody does, you keep negotiating with him directly.",
      ] },
      { h: "Release his rights instead", points: [
        "\"Release rights\" on Team Contracts (RFAs only) declares you won't extend him: he's priced and treated like a UFA from then on — no RFA discount, no ceiling — and hits the open market the instant his deal runs out, instead of staying tied to you. Reversible any time before he actually expires.",
      ] },
      { h: "What shapes his price", points: [
        "Lowball insult: undershoot his real floor by too much (a sliding bar — roughly a third on a modest deal, down to about a tenth on a $15M+ one) and he remembers it — his asking price to YOUR club specifically climbs, with room for roughly two such insults before it caps out (never under the commissioner's own 25% floor, more on a cheap contract). Other clubs aren't affected. Insult him twice and floor money stops working — from then on it's his full ask or nothing.",
        "Term pricing: his headline number is calibrated to his preferred length. Offer more or fewer years than that and the price bends — usually up for more term, down for less — EXCEPT a player 35 or older, who runs the other way: a longer deal costs LESS per year (a team-friendly, real-NHL-style extension), while a short 'one more run' year is his most expensive ask.",
        "Promise him a worse role than he wants and he charges a premium, takes a shorter term — and a no-trade clause stops earning him a discount, since he wants to stay free to leave if you don't deliver.",
        "Team strength: older players chase winners. At 32+ a contender can get up to about 7.5 % off his demand, while a rebuilding club pays up to about 12.5 % extra. Under 24 it barely matters (around 1 %). Check how strong you look under League → Fan Interest.",
        "Role: the price shown on Demand Watch and in the re-sign window already assumes the line and special teams he projects into. Promise a SMALLER role (each line below his expectation adds roughly 11 %, up to about 38 %; wanted PP/PK he doesn't get adds more) and the demand climbs. Promise a BIGGER role than he projects and it does NOT drop — only a granted no-trade clause lowers his price.",
        "Trade activity: agents remember that you sign free agents and flip them within a year, and may raise demands for your future signings. It looks back about 270 days and counts only players signed on the open market — never ones you extended.",
        "Kept promises: promise a 2nd line and PP time, then play him on the 3rd line without PP, and the agent remembers — other players at your club ask for more.",
        "Morale: a happy player gives a discount (up to about 12 % for a star), an unhappy one asks for a premium (up to about 16 %). Better players are affected more, fringe players barely at all.",
      ] },
      { h: "Rookies (ELC contracts)", points: [
        "When one of your prospects plays the required minimum of games (in real life), he jumps into your lineup for the next season with an automatic salary based on how he performed in his first NHL/AHL season. You can't influence it.",
      ] },
    ],
  },
  {
    id: "contracts", title: "9 · Contracts & Clauses",
    groups: [
      { points: [
        "Every contract has a cap hit and a term (years). A two-way deal has two salaries: its offered NHL salary and a fixed $100,000 AHL salary. The NHL salary counts against the cap only while the player is on the NHL roster; on the farm the club pays the AHL salary and no NHL cap hit is charged.",
        "Existing farm contracts signed before the separate AHL-salary system keep their original listed salary on the farm. The fixed $100,000 AHL salary applies only to new two-way contracts that explicitly include it.",
        "A legacy $100,000 farm-only player cannot be called up. His GM may use Offer 2-way beside the player in the AHL section of Team Roster to propose an NHL salary and term; the Agent applies the same age, NHL-experience, term and salary rules as for every other two-way offer. If accepted, the player becomes call-up eligible.",
      ] },
      { h: "NTC vs NMC vs Modified-NTC — what each actually protects", points: [
        "NTC (No-Trade Clause) — blocks ANY trade without the player's consent. He can still be exposed to waivers.",
        "NMC (No-Movement Clause) — full protection: blocks a trade AND blocks waivers. The strongest, and priced accordingly (see below).",
        "Modified-NTC — the player names a list of 6, 12, 18 or 24 teams; a trade to any club NOT on that list needs no consent at all. A bigger list costs the club more when signing him.",
      ] },
      { h: "Granting a clause: the signing discount", points: [
        "A player takes a little less money for the security: NMC ≈ 8% off, NTC ≈ 5% off, Modified-NTC scales with the list size (a 6-team list barely moves the needle; a 24-team list is nearly as valuable to him as a full NTC).",
      ] },
      { h: "Trading a protected player: the agent fee", points: [
        "A club dealing a clause player needs his consent — decided automatically by comparing his new situation (role + team strength) to his old one, and it costs real money out of the DEALING club's bank, on top of his salary:",
        [
          "A clear step up (better role and/or a stronger team) — he waives for free.",
          "A lateral move — a token ~15% of his remaining salary (cap hit × years left).",
          "A step down — the fee scales up with how much worse it is, well past 20%.",
          "A clear downgrade — he wants his ENTIRE remaining salary paid out to approve it.",
          "NMC carries a further +25 percentage points on top of the NTC/step-down math — the strongest clause is the hardest (and priciest) to move.",
          "Modified-NTC is simpler: free if the destination isn't on his list, full remaining salary if it is.",
        ],
      ] },
    ],
  },
  {
    id: "trades", title: "10 · Trades",
    groups: [
      { points: [
        "Build trades in the Trade Builder (players, prospects and draft picks). You can start one straight from a GM's chat via 'Propose trade'.",
        "No-trade / no-move clauses must be respected — a protected player has to consent.",
        "Depending on league settings, trades may require commissioner approval. Every trade is logged.",
      ] },
      { h: "Overtime", points: [
        "Regular season (as in the NHL): a tie after 60 minutes goes to 5:00 of sudden-death 3-on-3 overtime, then a shootout. The loser gets a point.",
        "Playoffs (as in the NHL): no shootout — full 20-minute periods of 5-on-5 sudden death, with normal lines, power plays and penalties, as many as it takes until someone scores.",
      ] },
      { h: "Game flow & bench decisions", points: [
        "Icing: a clearance from your own end that goes the length of the ice stops play — your unit on the ice can't change and the draw is in your zone (a tired line under forecheck ices it most). Shorthanded teams may ice it. About 4 per team per game.",
        "Zone faceoffs: after an icing, a frozen puck or a penalty, the draw is in that team's end — win it there and you start with the puck in the zone. A power play therefore starts with an offensive-zone draw.",
        "Delayed penalty: while the referee's arm is up the other side pulls its goalie for an extra attacker until an offender touches the puck; a goal in the meantime washes a minor out.",
        "Coincidental minors (one to each side, e.g. an after-the-whistle scrum) at full strength → 4-on-4, as in the NHL. Other coincidental combinations are substituted.",
        "Lines → Strategy → Bench decisions (your choice): shorten the bench (a one-goal game in the last 7 minutes of the 3rd: the 4th line and 3rd pair sit more; playoff OT: only a mild lean, since OT can run for periods), adjust to the score from the 3rd period (push when behind, tighten when ahead), use the timeout (late after an icing when leading/tied, or right before pulling the goalie), and the coach's challenge (offside / goaltender interference: 'when the video looks good', always or never). A failed challenge costs a 2-minute minor.",
        "Zone draws: when a faceoff is in one end, each bench that can change (not a team that just iced it) may send the right unit — its best faceoff / checking line to defend its own end (almost always late in a close 3rd), its top line for an offensive-zone draw — and the best faceoff man on the ice takes it.",
        "Shaken up: many hits, blocked shots and knocks send a player to the room for a few minutes; he returns later in the game. Only real injuries keep him out (and show on the injury report).",
        "Home crowd: a packed building lifts the home side a little (up to ~+2 % shot attempts; +2 % more in the playoffs), a half-empty arena gives less. Global Series games are neutral.",
        "Referees: every NHL game gets two referees and two linesmen from the real 2025-26 NHL roster (League → Officials). A strict crew calls more penalties, a lenient one fewer, based on each referee's real penalties per game.",
      ] },
      { h: "Player Safety (suspensions)", points: [
        "After every night's games the Department of Player Safety reviews game misconducts, majors for violent infractions (boarding, cross-checking, elbowing…) and hits that injure an opponent. Most incidents draw nothing; some a fine (max $5,000), some a suspension of 1–10 games — about 35 a season, like the NHL.",
        "A repeat offender (suspended within the last 18 months) is punished harder. A suspended player can't dress (NHL or AHL) and serves in his NHL club's games.",
        "Forfeited salary follows the CBA: a first offence costs 1/(days in the season) of his salary per game, a repeat offender 1/82 per game — the club doesn't pay it, so it's credited to its bank.",
        "The GM can appeal to the commissioner within 48 hours (Player Safety page). The player keeps serving while the appeal is heard; the commissioner upholds, reduces or overturns.",
      ] },
      { h: "Trade deadline", points: [
        "The trade deadline follows the NHL calendar (2026-27: Monday, March 1, 20:00 Bratislava — before that night's sim, so it runs on the new rosters). After it, no trades until your season is over.",
        "Every GM is reminded 24 hours before. Deadline Day (Trades menu) shows every deal of the final week live with UNHL Intelligence grades, and a winners-and-losers recap is posted to League News once it passes.",
      ] },
      { h: "Special games", points: [
        "The real NHL outdoor games and Global Series are on our schedule: Heritage Classic (WPG–MTL, Oct 25), Global Series Finland (SEA–CAR, Nov 12 & 14), Global Series Germany (OTT–CHI, Dec 18 & 20), Winter Classic (UTA–COL, Dec 31) and Stadium Series (DAL–VGK, Feb 20).",
        "They're simulated like any other game, but the crowd is the stadium's, and both clubs earn event income on top (commissioner-set).",
      ] },
      { h: "Retired numbers", points: [
        "Every club carries its real NHL retired numbers (and Gretzky's 99 is retired league-wide). A retired number can't be handed to anyone else on that club.",
        "A GM can retire a number for a player who has retired from playing — or is in the UNHL Hall of Fame — and played enough UNHL games for the club (default 300). The ceremony is announced in League News.",
      ] },
      { h: "Playoff odds", points: [
        "Standings ▸ Odds: a nightly Monte Carlo of the rest of the season (5,000 runs). Team strength blends today's results and goal differential with a roster prior that fades over the first ~25 games; the playoffs follow the NHL bracket and the #1-pick odds use our real draft lottery.",
      ] },
      { h: "Player morale & trade requests", points: [
        "Every NHL player compares his ice time with what his talent earns on YOUR club — e.g. a 2nd-line-calibre forward vs. the average minutes of your 2nd-line tier over the last 10 games (goalies: share of starts). A healthy scratch counts as 0:00. Only games since he first dressed for you count, and new arrivals get two weeks to settle.",
        "Below the league's threshold (default 80 %) he's unhappy and his morale drains. After 5 unhappy days his agent messages you (League Notifications); after 20 he publicly requests a trade.",
        "While he's unhappy — or has asked out — he won't negotiate an extension with you.",
        "Give him the minutes back and it unwinds: the warning clears and an ice-time trade request is withdrawn. Trading him wipes it with the new club.",
        "Putting a player on the Trade Block costs him 8 morale (MO) once. It doesn't recover while he stays listed; once he's off the block (and isn't unhappy) it climbs back — through games, and +1 on every day his club doesn't play, up to the league baseline (50).",
      ] },
      { h: "Negotiating with free agents", points: [
        "Lowballs have a cost: undershoot his headline ask past a tiered line (33 % on a modest ask, down to just 10 % on a $15M+ one) and he's insulted — his ask to YOUR club specifically goes up by a flat amount tied to that same tier ($500K on a small deal, up to $2M on a huge one), until he signs anywhere. Other clubs aren't affected. Short of that line he'll still settle a touch below his headline number without holding a grudge.",
        "That bump always leaves room for roughly two real insults before it caps out — never less than the commissioner's own floor (25 % by default), but it's raised automatically for a cheaper contract, where one bad lowball alone can already be close to 50 %.",
        "Lowball him twice and floor money stops working from then on: he holds out for his full headline ask, not just his bare minimum, until he signs.",
        "Promise him a worse line than he wants and he charges a premium, takes a shorter deal — and a no-trade clause no longer buys a discount: he wants to be free to move on.",
      ] },
      { h: "Trade deadline", points: [
        "The commissioner sets the trade deadline (date + time, Bratislava time). A countdown runs site-wide for the final 14 days, and on deadline day every page shows a live 🚨 breaking-trades ticker.",
        "A trade must be fully completed (accepted, and approved if it needs commission review) BEFORE the deadline — a proposal still pending at the deadline can no longer go through.",
        "NHL rule: after the deadline no club may trade until its own season is over — clubs that miss the playoffs once the regular season ends, playoff clubs once they're eliminated. Both clubs in a deal must be done. Everyone can trade again in the off-season.",
        "Waivers, call-ups and free-agent signings are not affected by the deadline.",
      ] },
      { h: "Salary retention", points: [
        "A club may retain up to the league's max % of a player's cap hit in a trade — the acquiring club only carries the reduced cap hit; the retaining club carries the retained slice as dead money for the rest of that contract.",
        "Re-traded again, no further retention: once acquired, a club can deal him again at any time without adding retention of its own — the ORIGINAL retaining club keeps paying its share until that contract runs out, no matter how many more times he's traded.",
        "Re-traded again WITH more retention (double retention): one contract can carry retention at most twice, ever. A 2nd retention on the same contract can't be applied until 75 in-season days have passed since the first (off-season days don't count) — this closes off the old same-day 'retention broker' trick at the trade deadline.",
        "Returning to a club that retained on him: a club that retained salary on a player can't reacquire him — by trade or off waivers — for a full year (365 days) from that trade, unless the specific contract it retained on has since fully expired or been bought out.",
      ] },
      { h: "Retention capacity limits", points: [
        "A club has a league-set total number of retention \"slots\" (default 3) — ONE combined pool of contracts it's retaining on (dead money it pays) PLUS retained-salary players it rosters (acquisitions someone else subsidizes), not two separate limits. Acquiring a player who already carries retention from an earlier trade uses a slot too, even if this trade adds no new retention of its own.",
        "The combined retained-salary dollars a club is involved in (both sides together) can't exceed a league-set % of the cap ceiling (default 10%) — shown as \"Retention % of cap\" in the Trade Builder.",
        "Both limits are checked against what a club already carries PLUS what the proposed trade would add — not the trade in isolation — and a trade that would push either club over either limit is rejected. The Trade Builder previews the same numbers live before you propose.",
      ] },
    ],
  },
  {
    id: "waivers", title: "11 · Waivers",
    groups: [
      { h: "Who needs to clear waivers", points: [
        "Waivers can be turned on or off by the commissioner.",
        "Waiver-exempt: a player on an ELC or a two-way contract can be sent to the farm directly, no waivers needed.",
        "A one-way / veteran player must clear the wire first — the roster mover blocks a direct bury-to-the-farm and points you to the Waiver Wire instead.",
        "A cap hit above $1.5M currently can't be placed on waivers at all — too valuable to realistically waive to the farm this way (a commissioner-tunable limit).",
        "An NMC blocks waivers outright; an NTC does not.",
      ] },
      { h: "Recall pass (Rule 30/10)", points: [
        "Calling a player up from the AHL starts a temporary exemption: he can be sent back down without clearing waivers again as long as it's been 30 days or fewer, and 10 NHL games or fewer, since that call-up.",
        "Cross either limit — his 11th NHL game since the recall, or his 31st day up — and the pass expires. His next trip to the farm has to clear the Waiver Wire like any other one-way player.",
        "A fresh call-up always starts a brand-new pass, even for a player who already burned one earlier in the season.",
      ] },
      { h: "The one-day window", points: [
        "Any club can claim an exposed player within a one-day window.",
        "Waiving a player is final — there's no pull-back. Once he's placed on the wire, the placing club can't reverse it, claim or no claim.",
        "Unclaimed after the window closes → he clears to the placing club's own AHL affiliate.",
      ] },
      { h: "Multiple claims — who wins him", points: [
        "Regular season / playoffs: reverse-standings priority — the worst team in the league gets him.",
        "Off-season, Frenzy, preseason (standings don't mean anything yet): a claim-order queue instead — whichever claiming club has gone the longest without winning a contested claim gets him (ties broken by whoever claimed first), and the winner then drops to the back of that line for next time. So a club that just won a claim won't win the next contested one too, even if it claims first — a club that's never claimed (or claimed longest ago) jumps the queue.",
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
  {
    id: "attributes", title: "15 · Player & Goalie Attributes",
    intro: "Every skater and goalie carries a set of STHS-style attribute ratings (roughly 20–99). These are what the sim engine actually reads every game — here's what each one does.",
    groups: [
      { h: "Skaters", points: [
        "SC — Scoring: the main driver of a skater's shooting/finishing ability. The biggest factor in who scores goals.",
        "PA — Passing: the main driver of playmaking. The biggest factor in who picks up assists, and whether a pass under pressure is completed or picked off.",
        "PH — Puckhandling: feeds both scoring and playmaking, and matters on zone entries and protecting the puck.",
        "SK — Skating: feeds scoring, playmaking and defense a little each, and softens how hard fatigue bites during a shift.",
        "DF — Defense: the main attribute that suppresses the opponent's scoring chances. Also the primary shot-blocking stat and what a defender relies on to break up a pass.",
        "CK — Checking: drives a player's hitting rate and feeds his defense rating. A heavier-hitting, more physical team causes more injuries to its opponents.",
        "ST — Strength: feeds defense, hitting and shot-blocking. Matters most in board and net-front battles.",
        "FO — Faceoffs: direct faceoff win rate — who starts a shift with the puck.",
        "DI — Discipline: higher means fewer penalties taken.",
        "FG — Fighting: decides who drops the gloves and who wins a fight. Doesn't affect any other in-game stat.",
        "PS — Penalty Shot: shootout / penalty-shot conversion chance, and a slice of a player's \"clutch\" rating (see below).",
        "EX — Experience: the single biggest piece of a player's clutch rating — poise in a tight third period or overtime.",
        "LD — Leadership: the rest of the clutch rating, and it dampens the team's momentum swing right after conceding a goal.",
        "MO — Morale: unlike the others, this is a live 1–100 mood value that drifts with wins, ice time and production, and nudges performance game to game rather than staying fixed.",
        "DU — Durability: lowers a player's injury chance and severity, and how much a still-recovering (low-CON) player is penalized before he's fully back.",
        "EN — Endurance: how fast a player tires within a game — low endurance fades harder on long shifts and in the third period.",
      ] },
      { h: "Goalies", points: [
        "AG (Agility), RB (Rebound control), SZ (Size), HS (Hand speed), RT (Reflexes), SC (Style) and PH (Puckhandling) blend together into a goalie's overall save quality — AG and RB carry the most weight, PH the least.",
        "RB — Rebound control also directly lowers the odds that a save kicks out a dangerous rebound chance right back at the shooter.",
        "DU — Durability sets how many shots a goalie can face before losing a CON point — a workhorse tolerates a heavier workload before tiring.",
        "MO — Morale is a live value for goalies too: a confident goalie steals games, a shaky one lets in soft ones — worth up to about ±5% on his save quality that night.",
        "CON still gates who starts (must be ≥98 on game day, see §4) and scales save quality directly. EN/SK/PS/EX/LD are shown on a goalie's card but aren't separately weighted in the save-quality formula above.",
      ] },
      { h: "Also worth knowing", points: [
        "OV (Overall) is a single summary number. It decides automatic ice time/depth charts whenever you haven't set lines manually, and (stretched for realistic team-to-team separation) roughly represents overall team quality.",
        "CON (Condition) is covered in §3 — it's not a fixed attribute, it's the live fatigue/health value that drops as a player plays and recovers on rest days.",
      ] },
    ],
  },
  {
    id: "tactics", title: "16 · Team Tactics & Line Fit",
    intro: "Beyond raw ratings, HOW you deploy your roster moves every simulated game — team-wide system tactics, per-line overrides, and how well the players on a line/pair actually complement each other.",
    groups: [
      { h: "Team system tactics", points: [
        "Six dials, each with a neutral \"Balanced\" default: Tempo (pace of play), Forecheck (pressure on the puck), Puck Style (how you attack), D-Zone Coverage (how you defend your own end), and two special-teams dials — PP Style and PK Style. Presets bundle them (Run-and-Gun, Trap, Heavy Forecheck, Shot Volume, Shutdown) or set each dial individually from the Tactics page, which spells out exactly what each option does and which attributes it wants.",
        "Every non-balanced choice has a real upside (more shots, more takeaways, fewer/less dangerous chances against, a stronger power play or kill) AND a real cost (more shots against, more fatigue, more penalties) — the cost always applies in full; the upside is scaled by System Fit below.",
        "System Fit (shown live as a %, roughly 60–118%) measures how well your roster's ice-weighted attributes suit the dials you've picked — e.g. a Fast tempo wants skating + endurance, an Aggressive forecheck wants checking + speed, a Cycle attack wants passing + strength, a 1-3-1 power play wants a one-timer shooter + a playmaker. Pick a system your roster fits and its benefits are amplified; force one it doesn't fit and you still pay the full cost without the full reward.",
        "Your head coach nudges Fit two ways: his Experience (EX) helps him execute a demanding system (a veteran bench boss lifts a shaky fit; a rookie can't get as much out of one), and his personal coaching Style (Offensive / Defensive / Physical / Balanced) adds a small bonus when the system you install matches his own identity, and a little friction when it clashes.",
        "Per-line overrides: each forward line can run its own Puck Style, and each D pair its own D-Zone coverage, layered on top of the team-wide Tempo and Forecheck (which always stay team-level) — e.g. a shutdown pairing can play Collapse while your top pairing plays Aggressive.",
      ] },
      { h: "Line & pair role fit (chemistry)", points: [
        "Beyond raw talent, a unit's role MIX matters: a forward line wants a playmaker + a sniper + a grinder, not three of the same type; a D pair wants one offense-leaning defenseman paired with one defense-leaning one, not two who play an identical style.",
        "A player's role is judged relative to the LEAGUE AVERAGE for his position, not by comparing his own offense to his own defense in isolation — a defenseman only counts as offense-leaning if he's genuinely more offensive than a typical NHL defenseman, since defensive attributes run high across the board for every D-man. (Judging a player purely against himself used to misclassify plenty of real offensive defensemen as defensive, since even an offensive D's defensive numbers usually still beat his own offensive ones.)",
        "Role Fit is a graduated score, not a pass/fail flag: a strongly complementary pairing (a true shutdown D next to a true offensive-QB D) scores meaningfully higher than a barely-complementary one, rather than every \"mixed\" combo landing on the same number. It feeds real games directly through a structural penalty that suppresses a role-redundant unit's offensive output — one that does NOT fade with time on ice together, unlike the separate chemistry penalty below.",
        "Separately, a line/pair also builds ordinary chemistry from repeated shared ice time — a freshly formed or just-shuffled combo sims below full strength until it gels, and that penalty DOES fade as the unit plays together. The Line Editor shows live badges for both Chemistry and Role Fit while you drag players around, and the Line Builder view shows the same numbers (plus an offensive profile and a plain-language summary) for your saved lines.",
        "Chemistry is tracked per PAIRWISE BOND inside a unit (a trio has 3 bonds, a pair has 1) — so splitting a trio only cools the bond(s) that actually stopped playing together, not the whole line. An intact bond gains chemistry every game the two are dressed together in the same unit; a bond that's split loses ground slowly — about half the growth rate per game apart — down to a floor equal to a brand-new pairing's starting value, never lower. Reuniting two players later resumes their bond from wherever it faded to (it's remembered per pair, independent of the current line sheet), not a reset to zero — and nothing changes at all for a bond during any stretch with no games simulated (e.g. the off-season).",
        "Special-teams units (PP1, PK1, etc.) work differently: they're graded as one unit rather than pairwise, and breaking one costs a real cliff the game it happens — an instant drop, not a slow fade — while an intact special-teams unit still just grows steadily like a 5v5 bond. Either way, low chemistry only ever costs offensive output, never grants a bonus above the gelled threshold, and because a broken 5v5 bond never falls below its floor, its worst-case penalty from chemistry alone stays modest — well short of the maximum penalty a chemistry score of zero would imply.",
      ] },
      { h: "Tactical Fit — how it all comes together", points: [
        "The Line Builder page scores every saved line/pair with one \"Tactical Fit\" number (0–100) that folds FOUR separate things together: Role Fit (the role-diversity score above), position & handedness correctness (is each forward slotted somewhere his own position covers; is the D pair's shooting hand right — left shot on the left, right shot on the right), System Fit — the SAME roster-vs-tactics measure from Team System Tactics above, computed just from that one line's own personnel average against whichever system dials you've set for the team — and Depth-Chart Archetype Fit (below).",
        "Depth-Chart Archetype Fit checks each player's real scouting TYPE — the same label shown on his player profile page (Sniper, Playmaker, Dual-Threat, Two-Way Forward, Defensive Forward, Forechecker / Grinder, Offensive/Two-Way/Defensive/Stay-at-Home Defenceman, etc.) — against what that specific slot on the depth chart actually wants, instead of scoring every line/pair the same way regardless of where it sits. The 1st and 2nd forward lines want skill (Sniper, Playmaker, Dual-Threat, Offensive Forward) — though a power-forward-style \"Forechecker / Grinder\" who still carries real offense (checking just edges out his offense in the classifier, not because he lacks it) counts as a genuine plus on EITHER scoring line, not merely tolerated; the 3rd line wants a Two-Way/Defensive/Grinder mix; the 4th line specifically wants \"Forechecker / Grinder\" and \"Defensive Forward\" types — a true checking/energy unit, not a watered-down scoring line. D pairs mirror real usage: the top pair stays flexible (it's already rewarded for an offense/defense mix by Role Fit above), the 2nd pair wants a defensive lean, and the 3rd pair specifically favors a genuine \"Stay-at-Home Defenceman\" over a merely \"Defensive Defenceman\" (only half credit) — so it reads as meaningfully MORE defensive than the 2nd pair, not just similarly defensive. A line with no classifiable personnel (not enough ratings on file) is scored neutrally on this piece rather than penalized.",
        "That system-fit piece is what makes Tactical Fit respond to Tactics: a line stacked with players who individually suit your chosen system (fast finishers on a Rush team, strong passers on a Cycle team) scores higher than an identically role-balanced line that doesn't — and a club running the default Balanced system sees no change from this piece at all (System Fit is neutral, ×1.0), so Tactical Fit reduces to Role Fit × position/handedness × Depth-Chart Archetype Fit until you actually touch the Tactics page.",
        "Tactical Fit is a planning/display number, not itself what the sim engine charges each game: it only feeds the PROJECTED starting chemistry a freshly formed or just-reshuffled bond opens at (a well-built, well-fitting line projects a warmer starting chemistry before it has any shared-ice history) — see \"proj\" above. The real in-game structural penalty on an off-role unit's offensive output comes from Role Fit alone, applied directly by the sim; System Fit's real in-game effect is separate too, applied at the whole-ROSTER level (not per line) to scale your team system's actual bonuses and costs during simulated games, as described above. Depth-Chart Archetype Fit, like position/handedness correctness, only feeds the projected starting chemistry — it isn't a separate in-game penalty of its own.",
      ] },
    ],
  },
  {
    id: "predictor", title: "17 · Predictor League & Rewards",
    intro: "The UNHL Predictor competition combines daily NHL Game Picks and Season-Long Predictions with tangible club rewards.",
    groups: [
      { h: "Daily Games & Game of the Week", points: [
        "Daily Games (2 points per correct pick): every game night features official NHL games. Tip the 60-minute regulation result (1 - Home Win, X - Draw/OT/SO, 2 - Away Win) to earn 2 points (or 6 points with Joker ×3).",
        "Game of the Week (up to 15 points): one marquee clash each week. Regulation result 1-X-2 (2b), Exact score (5b), First goal scorer (5b), and Player with most points in game (3b). With Joker activated: up to 45 points.",
        "5 Jokers per season: can be deployed on any game to multiply all points earned from that game ×3.",
        "Streaks: winning streaks award bonus points (3 in a row = +2b, 5 in a row = +5b, 10 in a row = +15b).",
      ] },
      { h: "Weekly & Monthly Rewards", points: [
        "Weekly Game Picks Winner: The top predictor of each NHL week receives a +$200,000 cash injection into the team bank account.",
        "Monthly Champions: The top predictor in each calendar month (October through April) receives a bonus Entry Draft Pick in the 8th round (or 9th round if 32 capacity is reached), +10 bonus Season Points, and a 🥇 Monthly Champion badge.",
      ] },
      { h: "End-of-Season Prizes & Draft Picks", points: [
        "1st Place (Season Champion): +$3,000,000 to club bank, bonus Entry Draft Pick in the 8th round (or 9th round if the 8th round is full with 32 picks), and 🥇 Season Predictor Champion gold profile badge.",
        "2nd Place: +$1,500,000 to club bank, bonus Entry Draft Pick in the 8th round (or 9th round if full), and 🥈 Silver profile badge.",
        "3rd Place: +$750,000 to club bank, bonus Entry Draft Pick in the 8th round (or 9th round if full), and 🥉 Bronze profile badge.",
        "Draft Pick Allocation Rule: All bonus draft picks won through the predictor competition (Season Top 3 & Monthly Champions) are placed into the 8th round of the Entry Draft. In case the 8th round has already reached its 32-team capacity, picks automatically slide into the 9th round.",
      ] },
    ],
  },
];

// ---- Czech rulebook (shown when the site language is Czech) ------------------
const SECTIONS_CS: Sec[] = [
  {
    id: "season", title: "1 · Sezóna a simulace",
    intro: "Liga hraje reálný rozpis NHL a komisař ji simuluje den po dni.",
    groups: [
      { points: [
        "Základní část používá skutečný rozpis NHL (~84 zápasů na tým). Zápasy se hrají po jednom dni ze stránky Schedule (Sim Next Day). Aktuální den je zvýrazněný a tlačítko Sim zůstává připnuté nahoře.",
        "Každý zápas rozhoduje engine řízený událostmi: střely, kvalita střel (očekávané góly podle zóny kluziště), kvalita brankáře, přesilovky a oslabení, chemie linek, trénink, únava a náhodné výkyvy formy „každý večer je jiný“ — odtud pramení překvapení.",
        "Výsledky jsou reprodukovatelné: stejný zápas se odsimuluje stejně. Opětovná simulace zápasu nebo přegenerování rozpisu jej přehodí (nový los). Každá simulace se zapisuje do Audit Logu (kdo/kdy/seed); re-simulace je označena.",
        "Rozptyl zápasů (Game Variance) může nastavit komisař (výchozí ~108 %). Vyšší = divočejší večery; nižší = těsnější výsledky podle papíru.",
      ] },
    ],
  },
  {
    id: "rosters", title: "2 · Soupisky a farma",
    groups: [
      { h: "Aktivní soupiska", points: [
        "Legální sestava nastupuje s 12 útočníky, 6 obránci a 2 brankáři. Na NHL soupisce může být až 23 hráčů.",
        "Pokud má klub méně než 12Ú / 6O / 2B, simulace před dalším zápasem povolá nejlepší dostupné hráče z farmy na NHL soupisku — trvale (počítají se do stropu a zůstanou, dokud je nepošlete dolů).",
      ] },
      { h: "AHL farma", points: [
        "Každý NHL klub má AHL afilaci. Rozpis AHL kopíruje rozpis NHL (afilace se potkají, když se potkají jejich mateřské kluby).",
        "AHL soupisky spravuje GM mateřského klubu přes svůj login. Farmářsky způsobilí jsou hráči se stropem pod ~775 tis. $.",
        "Když povolání do NHL nechají farmu bez legální sestavy, farma automaticky aktivuje vlastní zdravé škrtnuté (scratch) hráče, aby se její zápasy odsimulovaly.",
      ] },
    ],
  },
  {
    id: "con", title: "3 · Kondice (CON), únava a zranění",
    groups: [
      { h: "Kondice", points: [
        "Každý hráč má hodnotu CON (0–100). Klesá tím, jak hraje, a obnovuje se ve dnech volna (bruslaři i brankáři ~+1–2 za den volna). CON je vidět na soupisce; zranění hráči ukazují živou desetinnou hodnotu.",
        "Bruslař musí mít CON ≥ 95, aby mohl nastoupit — pod touto hranicí je stále zraněný nebo rozházený a sedí.",
      ] },
      { h: "Zranění", points: [
        "Zranění pramení z fyzické hry: tvrdé hity, zblokované střely, bitky a bezkontaktní úrazy. Tvrdý, důrazný soupeř vám zraní více hráčů.",
        "Četnost je nastavena na ~1 zranění na ~5–6 zápasů na tým. Většina je den-ode-dne (1–6 dní); některá jsou týden-od-týdne; dlouhodobá zranění a konec sezony jsou vzácná.",
        "Hráč se nemůže zranit dvakrát v jednom zápase. Zranění se hojí o jeden den za každý uplynulý den, ať už postupujete den po dni nebo necháte tým odpočívat. Seznam zraněných každého týmu je na jeho stránce (Injury Report).",
      ] },
    ],
  },
  {
    id: "goalies", title: "4 · Brankáři",
    groups: [
      { points: [
        "Automatická rotace: brankář musí mít v den zápasu CON ≥ 98, aby chytal. Pokud jeho CON klesl pod tuto hranici, dostane branku svěžejší brankář — takže žádná jednička není udřená. (Jsou-li oba pod hranicí, chytá stejně ten nejsvěžejší.)",
        "Chytání ve dvou zápasech po sobě činí brankářův večer nevyzpytatelnějším (větší výkyvy). Brankáři si CON obnovují ve dnech volna.",
        "Forma brankáře na daný večer (v pohodě / mimo) ovlivní celý zápas — chytající gólman krade výhry, mimoformový dostane naloženo.",
        "Pravidlo hodného brankáře: každý klub musí mít před začátkem sezony na NHL soupisce alespoň jednoho brankáře, který má buď hodnocení 72 OV nebo vyšší, odchytal 35+ reálných zápasů v minulé sezoně, nebo odchytal více než 15 reálných zápasů s úspěšností zákroků nad 90 % — brankář s prokázanou reálnou formou se počítá, i když jeho OV v lize tomu ještě neodpovídá. Klub bez kvalifikovaného brankáře (trejd, sestup na farmu) dostane varování ve své sekci Brankáři, při stavbě trejdu a na komisařském Dashboardu v předletové kontrole — stačí podepsat, vytrejdovat nebo povolat kvalifikovaného brankáře. Brankář, který splňuje podmínku, je označen zeleně.",
      ] },
    ],
  },
  {
    id: "stats", title: "5 · Statistiky",
    groups: [
      { points: [
        "Statistiky sezony jsou rozdělené na bloky NHL a AHL, každý se základní částí a play-off. Hráč, který nastoupí v obou ligách, ukazuje obojí.",
        "Kariéra počítá pouze NHL (AHL je zvlášť pod Player Stats).",
        "Game Log (na hráče, NHL) vypisuje každý zápas: soupeře, výsledek a kompletní bodovou řádku — klikněte na řádek pro box score.",
        "Plus/Minus se řídí reálným pravidlem: počítají se góly v plné síle A v oslabení (střelec a jeho spoluhráči na ledě dostanou +1, inkasující strana −1). Góly v přesilovce se nepočítají.",
        "U každého gólu se zaznamenává, kdo byl na ledě pro a proti (zobrazeno v play-by-play box score).",
        "Žebříčky (SV %, GAA, Edge, pokročilé) používají minimální vzorek, který roste, jak sezona zraje, takže lídři se ukazují už od prvních zápasů.",
      ] },
    ],
  },
  {
    id: "cap", title: "6 · Platový strop a finance",
    groups: [
      { points: [
        "Každý klub musí zůstat pod platovým stropem. Strop a jeho spodní hranici nastavuje komisař (hodnoty profinhl nebo reálné NHL).",
        "V mezisezoně má strop +10% rezervu; v den startu platí přísný strop a nevyhovující kluby dostanou veřejné varování a musí snížit platy.",
        "LTIR: hráč odložený na dlouhodobou marodku jde ze stropu ven. Odkupy (buyouts) a zadržený plat se evidují v účetnictví klubu.",
      ] },
      { h: "Odkupy smluv (buyouts)", points: [
        "Odkoupit lze libovolného hráče na NHL soupisce s aktivní smlouvou. Roční dead cap je 66 % jeho aktuálního cap hitu během základní části nebo play-off a 33 % během mimosezóny, Free Agent Frenzy nebo přípravy, zaokrouhlených na nejbližších 500 $.",
        "Tato roční částka se počítá do stropu po dobu dvojnásobku zbývajících let smlouvy (např. 4 zbývající roky → 8 let dead capu). Buyout nikdy nestrhává hotovost z bankovního účtu klubu.",
        "Odkoupený hráč se ihned stává UFA a přichází o kapitánskou pásku. Neexistuje věková sleva (na rozdíl od reálné NHL, kde se rozlišuje věk pod/nad 26 let), žádná ochrana klauzulemi NTC/NMC ani sezónní uzávěrka — mění se pouze cena podle toho, zda probíhá sezóna, nebo ne.",
        "Veřejný Buyout Calculator používá úplně stejný výpočet jako skutečné tlačítko Buy out. Ve výběru jsou všichni hráči NHL i AHL/farmy s aktivní smlouvou a platem nad 100 000 $, takže lze otestovat také farmářské smlouvy.",
      ] },
      { h: "Trenérské smlouvy a odkupy", points: [
        "Každý klub má jednoho hlavního trenéra. Jeho plat a délka smlouvy (max. 4 roky) se určují automaticky podle jeho celkového hodnocení — GM podmínky trenéra nevyjednává, jen rozhoduje, zda ho podepíše. Trenérský plat se nepočítá do platového stropu, ale stejně jako každý jiný klubový výdaj ubírá z bankovního účtu.",
        "Propuštění trenéra znamená okamžité vyplacení CELÉ zbývající smlouvy (plat × zbývající roky) z bankovního účtu klubu, najednou — bez věkové ani sezónní slevy, bez poměrného krácení za odsloužené roky. Trenér se ihned vrací do volného trenérského poolu a může ho znovu podepsat kterýkoli klub, včetně toho, co ho propustil, za novou smlouvu odpovídající jeho hodnocení.",
      ] },
    ],
  },
  {
    id: "fa", title: "7 · Volní hráči (Free Agency)",
    intro: "Jak a kdy můžete podepsat volné hráče, závisí na fázi roku.",
    groups: [
      { h: "Mezisezona — Free Agent Frenzy", points: [
        "Frenzy má tři kola. V každém mají všichni GM 4 dny na první nabídky (peníze + délka + role + speciální formace), potom následují 2 dny na zlepšení pro kluby, které postoupily.",
        "Po dvoudenní fázi Agent vyhodnotí aktuální nabídky. Nepodepsaní hráči se ihned vrátí do dalšího kola s nižšími požadavky.",
        "Po 3. kole přejdou zbývající UFA na průběžný trh: první nabídka otevře 24 hodin; pokud se přidá další klub, stávající zájemci dostanou posledních 24 hodin na zlepšení.",
        "Obousměrná vs jednosměrná smlouva, udělené klauzule o nevyměnitelnosti (sleva) i délka smlouvy formují jeho požadavek.",
      ] },
      { h: "Základní část — otevřený trh", points: [
        "Otevření jsou jak vaši vlastní UFA, tak volný trh. Hráči, kteří zůstali po Frenzy, pokračují v systému 24hodinových oken.",
        "Nepodepsaný volný hráč zmírňuje své požadavky, čím dál je sezona (nikdo nebere) — až zhruba o −45 % v pozdní části roku.",
      ] },
      { h: "Play-off", points: [
        "Můžete prodloužit VLASTNÍ končící UFA (okamžitě), ale volný trh je zavřený.",
      ] },
      { h: "Obousměrné smlouvy — kdo takovou vůbec podepíše", points: [
        "Žádné reálné zápasy v NHL minulou sezonu (čistě farmářský hráč): vezme obousměrnou smlouvu až na 3 roky, v jakémkoliv kole.",
        "Pár zápasů v NHL, ale ne dost na to, aby se počítal za zavedeného: až na 2 roky, v jakémkoliv kole.",
        "Zavedený hráč NHL (jasně za hranicí „prospekta“) obousměrnou smlouvu odmítne rovnou — LEDAŽE by o něj trh úplně vychladl (v 1. kole nedostal žádnou nabídku); pak ho může obměkčit jedna ze dvou věcí, vždy jen na 1 rok „na zkoušku“: je starší (nad věkovou hranicí ligy) a povolí od 2. kola; nebo není starší, ale hodnotově patří spíš do 4. lajny a povolí od 3. kola. Opravdu dobrý zavedený hráč odmítá obousměrnou smlouvu bez ohledu na to, kolik kol uplyne — nabídněte mu radši jednosměrnou.",
      ] },
    ],
  },
  {
    id: "rfa", title: "8 · Prodlužování vlastních hráčů — UFA a RFA",
    intro: "Vše o prodlužování jednoho z VLASTNÍCH končících hráčů: jak Agent vyjednává, co je kvalifikační nabídka, arbitráž, nabídkové listiny, franšízový tag a co hýbe cenou hráče. Začněte na Finance & Contracts → Team Contracts.",
    groups: [
      { h: "Základy", points: [
        "Nejdelší one-way smlouva je na 4 sezóny; obousměrná (two-way) nejvýš na 2 sezóny (a podepíšou ji jen ochotní hráči — viz pravidla two-way v části o volných hráčích).",
        "Prostor pod stropem na další sezónu najdete na stránce svého týmu pod Finance & Contracts → Salary Cap. Hráče, kterým po sezóně končí smlouva, pod Finance & Contracts → Team Contracts.",
        "Nikoho prodlužovat nemusíte. UFA, kterého necháte být, po sezóně prostě odejde na trh. RFA, kterého necháte být, vám zůstane jen tak dlouho, dokud platí pravidla kvalifikační nabídky níže.",
      ] },
      { h: "Kdo je UFA a kdo RFA", points: [
        "O jeho statusu rozhoduje věk k 30. červnu roku, kdy vyprší jeho SOUČASNÁ smlouva — ne jeho věk dnes. 27 let a víc = nechráněný; mladší = chráněný.",
        "(Liga může místo toho jet „jednoduchý“ systém volných hráčů, kde všichni testují otevřený trh — žádná práva RFA, tagy ani nabídkové listiny. Nastavuje komisař.)",
      ] },
      { h: "Kdy můžete vyjednávat", points: [
        "Kdykoliv, když je v posledním roce smlouvy nebo mu už vypršela — kromě období Free Agent Frenzy (otevřený trh má vlastní systém) a prvních dní nové základní části (okno nastavuje komisař, dává soupiskám čas se usadit; komisař může jeden konkrétní klub z tohoto okna výjimečně vyjmout, např. kvůli testování).",
      ] },
      { h: "Krok 1 — jeho požadavek", points: [
        "Když zahájíte jednání, hráč přednese svůj požadavek: přibližný cap hit a preferovanou délku, ukázané jako rozmezí (například: hledá zhruba 3,40–4,04 M / 3 roky). Políčka plat a délka jsou na začátku prázdná — své hodnoty zadáváte vy.",
        "Cena závisí na délce. Hráč do zhruba 33–34 let chce za jeden rok MÉNĚ než za čtyři (Quinn Hughes bude chtít na jednoletý kontrakt méně než na čtyřletý). Starší hráč jde opačně — Alex Killorn chce na jeden rok VÍC a na tři méně. Všechna čísla jsou cap hity.",
        "Vidíte vždy jen rozmezí u JEHO preferované délky. Jeho přesný požadavek u jiné délky zůstává skrytý, takže musíte hledat.",
      ] },
      { h: "Krok 2 — vaše nabídka a jeho reakce (jinak než v realitě)", points: [
        "Příklad (vymyšlený): Cutter Gauthier má skryté požadavky 10 M na 1 rok, 11 M na 2, 12 M na 3 a 13 M na 4. Vy vidíte jen zhruba 11,55–12,5 M na jeho preferované 3 roky. Chcete ho na 4, tak nabídnete 4 roky — jeho skutečný požadavek tam (13 M) zůstane skrytý.",
        "V realitě by klub podal nízkou protinabídku a sešli by se uprostřed. Tady má páku HRÁČ: podstřelíte-li jeho požadavek o příliš mnoho, uráží se — jeho další požadavek jde NAHORU (13 M se může změnit zhruba na 14,5 M).",
        "Kolik můžete podstřelit, závisí na jeho cenovém pásmu: pod 3 M ≈ 33 %, 3–5 M ≈ 25 %, 5–10 M ≈ 20 %, 10–15 M ≈ 15 %, 15 M+ ≈ 10 %. Při požadavku 13 M ho urazí nabídka zhruba 11,05 M a méně.",
        "Urážka se u vašeho klubu pamatuje (zhruba 200 dní) a sčítá se: první protinabídka po urážce už ukazuje zvýšené rozmezí, prostor je zhruba na dvě urážky a po DVOU přijme jen svůj plný požadavek. V posledním kole jmenuje přesné minimum, za které podepíše.",
        "Je-li vaše nabídka pod jeho požadavkem, ale NEJDE o urážku, odmítne ji bez zvýšení — jen vám řekne, že nestačí.",
        "Hráči, kteří chtějí méně, obvykle slevíte zhruba 250 000; dražší až kolem 500 000. Jak to při jednání využijete, je na vás.",
      ] },
      { h: "Kolik nabídek máte", points: [
        "UFA: až 3 nabídky. Po každé buď přijme, nebo odmítne a řekne proč (a zvýší požadavek, pokud jste podstřelili). Po 3. odmítnutí oznámí, že po sezóně otestuje trh, a už ho prodloužit nemůžete.",
        "RFA (bez tagu): 2 nabídky. Odmítne-li protinabídku po 2., jednání se zatím zastaví — čeká na nabídkový list od soupeře.",
        "RFA s vaším franšízovým tagem: 3 nabídky (o kolo navíc); před nabídkovými listinami je chráněný, dokud kola nevyčerpáte.",
        "RFA, kterého nikdo neodvedl nabídkovým listem, se vrací rovnou k vám: odtud vyjednáváte napřímo, nabídku za nabídkou, bez limitu kol a bez druhé cesty na nabídkové listiny.",
      ] },
      { h: "Kvalifikační nabídka (QO) — jen RFA", points: [
        "Každý RFA má na RFA Central kvalifikační nabídku: běžně 100 % jeho současného AAV a nejméně ligové minimum (obojí nastavuje komisař). Předložte ji do termínu (25. června), abyste si udrželi jeho omezená práva.",
        "QO se předloží automaticky ve chvíli, kdy s ním začnete jednat — klub, který už s hráčem mluví, o něj nemůže přijít kvůli zmeškanému termínu. Týden před termínem navíc dostanete připomínku (DM a banner na Team Contracts) se seznamem všech RFA bez QO.",
        "QO je také to, co hráče zpřístupní nabídkovým listinám: bez ní žádný dostat nemůže.",
        "Zmeškáte-li termín bez QO a bez jednání, hráč se uvolní: stane se UFA — i ve 26 letech a méně.",
        "Běžné prodloužení (Re-sign) je vždy k dispozici a okamžitě uzavře jakýkoli případ QO či arbitráže. Arbitráž není nikdy nutná jen k prodloužení RFA.",
      ] },
      { h: "Platová arbitráž — jen RFA", points: [
        "Oprávněnost: věk 24+ NEBO 40+ zápasů v NHL v minulé sezóně (nastavuje komisař). Klub i hráč mohou podat, jakmile je předložena QO. Dokud je případ arbitráže otevřený, běžné nabídky na prodloužení jsou zablokované.",
        "Rozhodce porovná šest podobných hráčů (stejný post, podobný rating a věk) a stanoví pásmo: 80–120 % jejich mediánu cap hitu, nikdy ne pod QO. Návrhy klubu a hráče jsou ve výchozím stavu spodek a vrchol pásma.",
        "Verdikt přijde automaticky 48 hodin po podání (komisař ho může vydat dřív). Plat je střed obou návrhů uvnitř pásma.",
        "Délku (1 nebo 2 roky) volí strana, která arbitráž NEPODALA: podal-li klub, vybírá hráč (1 rok); podal-li hráč, vybírá klub (2 roky — 1 rok, pokud jde o plat s právem odejít).",
        "Two-way verdikt vyplácí plný plat i na farmě — nikdy se nepočítá do salary capu, jen do Finance. Two-way není možná od 1,3 M výše ani u zavedeného hráče NHL (180+ zápasů za 3 sezóny, 60+ za minulou, bez waiverů).",
        "Pod 4,5 M klub verdikt přijmout musí. Od 4,5 M výše může odejít a hráč se stane UFA. Nová smlouva ZAČNE, až vyprší jeho současná — verdikt vydaný během sezóny nikdy nemění letošní plat ani cap hit.",
      ] },
      { h: "Nabídkové listiny (jen RFA)", points: [
        "Otevřené 1.–8. července mimosezóny; vyřešeny 10. července. Kompenzační žebříček (vlastní originální draftové volby starého klubu, podle pásma AAV) nastavuje komisař a platí ho lákající klub, pokud hráč podepíše.",
        "Jeho AI vybere jedinou nejlepší listinu, která zároveň splňuje jeho požadavek A překonává VAŠI poslední stojící nabídku — neexistuje starý NHL „právo dorovnat“, takže číslo vaší vlastní nabídky je to, co musí útočník skutečně překonat.",
      ] },
      { h: "Franšízový tag", points: [
        "Jeden na klub, jen hráči ve věku RFA. Tag vám dává 3. nabídku a chrání hráče před nabídkovými listinami po dobu těchto kol. Skončí-li bez dohody, stane se dostupným nabídkovým listinám jako každý jiný RFA (tag zmizí, pokud ho soupeř podepíše); nikdo-li ho nepodepíše, vyjednáváte s ním dál napřímo.",
      ] },
      { h: "Uvolnění práv místo prodloužení", points: [
        "„Release rights“ na stránce Team Contracts (jen u RFA) prohlašuje, že hráče neprodloužíte: od té chvíle se oceňuje a chová jako UFA — žádná sleva RFA, žádný strop — a v okamžiku vypršení smlouvy padá rovnou na otevřený trh, místo aby zůstal vázaný na vás. Vratné kdykoliv, dokud mu smlouva skutečně nevyprší.",
      ] },
      { h: "Co ovlivňuje jeho cenu", points: [
        "Urážka podhozenou nabídkou: podstřelíte-li jeho skutečné minimum o příliš mnoho (klouzavá hranice — zhruba třetina u skromné smlouvy, až kolem desetiny u smlouvy 15M$+), zapamatuje si to — jeho požadavek konkrétně vůči VAŠEMU klubu stoupá, s prostorem zhruba pro dvě takové urážky, než narazí na strop (nikdy pod komisařovým vlastním minimem 25 %, u levné smlouvy i víc). Ostatní kluby to neovlivní. Urazíte-li ho dvakrát, peníze za floor přestanou stačit — od té chvíle je to jen jeho plný ask, nebo nic.",
        "Cena podle délky: jeho hlavní číslo je kalibrované na jeho preferovanou délku. Nabídnete-li víc nebo míň let, cena se ohne — obvykle nahoru za víc let, dolů za míň — KROMĚ hráče ve věku 35+, u kterého je to naopak: delší smlouva stojí za rok MÉNĚ (klubu přátelské prodloužení ve stylu reálné NHL), zatímco krátký rok „ještě jednou to zkusit“ je jeho nejdražší požadavek.",
        "Slíbíte-li mu horší roli, než chce, účtuje si prémii a bere kratší smlouvu — a klauzule o nevyměnitelnosti mu už nepřináší slevu, protože chce zůstat volný odejít, pokud mu roli nedodáte.",
        "Síla týmu: starší hráči hledají vítěze. Od 32 let může contender dostat slevu až zhruba 7,5 % z požadavku, rebuildující klub naopak zaplatí příplatek až zhruba 12,5 %. U hráčů do 23 let to skoro nehraje roli (kolem 1 %). Jak silný tým máte, najdete v League → Fan Interest.",
        "Role: cena zobrazená v Demand Watch i v okně prodloužení už počítá s lajnou a speciálními týmy, do kterých se promítá. Slíbíte-li MENŠÍ roli (každá lajna pod jeho očekáváním přidá zhruba 11 %, až zhruba 38 %; chtěné PP/PK, které nedostane, přidá dál), požadavek roste. Slíbíte-li VĚTŠÍ roli, než čeká, cena NEKLESNE — sníží ji jen udělená klauzule zákazu výměny.",
        "Aktivita v trejdech: agenti si pamatují, že podepisujete volné hráče a do roka je měníte, a mohou zvýšit požadavky vašich budoucích podpisů. Dívá se zhruba 270 dní zpět a počítá jen hráče podepsané na volném trhu — nikdy ty, které jste prodloužili.",
        "Splněné sliby: slíbíte 2. lajnu a PP, ale pak ho nasadíte ve 3. lajně bez PP, a agent si to pamatuje — ostatní hráči u vašeho klubu chtějí víc.",
        "Morálka: spokojený hráč dá slevu (u hvězdy až zhruba 12 %), nešťastný chce příplatek (až zhruba 16 %). Lepší hráči se nechají ovlivnit víc, slabší skoro vůbec.",
      ] },
      { h: "Nováčci (ELC smlouvy)", points: [
        "Když některý z vašich prospektů (v realitě) odehraje potřebné minimum zápasů, na další sezónu naskočí do sestavy s automatickým platem podle toho, jak hrál ve své první sezóně v NHL/AHL. Neovlivníte to.",
      ] },
    ],
  },
  {
    id: "contracts", title: "9 · Smlouvy a klauzule",
    groups: [
      { points: [
        "Každá smlouva má cap hit a délku (roky). Obousměrná smlouva má dva platy: nabídnutý plat pro NHL a pevný plat 100 000 $ pro AHL. NHL plat se počítá do stropu jen tehdy, když je hráč na soupisce NHL; na farmě klub platí AHL plat a hráč nemá NHL cap hit.",
        "Stávající farmářské smlouvy podepsané před zavedením samostatného AHL platu si na farmě ponechávají původní uvedený plat. Pevných 100 000 $ pro AHL platí jen pro nové obousměrné smlouvy, které tento plat výslovně obsahují.",
        "Hráče se starou farmářskou smlouvou 100 000 $ nelze povolat do NHL. Jeho GM mu může přes Offer 2-way u hráče v AHL části Team Roster nabídnout NHL plat a délku; Agent použije stejná pravidla věku, zkušeností z NHL, délky a platu jako u ostatních obousměrných nabídek. Po přijetí lze hráče povolat.",
      ] },
      { h: "NTC vs. NMC vs. modifikovaná NTC — co která opravdu chrání", points: [
        "NTC (no-trade clause) — blokuje JAKOUKOLIV výměnu bez hráčova souhlasu. Na waivery ho ale poslat můžete.",
        "NMC (no-movement clause) — plná ochrana: blokuje výměnu I waivery. Nejsilnější, a podle toho i oceněná (viz níže).",
        "Modifikovaná NTC — hráč jmenuje seznam 6, 12, 18 nebo 24 týmů; výměna ke klubu, který na seznamu NENÍ, souhlas vůbec nepotřebuje. Delší seznam stojí klub při podpisu víc.",
      ] },
      { h: "Udělení klauzule: sleva při podpisu", points: [
        "Hráč vezme za tu jistotu o něco méně peněz: NMC ≈ sleva 8 %, NTC ≈ sleva 5 %, modifikovaná NTC se odvíjí od délky seznamu (6 týmů se skoro nepozná, 24 týmů má pro něj skoro stejnou cenu jako plná NTC).",
      ] },
      { h: "Výměna chráněného hráče: poplatek agentovi", points: [
        "Klub, co chráněného hráče vyměňuje, potřebuje jeho souhlas — rozhoduje se automaticky porovnáním nové situace (role + síla týmu) s tou starou, a stojí to reálné peníze z rozpočtu VYMĚŇUJÍCÍHO klubu navíc k jeho platu:",
        [
          "Jasné zlepšení (lepší role a/nebo silnější tým) — souhlasí zdarma.",
          "Boční přesun — symbolický poplatek ~15 % ze zbývajícího platu (cap hit × zbývající roky).",
          "Zhoršení — poplatek roste podle toho, o kolik je to horší, klidně přes 20 %.",
          "Jasné zhoršení — chce vyplatit CELÝ zbývající plat, aby souhlasil.",
          "NMC přidává dalších +25 procentních bodů navíc k výpočtu NTC/zhoršení — nejsilnější klauzule se hýbe nejhůř (a nejdráž).",
          "Modifikovaná NTC je jednodušší: zdarma, pokud cíl není na seznamu; celý zbývající plat, pokud je.",
        ],
      ] },
    ],
  },
  {
    id: "trades", title: "10 · Výměny (trejdy)",
    groups: [
      { points: [
        "Výměny stavíte v Trade Builderu (hráči, prospekti a volby v draftu). Můžete ji spustit rovnou z chatu s GM přes „Propose trade“.",
        "Zadržení platu je podporováno. Klauzule o nevyměnitelnosti / nehnutelnosti se musí respektovat — chráněný hráč musí souhlasit.",
        "Podle nastavení ligy mohou výměny vyžadovat schválení komisařem. Každá výměna se loguje.",
      ] },
      { h: "Limity zadržování platu", points: [
        "Klub má ligou nastavený celkový počet retenčních „slotů“ (výchozí 3) — JEDEN společný pool smluv, u kterých zadržuje plat (platí mrtvé peníze) PLUS hráčů se zadrženým platem, které má na soupisce (akvizice, na které přispívá jiný klub) — ne dva oddělené limity. Získání hráče, který už zadržený plat nese z dřívější výměny, spotřebuje slot také, i když tato výměna žádné nové zadržení nepřidává.",
        "Součet zadrženého platu, na kterém se klub podílí (obě strany dohromady), nesmí přesáhnout ligou nastavené % stropu (výchozí 10 %) — v Trade Builderu ukázáno jako „Retention % of cap“.",
        "Oba limity se počítají proti tomu, co klub už nese, PLUS co by výměna přidala — ne proti samotné výměně izolovaně — a výměnu, která by kterýkoliv klub posunula přes kterýkoliv limit, systém odmítne. Trade Builder stejná čísla ukazuje živě ještě před odesláním nabídky.",
      ] },
    ],
  },
  {
    id: "waivers", title: "11 · Waivery",
    groups: [
      { h: "Kdo musí projít waivery", points: [
        "Waivery může komisař zapnout nebo vypnout.",
        "Výjimka z waiverů: hráč na ELC nebo dvoucestné (two-way) smlouvě jde na farmu rovnou, waivery nepotřebuje.",
        "Jednocestný / veteránský hráč musí nejdřív projít wire — roster mover přímé zakopání na farmu zablokuje a odkáže tě na Waiver Wire.",
        "Strop nad 1,5M $ momentálně nejde na waivery poslat vůbec — příliš cenný hráč na to, aby takhle reálně propadl na farmu (limit, který může komisař upravit).",
        "NMC blokuje waivery úplně; NTC ne.",
      ] },
      { h: "Návratová výjimka (pravidlo 30/10)", points: [
        "Povolání hráče z AHL mu na čas otevře výjimku: může jít zpátky na farmu bez nového vystavení na waivery, pokud od toho povolání uplynulo 30 dní nebo méně a odehrál 10 zápasů v NHL nebo méně.",
        "Jakmile překročí jeden z limitů — svůj 11. zápas v NHL od povolání, nebo 31. den nahoře — výjimka propadne. Další cesta na farmu už musí projít Waiver Wire jako u každého jiného jednocestného hráče.",
        "Nové povolání vždy nastartuje úplně novou výjimku, i pro hráče, co už jednu dřív v sezoně vyčerpal.",
      ] },
      { h: "Jednodenní okno", points: [
        "Vystaveného hráče může kterýkoliv klub nárokovat během jednodenního okna.",
        "Vystavení na waivery je definitivní — žádné stažení zpět. Jakmile je hráč na wire, klub ho už nemůže vzít zpět, ať nárok padne nebo ne.",
        "Nenárokovaný hráč po uzavření okna propadne do AHL afiliace klubu, který ho vystavil.",
      ] },
      { h: "Víc nároků najednou — kdo ho dostane", points: [
        "Základní část / play-off: rozhoduje obrácené pořadí tabulky — dostane ho nejhorší tým v lize.",
        "Mezisezona, Frenzy, přípravka (tabulka ještě nic neznamená): místo toho pořadová fronta nároků — hráče dostane klub, který nejdéle nevyhrál žádný souběžný nárok (při shodě rozhoduje, kdo nárokoval první), a vítěz se pak přesune na konec fronty pro příště. Klub, co právě vyhrál nárok, tak nevyhraje ten další souběžný, i kdyby nárokoval první — klub, co nikdy nenárokoval (nebo nejdéle), frontu přeskočí.",
      ] },
    ],
  },
  {
    id: "draft", title: "12 · Vstupní draft",
    groups: [
      { points: [
        "Pořadí draftu se řídí obráceným pořadím tabulky, s ověřitelnou loterií ve stylu NHL (14 míčků / 1001 kombinací) pro nejvyšší volby.",
        "Draft Room podporuje živé draftování, ruční řízení fází, admin bonusová kola a volby mimo seznam (off-board). Reálná draftová třída NHL se importuje pro aktuální ročník.",
      ] },
    ],
  },
  {
    id: "awards", title: "13 · Ocenění",
    groups: [
      { points: [
        "Statistické trofeje (produktivita, výhry atd.) se udělují automaticky. Zbytek (Hart, Norris, Vezina, Calder, Selke a další) rozhoduje hlasování GM; kluby bez lidského GM odevzdají hlasování řízené statistikami (AI).",
        "Historie sezon, rekordy a týmová síň trofejí jsou pod History / League.",
      ] },
    ],
  },
  {
    id: "messages", title: "14 · Zprávy",
    groups: [
      { points: [
        "GM si mohou psát přímé zprávy ze záložky Messages — historie chatu, emoji, potvrzení doručeno ✓ / přečteno ✓✓ a tlačítko Propose trade, které otevře Trade Builder proti danému GM. Odznak upozorní na nové zprávy.",
      ] },
    ],
  },
  {
    id: "attributes", title: "15 · Atributy hráčů a brankářů",
    intro: "Každý hráč i brankář má sadu atributů ve stylu STHS (zhruba 20–99). Přesně tyto hodnoty čte simulační engine každý zápas — zde je, co která dělá.",
    groups: [
      { h: "Bruslaři", points: [
        "SC — Scoring (střelba): hlavní faktor střelecké/zakončovací síly hráče. Nejvíc rozhoduje o tom, kdo dává góly.",
        "PA — Passing (přihrávky): hlavní faktor tvořivosti. Nejvíc rozhoduje o tom, kdo sbírá asistence, a zda přihrávka pod tlakem projde, nebo je zachycena.",
        "PH — Puckhandling (vedení puku): přispívá jak ke střelbě, tak k přihrávkám, a záleží na něm i při vjezdech do útočného pásma a ochraně puku.",
        "SK — Skating (bruslení): přispívá trochu ke střelbě, přihrávkám i obraně a zmírňuje, jak moc se projeví únava během střídání.",
        "DF — Defense (obrana): hlavní atribut, který snižuje kvalitu soupeřových šancí. Je to i hlavní statistika pro blokování střel a přerušení přihrávky.",
        "CK — Checking (bodyčeky): řídí četnost hitů hráče a přispívá k jeho obraně. Fyzičtější, tvrději hrající tým způsobí soupeři víc zranění.",
        "ST — Strength (síla): přispívá k obraně, hitům a blokování střel. Nejvíc se projeví v soubojích u mantinelu a před brankou.",
        "FO — Faceoffs (vhazování): přímá úspěšnost na buly — kdo začíná střídání s pukem.",
        "DI — Discipline (disciplína): vyšší hodnota znamená méně vyloučení.",
        "FG — Fighting (rvačky): rozhoduje, kdo se pustí do bitky a kdo ji vyhraje. Na žádnou jinou herní statistiku nemá vliv.",
        "PS — Penalty Shot (nájezdy): úspěšnost v nájezdech / trestných střílení a zároveň část hráčova hodnocení „clutch“ (viz níže).",
        "EX — Experience (zkušenost): jednoznačně největší složka hráčova „clutch“ hodnocení — klid v koncovce třetí třetiny nebo v prodloužení.",
        "LD — Leadership (vedení kabiny): zbytek clutch hodnocení, a zároveň tlumí výkyv momenta týmu hned po obdrženém gólu.",
        "MO — Morale (nálada): na rozdíl od ostatních jde o živou hodnotu 1–100, která se mění podle výher, ledového času a produktivity a ovlivňuje výkon zápas od zápasu, místo aby byla pevná.",
        "DU — Durability (odolnost): snižuje riziko a závažnost zranění a to, jak moc je penalizovaný ještě se zotavující hráč (nízké CON), než je zpátky na 100 %.",
        "EN — Endurance (vytrvalost): jak rychle hráč v zápase unaví — nízká vytrvalost se projeví hůř na dlouhých střídáních a ve třetí třetině.",
      ] },
      { h: "Brankáři", points: [
        "AG (obratnost), RB (kontrola odrazů), SZ (velikost), HS (rychlost rukou), RT (reflexy), SC (styl) a PH (vedení puku) se dohromady mísí do celkové kvality zákroků brankáře — AG a RB mají největší váhu, PH nejmenší.",
        "RB — kontrola odrazů zároveň přímo snižuje šanci, že zákrok vyprodukuje nebezpečný dorážecí odraz zpátky na střelce.",
        "DU — odolnost určuje, kolik střel brankář ustojí, než ztratí bod CON — „koňský“ brankář unese větší zátěž, než se unaví.",
        "MO — nálada je živá hodnota i u brankářů: sebevědomý brankář krade zápasy, nejistý pouští laciné góly — rozdíl až zhruba ±5 % v kvalitě zákroků daný večer.",
        "CON stále rozhoduje, kdo chytá (musí být ≥98 v den zápasu, viz §4) a přímo škáluje kvalitu zákroků. EN/SK/PS/EX/LD jsou na kartě brankáře vidět, ale ve výše uvedeném vzorci kvality zákroků nemají samostatnou váhu.",
      ] },
      { h: "Dobré vědět", points: [
        "OV (Overall/celkové hodnocení) je jedno souhrnné číslo. Rozhoduje o automatickém rozdělení ledového času/sestavy, kdykoli si linky nenastavíte ručně, a (uměle roztažené pro reálný rozdíl mezi týmy) zhruba vyjadřuje celkovou kvalitu týmu.",
        "CON (kondice) je popsaná v §3 — není to pevný atribut, ale živá hodnota únavy/zdraví, která klesá hraním a obnovuje se ve dnech volna.",
      ] },
    ],
  },
  {
    id: "tactics", title: "16 · Taktika týmu a shoda formací",
    intro: "Kromě čistých hodnocení hraje roli i to, JAK sestavu nasadíte — celotýmová systémová taktika, úpravy na úrovni jednotlivých formací a to, jak dobře se hráči na lajně/páru vzájemně doplňují, to vše ovlivňuje každý odsimulovaný zápas.",
    groups: [
      { h: "Systémová taktika týmu", points: [
        "Šest voličů, každý s neutrální výchozí hodnotou „Vyvážené”: Tempo (rychlost hry), Forček (tlak na puk), Styl s pukem (jak útočíte), Krytí obranného pásma (jak bráníte vlastní pásmo) a dva voliče speciálních formací — styl přesilovky a styl oslabení. Přednastavené styly je sdruží (Run-and-Gun, Past, Těžký forček, Objem střel, Uzamčení) nebo si každý volič nastavíte zvlášť na stránce Taktika, kde je přesně popsané, co která volba dělá a jaké atributy chce.",
        "Každá volba mimo vyvážené má reálný přínos (víc střel, víc zisků puku, méně/méně nebezpečných šancí soupeře, silnější přesilovka nebo oslabení) A reálnou cenu (víc střel proti, víc únavy, víc trestů) — cena platí vždy naplno, přínos škáluje Shoda systému níže.",
        "Shoda systému (živě zobrazená jako %, zhruba 60–118 %) měří, jak dobře se na ledě zprůměrované atributy vaší soupisky hodí k voličům, které jste nastavili — např. rychlé tempo chce bruslení (SK) a výdrž (EN), agresivní forček chce důraz (CK) a rychlost (SK), cyklovací útok chce přihrávku (PA) a sílu (ST), přesilovka 1-3-1 chce střelce na blafák (SC) a rozehrávače (PA). Zvolíte-li systém, na který máte v soupisce hráče, jeho přínosy se zesílí; vnutíte-li systém, na který nemáte, platíte plnou cenu bez plné odměny.",
        "Hlavní trenér posouvá Shodu dvěma způsoby: jeho zkušenost (EX) pomáhá zvládnout náročný systém (ostřílený kouč pozvedne slabší shodu; nezkušený z náročného systému tolik nevytěží), a jeho osobní koučovací styl (Ofenzivní / Defenzivní / Fyzický / Vyvážený) přidává malý bonus, když systém, který nastavíte, odpovídá jeho vlastní identitě, a trochu tření, když si odporují.",
        "Úpravy na úrovni formace: každá útočná lajna může mít vlastní Styl s pukem a každý obranný pár vlastní Krytí obranného pásma, navrstvené na celotýmové Tempo a Forček (ty zůstávají vždy na úrovni týmu) — např. defenzivní pár může hrát Zhustenie, zatímco vaše první dvojice hraje Agresivně.",
      ] },
      { h: "Shoda rolí na lajně/páru (chemie)", points: [
        "Kromě čistého talentu záleží i na MIXU rolí: útočná lajna chce rozehrávače + střelce + dříče, ne tři stejné typy; obranný pár chce jednoho ofenzivně laděného beka spárovaného s jedním defenzivně laděným, ne dva se stejným stylem hry.",
        "Role hráče se posuzuje vůči PRŮMĚRU LIGY pro jeho post, ne porovnáním jeho vlastní ofenzivy s vlastní obranou izolovaně — bek se počítá jako ofenzivně laděný, jen pokud je opravdu ofenzivnější než typický bek v NHL, protože obranné atributy jsou u všech beků napříč ligou vysoké. (Posuzování hráče čistě proti sobě samému dřív chybně řadilo řadu reálně ofenzivních beků mezi defenzivní, protože i ofenzivnímu bekovi obvykle vyjdou jeho obranná čísla vyšší než ta ofenzivní.)",
        "Shoda rolí je odstupňované skóre, ne příznak ano/ne: silně se doplňující pár (skutečný defenzivní bek vedle skutečného ofenzivního) má výrazně vyšší skóre než pár, který se doplňuje jen málo — místo aby každá „smíšená” kombinace vyšla na stejné číslo. Přímo se promítá do reálných zápasů přes strukturální postih, který snižuje ofenzivní výkon jednotky s duplicitními rolemi — ten se ČASEM NEVYTRÁCÍ, na rozdíl od samostatného postihu za chemii níže.",
        "Samostatně si lajna/pár buduje i běžnou chemii ze společně odehraného času na ledě — čerstvě sestavená nebo právě přeskládaná kombinace simuluje pod plnou silou, dokud se nesehraje, a tento postih se ČASEM VYTRÁCÍ. Editor sestav ukazuje živé odznaky pro Chemii i Shodu rolí, zatímco přesouváte hráče mezi lajnami, a pohled Line Builder ukazuje stejná čísla (plus ofenzivní profil a shrnutí v prostém jazyce) pro vaše uložené sestavy.",
        "Chemie se počítá pro každý PÁROVÝ SVAZEK uvnitř formace zvlášť (trojice má 3 svazky, dvojice 1) — takže rozbití trojice ochladí jen ten svazek/y, které skutečně přestaly hrát spolu, ne celou lajnu. Nedotčený svazek chemii každý zápas, kdy oba hráči nastoupí spolu ve stejné formaci, získává; rozdělený svazek ji pomalu ztrácí — zhruba poloviční tempo oproti růstu za každý zápas odděleně — až na podlahu rovnou startovní hodnotě zcela nové dvojice, níž už neklesne. Když se hráči později znovu spojí, jejich svazek pokračuje odtud, kde ho ztráta zastavila (pamatuje si ho pro každý pár zvlášť, nezávisle na aktuální sestavě lajn), ne od nuly — a pokud se v nějakém období vůbec neodehraje zápas (např. mimosezóna), se svazkem se vůbec nic neděje.",
        "Formace speciálních týmů (PP1, PK1 atd.) fungují jinak: hodnotí se jako jedna jednotka místo párově, a jejich rozbití stojí skutečný propad hned ten zápas, kdy k němu dojde — okamžitý pokles, ne pomalé vytrácení — zatímco nedotčená formace speciálních týmů roste stejně plynule jako párový svazek v 5 na 5. V obou případech nízká chemie jen ubírá ofenzivní výkon, nikdy nepřidává bonus nad práh sehranosti, a protože rozdělený svazek v 5 na 5 nikdy neklesne pod svou podlahu, jeho nejhorší možný postih čistě z chemie zůstává mírný — zdaleka nedosáhne maxima, které by znamenalo nulové skóre chemie.",
      ] },
      { h: "Tactical Fit — jak to všechno hraje dohromady", points: [
        "Stránka Line Builder hodnotí každou uloženou lajnu/pár jedním číslem „Tactical Fit” (0–100), které skládá ČTYŘI oddělené věci do jedné: Shodu rolí (odstupňované skóre výše), správnost postu a hokejky (stojí každý útočník tam, kam pokrývá jeho post; má obranný pár správnou hokejku — levák vlevo, pravák vpravo), Shodu systému — STEJNOU míru soupiska-vs-taktika ze Systémové taktiky týmu výše, spočítanou jen ze zprůměrovaných hráčů této jedné lajny proti voličům systému, které máte pro tým nastavené — a Shodu archetypu podle sestavy (níže).",
        "Shoda archetypu podle sestavy porovnává reálný skautský TYP každého hráče — stejný štítek, jaký je vidět na jeho profilové stránce („Sniper”, „Playmaker”, „Dual-Threat”, „Two-Way Forward”, „Defensive Forward”, „Forechecker / Grinder”, „Offensive/Two-Way/Defensive/Stay-at-Home Defenceman” atd.) — s tím, co konkrétní post v sestavě opravdu chce, místo aby se každá lajna/pár hodnotily stejně bez ohledu na to, kde v sestavě sedí. 1. a 2. útočná lajna chtějí kvalitu („Sniper”, „Playmaker”, „Dual-Threat”, „Offensive Forward”) — i silový „Forechecker / Grinder”, který má pořád reálnou ofenzivu (klasifikátor ho zařadí jako dříče jen proto, že důraz mírně převáží nad ofenzivou, ne že by ji neměl), se tam počítá jako skutečný přínos, na OBOU útočných lajnách, ne jen tolerovaný; 3. lajna chce mix „Two-Way”/„Defensive”/„Grinder”; 4. lajna vyloženě chce typy „Forechecker / Grinder” a „Defensive Forward” — skutečnou obrannou/energetickou jednotku, ne zředěnou útočnou lajnu. Obránecké páry kopírují reálné rozdělení: první pár zůstává flexibilní (už je odměněn za mix ofenzivy/defenzivy Shodou rolí výše), druhý pár chce defenzivní sklon, a třetí pár vyloženě upřednostňuje skutečného „Stay-at-Home Defenceman” před pouhým „Defensive Defenceman” (ten dostane jen poloviční uznání) — takže vychází výrazně DEFENZIVNĚJŠÍ než druhý pár, ne jen podobně defenzivní. Lajna bez klasifikovatelných hráčů (chybí dost hodnocení) se v této složce hodnotí neutrálně, ne trestá.",
        "Právě složka Shody systému způsobuje, že Tactical Fit reaguje na Taktiku: lajna poskládaná z hráčů, kteří jednotlivě sedí na váš zvolený systém (rychlí dokončovatelé na Rush týmu, silní přihrávači na cyklovacím týmu), vyjde lépe než stejně rolově vyvážená lajna, která na systém nesedí — a tým hrající výchozí Vyvážený systém touto složkou vůbec neovlivní (Shoda systému je neutrální, ×1,0), takže Tactical Fit se zredukuje na Shodu rolí × post/hokejku × Shodu archetypu podle sestavy, dokud se stránky Taktika vůbec nedotknete.",
        "Tactical Fit je plánovací/zobrazovací číslo, ne to, co si sama simulace účtuje každý zápas: promítá se jen do PROJEKTOVANÉ startovní chemie, na které čerstvě sestavený nebo právě přeskládaný svazek začíná (dobře poskládaná, dobře sedící lajna má projektovanou teplejší startovní chemii, než má za sebou jediný společný zápas) — viz „proj” výše. Skutečný postih ve hře za jednotku s duplicitními rolemi jde čistě ze Shody rolí, kterou aplikuje přímo simulace; skutečný efekt Shody systému je taky samostatný — uplatňuje se na úrovni celé SOUPISKY (ne po lajnách), kde škáluje reálné přínosy a náklady vašeho týmového systému během odsimulovaných zápasů, jak je popsáno výše. Shoda archetypu podle sestavy se — stejně jako správnost postu a hokejky — promítá jen do projektované startovní chemie, není to samostatný postih ve hře.",
      ] },
    ],
  },
  {
    id: "predictor", title: "17 · Tipovacia liga & Odmeny (Picks & Rewards)",
    intro: "Súťaž UNHL Predictor spája každodennú zápasovú tipovačku (Game Picks) a celosezónne tipy (Season Picks) s reálnymi klubovými odmenami.",
    groups: [
      { h: "Zápasy dňa a Zápas týždňa (Game of the Week)", points: [
        "Zápasy dňa (2 body za správny tip): každý hrací deň systém vyberie oficiálne zápasy NHL. Tipuje sa výsledok po 60 minútach: 1 (Výhra domácich), X (Remíza / predĺženie), 2 (Výhra hostí). Za správny tip získate 2 body (s Jokerom ×3 až 6 bodov).",
        "Zápas týždňa / Game of the Week (až 15 bodov): jeden hlavný šláger týždňa. Tipuje sa výsledok po 60 min. 1-X-2 (2b), presné skóre (5b), prvý strelec zápasu (5b) a najproduktívnejší hráč zápasu (3b). S Jokerom až 45 bodov!",
        "5 Jokerov na celú sezónu: násobí všetky získané body z daného zápasu ×3.",
        "Série (Streaks): 3 správne tipy v rade = +2b, 5 v rade = +5b, 10 v rade = +15b.",
      ] },
      { h: "Týždenné a mesačné odmeny", points: [
        "Víťaz týždňa (Weekly Game Picks Winner): Najlepší tipér každého hracieho týždňa v Game Picks získa finančnú odmenu +$200,000 do klubovej kasy.",
        "Mesační šampióni: Najlepší tipér každého kalendárneho mesiaca (október až apríl) získa bonusový Entry Draft Pick v 8. kole (alebo v 9. kole pri zaplnení 32 miest), +10 bonusových bodov do celkového poradia a odznak 🥇 Monthly Champion na profile.",
      ] },
      { h: "Celosezónne odmeny & Draftové picky", points: [
        "1. miesto (Šampión tipovačky): finančný bonus +$3,000,000, bonusový Entry Draft Pick v 8. kole (alebo v 9. kole pri zaplnení 32 miest v 8. kole) a zlatý profilový odznak 🥇 Season Predictor Champion.",
        "2. miesto: finančný bonus +$1,500,000, bonusový Entry Draft Pick v 8. kole (alebo v 9. kole) a strieborný odznak 🥈 Vice-Champion.",
        "3. miesto: finančný bonus +$750,000, bonusový Entry Draft Pick v 8. kole (alebo v 9. kole) a bronzový odznak 🥉 3rd Place.",
        "Pravidlo pre prideľovanie draftových pickov: Všetky extra draftové picky získané z tipovačky (celoročná TOP 3 aj mesační šampióni) sa umiestňujú do 8. kola vstupného draftu nováčikov. V prípade, že je 8. kolo už kompletne zaplnené 32 pozíciami, pick sa automaticky zapíše do 9. kola.",
      ] },
    ],
  },
];

const RULES_T = {
  en: { title: "League Rules", subtitle: "How everything works — the full rulebook for UNHL.", note: "Some values (cap, variance, injury rate, FA/waivers systems) are commissioner-tunable and may differ per league." },
  cs: { title: "Pravidla ligy", subtitle: "Jak všechno funguje — kompletní pravidla UNHL.", note: "Některé hodnoty (strop, rozptyl, četnost zranění, systémy FA/waiverů) může ladit komisař a mohou se lišit podle ligy." },
};

export default async function RulesPage() {
  const lang = await getLang();
  const sections = lang === "cs" ? SECTIONS_CS : SECTIONS;
  const tr = lang === "cs" ? RULES_T.cs : RULES_T.en;
  return (
    <div className="space-y-6 py-2 max-w-4xl">
      <PageHeader title={tr.title} subtitle={tr.subtitle} />

      {/* quick index */}
      <Card>
        <div className="flex flex-wrap gap-2">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="text-xs px-2.5 py-1 rounded-full bg-slate-800/70 text-slate-300 hover:bg-blue-600 hover:text-white transition-colors">{s.title}</a>
          ))}
        </div>
      </Card>

      <div className="space-y-5">
        {sections.map((s) => (
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

      <p className="text-xs text-slate-500 text-center pb-4">{tr.note}</p>
    </div>
  );
}
