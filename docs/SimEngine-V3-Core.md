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
