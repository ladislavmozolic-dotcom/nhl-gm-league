# Sim Engine V3 Core

V3 Core is the future whole-match architecture. It is separate from the
existing V3 calibration workbench and has no live or sandbox routing yet.

## Step 1 — MatchState foundation

`frontend/lib/sim/v3-core/match-state.ts` provides one immutable source of
truth for a live game: clock, score, possession, rink zone, manpower, on-ice
units, fatigue, pressure and momentum. It also exposes a team-relative view so
the next decision layer never has to infer its own version of the game state.

The module is pure: no RNG, database access, settings mutation or connection to
the current game simulation. This preserves V2 and the existing V3 workbench
byte-for-byte while the new architecture is built in parallel.

## Next

## Step 2 — Decision engine

`frontend/lib/sim/v3-core/decision-engine.ts` is a pure, deterministic intent
layer. It ranks carry, pass, shoot, dump-in, clear, forecheck, block and contain
from the team-relative state, puck-carrier skills, fatigue, pressure, score/time
context and existing profile type. It does not decide whether the action succeeds
and it contains no RNG.

## Next

## Step 3 — Action resolver

`frontend/lib/sim/v3-core/action-resolver.ts` translates an intent into
deterministic outcome chances: success, turnover, next zone and, for shots,
low/medium/high shot quality. It compares the actor's relevant skill with the
primary defender while accounting for pressure and fatigue. The future game
loop will sample these chances from its seeded RNG.

## Next

## Step 4 — Offline prototype loop

`frontend/lib/sim/v3-core/prototype-loop.ts` joins the first three layers in a
small seedable loop. It makes an intent decision, resolves it, samples the
result with the existing seeded RNG, and emits causal events such as carry →
turnover or shoot → save/goal. It is deliberately roster-in-memory only: no
database, schedule, sandbox switch or V2/V3 workbench integration.

## Next

## Step 5 — Real-roster adapter

`frontend/lib/sim/v3-core/adapter.ts` maps existing `SimSkater` cards into the
Core player profile (SK, PH, PA, SC, DF, ST/CK and the existing profile type).
It also maps the team's existing tempo, forecheck and puck-style dials to the
prototype's risk and forecheck preferences. No player type, rating or tactic is
duplicated; Core consumes the data the current engine already trusts.

## Next

## Step 6 — Real-roster diagnostic

`frontend/scripts/v3-core-prototype.ts` loads two real NHL `SimTeam` objects
read-only, adapts their roster and tactics, then prints the prototype score,
action mix, turnovers, shots and first causal events. It is a diagnostic only;
it cannot create games, mutate settings or route a league simulation.

## Next

## Step 7 — Prototype calibration harness

`frontend/scripts/v3-core-calibration.ts` runs a read-only in-memory league
round robin with real adapted rosters. It reports Core goals, shots, turnovers
and action mix per team/game. Unlike the V2 Calibration Lab, its role is not
acceptance yet: it exposes which Core decision or resolution curve must be
calibrated next.

## Step 8 — Goalie contest and first distribution calibration

`frontend/lib/sim/v3-core/goalie-resolver.ts` adds a separate, deterministic
skater-versus-goalie contest after a shot lane has been earned. It reuses the
current selected starter's `quality`, reflexes, rebound control and condition;
it does not create a second goalie rating or change a player's saved card.

The neutral point is measured from the active 32-team NHL starter pool at the
time of calibration (quality 84.16, reflexes 88.88, rebound control 89.66 and
condition 99.03). Consequently a better or rested starter suppresses the same
shot more, without pushing the whole league below its expected scoring level.

The read-only `v3-core-calibration.ts 90000 720` double round robin (992
games) now produces **28.1 shots** and **2.88 goals per team/game**. Those are
the initial working bands (28–32 shots and about 2.9–3.15 goals), not release
acceptance criteria. All 17 V3 Core tests and TypeScript checking pass.

## Step 9 — Timed state transitions and on-ice units

`frontend/lib/sim/v3-core/state-transition.ts` advances the regulation clock
by one seeded prototype beat (five seconds by default), updates fatigue and
territorial pressure, and changes the period correctly at 20-minute boundaries.
It also provides immutable line changes. The prototype now rotates declared
forward lines and defence pairs every 45 seconds and selects its actor and
defender only from the current units on the ice. Existing `SimTeam.units` are
adapted read-only; minimal test rosters still safely fall back to their full
player list.

The first post-transition calibration is 27.8 shots and 2.68 goals per
team/game across the same 992-game read-only run. The small reduction from the
pre-line prototype is retained as evidence, rather than hidden by a new global
multiplier: it must be addressed by the next hockey event layer.

## Next

Replace the current binary shot outcome with a shot-result layer: missed net,
blocked lane, save, rebound and follow-up chance. That layer will decide when a
whistle happens and at which faceoff spot play restarts, allowing the existing
V3 named stoppages to connect to Core later. Only afterwards should Core gain
special teams, penalties, faceoffs, injuries or any routing into a sandbox
game.

## Step 10 — Hybrid bridge into the production V3 engine (Oct 16 2026)

Core is now connected to the playable V3 engine as its **decision layer**, not as a replacement:
`frontend/lib/sim/v3-core/engine-bridge.ts` turns the live V3 state at the moment of an offensive-zone
decision (carrier, team tactics, zone, shift length, time in zone, score margin, time left, rebound) into a
Core decision input and returns Core's share of SHOOT versus PASS. The V3 loop samples that share with its
own seeded RNG and keeps everything else — resolution, blocks/misses/bounces, goalie contest, penalties,
special teams, faceoffs, OT/SO, events, live stoppages and stats.

- Flag: `experimentalV3.core` (default **on** in V3, off-switch for comparison). V2 is untouched.
- `CORE_TUNING.scale = 0.765` keeps the league shot volume at the measured NHL level; Core decides *who*
  and *when* (skills, player type, rebound, late desperation, team risk), V3 keeps *how many*.
- Measured with `scripts/nhl-reality-check.ts` (EXP='{"core":true}'), 2,976 games: goals 6.02 (NHL 6.09),
  SOG 29.1 (29.3), sv .904 (.902), every game-state row within ~3 points of the 2023-25 NHL data.

### Step 11 — Neutral-zone dump-in intent

`coreDumpShare(ctx)` returns Core's DUMP_IN share among CARRY / PASS / DUMP_IN for the carrier right now
(opponent forecheck → pressure, shift length → fatigue, team puck style → risk, score/time). When V3's
carry attempt is stopped in the neutral zone, `CORE_TUNING.dump (1.3) × that share` replaces the fixed
`DUMP_TUNING.share` (0.35) as the chance it becomes a dump-in. Same RNG draws; dump-ins stay ≈25 per
team-game; reality check unchanged within noise.

### Step 12 — Defensive-zone clear intent

`coreClearShare(ctx)` is Core's CLEAR share among CLEAR / PASS / CARRY in the carrier's own end (pressure =
time hemmed in, fatigue, a late lead to protect, the carrier's passing/skating). `CORE_TUNING.clear (2.8) ×
that share` replaces V3's flat tired ×1.7 as the icing multiplier — icings stay ≈7 per game, but now come
from hemmed-in, tired units and teams sitting on a lead rather than from tiredness alone.

### Step 13 — Core reasons in the feed

`coreWhy(ctx, kind)` names the main driver of a safe play (tired / forecheck / lead / hemmed). Dump-in
zone entries and icings carry it as `meta.why`; the play-by-play and the live feed append e.g. "— tired
legs, the change is coming". Narrated once per team, period and reason. Text only, no RNG.

### Step 14 — Core goalie contest, measured (kept off)

`coreGoalieQualityAdj(attrs)` folds Core's reflexes (RT) and rebound-control (RB) weights into V3's
effective goalie quality, centred on the starter pool (mean 0, range −3.8…+2.4 quality points). Flag
`experimentalV3.coreGoalie` exists but defaults **off**: it widened the team save % spread (10.3 → 10.6),
which was already wider than the NHL's. The same measurement showed V3 itself spread goalies/defences too
much (talent SD 8.4 vs NHL ≈5.8), so V3 got `GOALIE_TUNING` (goalie-quality exponent 1.7 → 1.2, defending-pair
DF influence × 0.3) → 6.5, everything else unchanged.

### Next hybrid steps
- Revisit `coreGoalie` only if Core's goalie model is re-based on the narrower spread.
