# Status — 2026-08-29/30 session

All items below are committed to `main` and deployed live at unhl.eu. Commits
listed oldest → newest; `git log --oneline` for full messages. This session
picked up right after the previous one (Admin Contracts / Role Fit).

## Session overview (read this first)

A single long session, roughly three phases. Full detail for every item is
in the sections below, in commit order.

**Phase 1 — Sim Engine V2, finished the original plan.** Every remaining
`EventType` wired live (REBOUND, PP_START/END, MISS, ZONE_ENTRY), injuries
reworked from a post-game statistical pass into a genuinely live per-tick
mechanic (5-on-5, OT, shootout, fights), coach ratings/tactics dead fields
wired up, a High-Danger Shot Map UI added. Calibration Lab went from 3
fails to 0 fails / 1 (noisy) warn.

**Phase 2 — picked back up, made V2 actually different from V1.** Confirmed
blowouts were already fixed; ruled out `catchUpStrength` as a fix for the
one remaining Spearman warn (grid-searched across 8 seeds — flat, not a
lever). Found and fixed a real bug: defensemen were getting 40% of team
assists (real-hockey ballpark ~28%) — `D_ASSIST` 0.6→0.29. Then, since
`nextgen` had never actually changed any game math (only narration), built
two real V2-exclusive gameplay differences: **home-ice line matchups**
(reactive checking-line-vs-their-top-line deployment) and a **"protect the
lead" defensive shell** in the final 5 minutes of a close game.

**Phase 3 — Season Control automation + a long tail of live bug reports.**
Built real automatic day-to-day season progression: a 20:30 Europe/
Bratislava cron that auto-simulates scheduled games (previously 100%
manual), a health-check banner so a dead cron doesn't fail silently,
clicking "Off-season" now auto-(re)generates the pre-season schedule timed
off the real regular-season opener, and pre-season now shows everywhere
(homepage, scoreboard, stats, schedule, team pages) once made public.
League History gained Pre-season/Regular/Playoffs tabs. From there the
session shifted to fixing real issues the user hit using the live
site: a stale-deployment error that looked like "nothing happens" on every
button after a redeploy, the re-signing window being wrongly closed
outside the regular season, a farmed player invisible to Admin Contracts,
GM Assist undervaluing picks/rookies/prospects, three Trade Commission
gaps (missing pick-owner logos, no early visibility, no conflict-of-
interest guard), a permanently-stuck Messages badge with nothing to open,
and Admin Contracts missing a contract-type editor and force-rounding cap
hits to 50k steps. All 32 NHL teams' bank accounts were also set to a
uniform $40M directly, at the user's request.

**Where things stand**: 0 calibration fails, 1 noisy warn (Spearman,
investigated and confirmed not fixable via the obvious lever). Everything
above is live on unhl.eu. Nothing is currently known-broken.

## Sim Engine v2 — Phase 1 (event stream) completed

Finished every event type left over from the plan: **REBOUND**, **PP_START/
PP_END**, **MISS**, **ZONE_ENTRY**. Combined with the already-live FACEOFF/
SHOT/GOAL/SAVE/HIT/BLOCK/TAKEAWAY/GOALIE_PULL/INJURY, every `EventType` in
`lib/sim/events.ts` is now either genuinely wired or deliberately skipped with
a documented reason (`PERIOD_START/END` and `EMPTY_NET` — info already covered
elsewhere; `GIVEAWAY` — tried, produced 280 events/game, reverted).

- **REBOUND / PP_START / PP_END / MISS / ZONE_ENTRY** first landed as
  *statistically-calibrated* events (a realistic count generated once per
  game, not tied to a specific simulated moment) — the same safe pattern
  already used for HIT/BLOCK/TAKEAWAY, chosen to avoid repeating the GIVEAWAY
  mistake (wiring an internal per-tick branch that turned out to fire far too
  often). *(`1eb6152`)*
- Later in the session, **MISS and ZONE_ENTRY were upgraded to genuinely live,
  tick-accurate events** after finding real decision points already sitting
  in the tick loop:
  - **ZONE_ENTRY** — the existing "advance the puck toward the offensive
    zone" branch already resolved entry success/failure every tick, it just
    never emitted anything. Wired on the real NEU→OFF transition. Pure
    bookkeeping, zero effect on any game outcome. *(`0d039fd`)*
  - **MISS** — no "shot misses the net" outcome existed anywhere; every
    unblocked shot attempt was unconditionally a shot-on-goal. Added a real
    miss branch *before* the shot touches the box score or xG, and scaled the
    upstream shot-attempt rate up (`MISS_COMPENSATION = 1.38`) so the
    on-goal rate stays where it was calibrated. This was done carefully with
    explicit sign-off first, since it touches calibrated shot math — see
    Calibration section below for the (better than expected) result.
    *(`7c81b08`)*
  - The old statistical generators for both now only run for the legacy
    "volume" engine model, which has no tick loop to hook a live version
    into.

## Injuries — reworked from post-game statistics into a live mechanic

The user reported a real bug: a player would get "injured" in the play-by-play
narration, then keep appearing on lines and racking up stats for the rest of
the game. Root cause: `generateInjuries()` ran entirely **after** the whole
game was already simulated — a pure post-hoc statistical pass with a made-up
timestamp, zero effect on deployment.

- Replaced with `maybeInjureOnIce()`, rolled **every tick** against whoever is
  actually on the ice. The instant a player goes down he's excluded from all
  further line/PP/PK selection (`subMis`, the existing misconduct-substitution
  chokepoint, extended to also bench `st.injured` players).
- If the injured player is the one **carrying the puck**, play is interrupted
  immediately (forced stoppage) instead of letting him keep possession.
- `announceChange` (line-change narration) had a latent bug this surfaced: it
  only re-announced on a *label* change ("Line 2"→"Line 3"), not a *personnel*
  change, so a substitution could sit unannounced. Fixed to key on both.
- Every decorative/statistical narration path (icing/offside filler, HIT/BLOCK
  stats, penalty generation, fight generation, the endgame empty-net model)
  now excludes already-injured players.
- Injury duration now varies by mechanism (a fight rarely ends a season; a
  collision runs slightly worse than a plain hit); the play-by-play line reads
  as a broadcast note instead of a mechanical template.
- **Extended to OT, the shootout, and fights later in the session** (see
  below) so the live-injury guarantee is now consistent everywhere, not just
  5-on-5 regulation. *(`1eb6152`, `1bec3d1`)*
- Only remaining timing gap anywhere: `generatePenalties` rolls a period's
  penalties *before* that period's ticks run, so it can't know about an
  injury that hasn't happened yet within that same period — a small, accepted,
  well-understood residual (1 case in 300 test games), not something worth a
  bigger restructure right now.

### OT / shootout / fights — closed out on explicit request

- **OT**: had no persistent on-ice unit to check injuries against. Added a
  per-15-second sampled-trio injury roll and filtered the shooter/on-ice-unit
  selection to exclude anyone hurt.
- **Shootout**: filtered the shooter order (including the manager's pre-set
  list) so an injured player can't take a penalty-shot attempt.
- **Fights**: moved from a once-per-period post-hoc roll to `maybeStartFight`,
  checked at every real stoppage in the tick loop (~14/game) — the resulting
  Fighting major *and* injury both land at the real tick, closing the
  "same-period" gap that the earlier per-period version still had.
  *(`1bec3d1`)*

## Coach ratings & tactics — dead fields wired up

- `Coach.ph` (physical) and `Coach.ld` (leadership) were imported from
  profinhl.cz and shown in the UI, but never read by the engine. Now feed hit
  rate and momentum stability respectively.
- Coach **style** (Offensive/Defensive/Physical/Balanced) now nudges the
  Phase-3 team-system fit up or down depending on whether it matches the
  GM-installed system dials — previously two fully independent multiplier
  chains with no interaction. *(`1eb6152`)*
- `goaliePull` (minGoals/savePctUnder/pullSec) — the GM-editable strategy dial
  — is now actually read by the engine (starter-swap and empty-net-pull
  timing), instead of being pure UI decoration. *(carried over from earlier
  in the session, folded into `1eb6152`)*

## New UI: High-Danger Shot Map

`/games/[id]` → Team Stats tab now has a rink SVG per team plotting every goal
plus every high-danger scoring chance. Explicitly labelled "High-Danger", not
"Shot Chart" — only high-danger `SHOT` events are persisted to `GameEvent`
(ordinary shots are `MINOR` importance and never written), so this is not the
full shot volume; the existing "Shot Locations" bar chart still covers that.
*(`1eb6152`)*

## Calibration Lab — went from 3 fails to 0 fails / 1 (noisy) warn

The Calibration Lab already existed (`/admin/calibration`,
`npx tsx scripts/calibration-lab.ts`) — used throughout this session as the
verification tool for every tuning change below.

- **Injury rate** was landing at 0.40/team/game against a 0.45-0.62 target
  after the live rework. `INJURY_BASE` 0.18 → 0.24 closed it (0.52 in the
  lab). *(`8380857`)*
- **Blowout rate** (≥4-goal games) was failing at 22-24% against an 8-14%
  target — traced (not guessed) to two real causes: it didn't correlate with
  team-quality gap at all, and ~10 of the ~23 percentage points were games
  that were *only* a blowout because a late empty-net goal padded the margin
  past 4 (40% of games had an EN goal; real NHL is nowhere near that — 22% of
  all goalie pulls were a team down 3 pulling with the full 2-minute window,
  which real coaches almost never do). Tapered the empty-net pull window by
  deficit size (down 1 = full window, down 2 = 70%, down 3 = 35%): blowouts
  22-24% → 16.4%. *(`5a2fcc7`)*
- **catchUpStrength** grid-searched (0.03→0.12) against blowout rate AND the
  Spearman quality-to-points correlation together, since they pull against
  each other. 0.07 resolved both remaining warns at once: blowouts →13.8%,
  Spearman 0.822→0.879. *(`5f1f0b4`)*
  - **Deploy gotcha caught here**: this setting is also stored per-league in
    the `SimSettings` DB row once an admin has saved `/admin/simulation`,
    which overrides the code default. Updated the code AND separately updated
    the production database row directly (`docker compose exec db psql ...
    jsonb_set(...)`) — a code-only change would have silently done nothing
    live. Verified no other stored setting was disturbed.
- **MISS going live** (see above) turned out to also fix two more
  *pre-existing* warns (goals/team/game 3.18→2.95, shots/team/game
  33.0→30.2) as a side effect of the shot-rate recalibration it required.
  *(`7c81b08`)*

**Current state**: 0 fails, 1 warn (Spearman correlation — a 4-seed variance
check showed it naturally swings 0.78–0.87 run to run; not a regression from
anything this session did, just a noisy metric worth knowing about, not
chasing further right now).

## Files changed this session

| File | What changed |
|---|---|
| `frontend/lib/sim/engine.ts` | The bulk of the work: live injuries (5-on-5/OT/fights), MISS/ZONE_ENTRY live wiring, empty-net window taper, coach ph/ld/style wiring, `goaliePull` read, `INJURY_BASE`/`MISS_COMPENSATION` tuning constants |
| `frontend/lib/sim/playbyplay.ts` | Injury-aware filler narration (icing/offside/hit-filler no longer pick an already-injured skater), mechanism-flavoured injury narration text |
| `frontend/lib/sim/ratings.ts` | Coach `ph`/`ld` → `coachPhy`/`coachLd` factors |
| `frontend/lib/sim/tactics.ts` | Coach style × system-fit interaction |
| `frontend/lib/sim/settings.ts` | `catchUpStrength` default 0.03 → 0.07 |
| `frontend/lib/sim/types.ts` | Supporting type additions for the above |
| `frontend/components/GameView.tsx` | High-Danger Shot Map component |
| `frontend/app/games/[id]/page.tsx` | Wiring for the shot map |
| **Production DB** (`SimSettings` row, not a file) | `catchUpStrength` updated directly to match the new code default (see gotcha above) |

## Verification method used throughout

Every change was checked with the same three tools before being committed:
1. **v1/v2 box-score identity** at the same seed (core math should be
   unaffected by narration-only changes, and should match itself even when
   the actual mechanic changed).
2. **PBP-transcript scans** — e.g. scripted checks that no player's name
   appears anywhere in the play-by-play *after* his own recorded injury time.
3. **The Calibration Lab** — full double round-robin against real-NHL target
   ranges, re-run after every tuning change.

Several throwaway diagnostic scripts (seed-bucketed OV-gap analysis, a
`git worktree` A/B against the pre-session baseline, empirical firing-rate
counts before wiring any new live event) were written, used, and deleted —
none left in the repo.

## What's NOT done / deliberately left alone

- **Spearman correlation** sits around 0.80-0.85 with real run-to-run noise —
  not failing, not chased further this session.
- **`generatePenalties` same-period gap** — a penalty for period P is decided
  before period P's ticks run, so it can't react to an injury that happens
  later in that same period. Rare, accepted, same shape everywhere it occurs.
- **Goals/shots-per-game** are now both comfortably in range (side effect of
  the MISS work) — no outstanding action needed.
- Coach rating **STHS importer** already exists (`lib/coach-import-server.ts`,
  wired to `/admin/finance`) — a stale earlier note claiming otherwise was
  corrected in Claude's memory this session, not a real gap.

## Suggested next step

Nothing is currently broken or blocking. Reasonable options if picking this
back up, roughly in order of how directly they follow from what's already
built:
1. **Season GSAx leaderboard** — already exists at `/stats/advanced`, no work
   needed (checked this session; an earlier status summary had incorrectly
   flagged it as still-to-build).
2. **Deeper blowout tuning** — the remaining gap between 11-14% (current) and
   further improvement, if ever wanted, would need touching the core
   possession-skill/parity formulas rather than a single tunable — bigger,
   more invasive, not attempted this session.
3. Anything outside the sim engine — this session didn't touch any other part
   of the app.

## 2026-08-30 continuation

Picked this session back up. User chose "deeper blowout tuning" as the next
step, which turned into two findings — one negative (a dead-end ruled out
carefully instead of pursued), one a real bug fix.

### Blowouts were already fixed; re-verified across seeds

Re-ran the Calibration Lab fresh: **blowouts sit at 11.1%, comfortably
in the 8-14% target** — the `catchUpStrength` work from the prior session
already closed this. Status.md's own "suggested next step" was already
stale by the time it was read.

### `catchUpStrength` confirmed a dead end for Spearman

The one remaining warn (Quality→points Spearman, 0.813 vs target >0.85)
was suspected to be pure run-to-run noise per the prior session's notes.
Checked properly this time: ran the full calibration across **8 different
seed bases** (not just the one hardcoded seed the lab always uses).

- Blowouts: consistently in-band across all 8 seeds (11.1-13.3%) — genuinely
  resolved, not a fluke.
- Spearman: **consistently below target in all 8 seeds** (avg 0.784, range
  0.691-0.828) — not noise crossing the 0.85 line occasionally, a real
  persistent gap. Cross-checked against a `git worktree` at `5f1f0b4` (the
  commit right after the original `catchUpStrength` fix, before OT-injury/
  live-fight/MISS/ZONE_ENTRY work landed): same distribution (avg 0.791,
  range 0.709-0.879) — so later work in the prior session didn't cause this,
  and the earlier session's "0.822→0.879 resolved" claim was itself just one
  lucky seed, not a real fix.
- Grid-searched `catchUpStrength` 0.07→0.20 across all 8 seeds:  Spearman
  stayed flat/noisy the entire range (0.784-0.798, no real trend) while
  blowouts collapsed from 11.9%→3.0%, blowing well past the target band
  by 0.13. **This lever cannot fix Spearman — it only trades blowouts
  away for nothing.** Left `catchUpStrength` at its current 0.07 (the best
  already-in-target value). Actually improving Spearman would need a
  different mechanism — likely the underlying skill-to-win-probability
  curve — not attempted, flagged as genuinely bigger scope than a tunable.

### Real bug found and fixed: defensemen dominating assists (`f9ffc6a`)

User spotted it directly from a real in-app leaderboard screenshot: 7 of
the top 10 assist leaders were defensemen (real NHL: ~14 of the top 50,
nowhere near that concentration).

- **Root cause**: `iceTime` is normalized *within a player's own unit* —
  each defenseman (2-player pairs) already carries ~2x the per-player
  weight of each forward (3-player lines) structurally, before the
  `D_ASSIST` position-dampening multiplier (0.6) is even applied. Measured
  directly: team-wide assist share was **40.2% defensemen** vs a real NHL
  ballpark of ~28% — the flat 0.6 wasn't nearly enough to offset the
  built-in 2x ice-time skew.
- **Fix**: `D_ASSIST` 0.6 → 0.29 (`lib/sim/engine.ts`), tuned empirically
  against 5 seeds of a full double round-robin — lands team D-assist-share
  at 27.7-29.2% consistently, matching the real target.
- **Verified**: v1/v2 box-score identity 0/15 (shared core math, correctly
  affects both engines identically — same category as the earlier
  coachPhy/coachLd fix). Calibration Lab unaffected (still 0 fails/1 warn).
- **Known remaining nuance, not fixed**: elite offensive defensemen are now
  *under*-represented at the very top of the leaderboard (0-1 of the top 10
  across 5 seeds, real hockey usually has 2-3) even though the team-wide
  average is now correct. A flat multiplier scales a star D down exactly as
  much as an average one, compressing the top tail — fixing this properly
  would mean making the D-dampening vary by player quality instead of being
  a flat constant. Out of scope for this fix; the reported bug (D
  *over*-representation) is resolved.
- Committed `f9ffc6a`, pushed, deployed to unhl.eu (confirmed 200 after
  deploy).

### Suggested next step (updated)

1. If the elite-D-at-the-top nuance above is worth chasing: would need
   `D_ASSIST` (or an equivalent) to scale with player quality rather than
   being a flat constant — genuinely new design, not a retune.
2. Spearman: the multi-seed grid-search ruled out `catchUpStrength` as a
   lever. Next honest option is investigating the skill→win-probability
   curve directly (bigger, riskier, not attempted) — or accepting ~0.78-0.83
   as this model's real ceiling and moving on.
3. Options 2/3 from the prior "Suggested next step" section above still
   stand unchanged.

## 2026-08-30, continued — first real V2 gameplay difference: line matchups (`8a9db54`)

User asked what could make Sim Engine V2 gameplay-wise better than V1, not
just narration-different (which is all "nextgen" had ever done). Answered
with 4 ranked ideas (real line-matching, in-game tactical adaptation,
fatigue-driven shift management, individual clutch factor) and recommended
line-matching as the best risk/reward — isolated, verifiable with the same
tooling already in use, and it finally gives the flag real teeth. User
picked it up: "skús ich postaviť."

**Built and shipped:**
- Each team's forward lines now get classified by role once per game
  (`classifyLines`, `lib/sim/engine.ts`) from real attributes rather than
  manager-set line order: highest combined offense+playmaking = "top",
  highest defense **among the other lines** = "checking" — deliberately
  excludes the top line from the checking search, since a stacked top
  line often wins both sums just by being better at everything (caught
  this exact bug via a live trace before shipping: first version had
  `checkIdx === topIdx` for the home team in the sample game, meaning the
  bias branch that should fire when the opponent's checking line is out
  never had anywhere distinct to send the response).
- `advanceShift` (v2/home-only) now reads the away team's currently-
  deployed forward line and biases the home team's next rotation:
  checking line vs their top trio, top trio vs their checking line — a
  2.4x weight multiplier on top of the existing depth-chart weighting,
  not a deterministic override. Traced one full game: ~42% hit rate on a
  defined matchup target, up from a ~22-34% baseline — present and
  measurable, not overwhelming.
- Gated on a new `SimState.isNextGen` field — this is the **first**
  upgrade where v1 and v2 box scores are allowed to genuinely differ (not
  just narration text). `version.ts`'s header comment, which previously
  asserted the math is always identical, was updated to document the
  exception.
- **Verified**: v1 self-identity 0/20 (the new code path is fully inert
  under v1 — confirmed by running v1 against itself and diffing). v2's
  home box differs from v1 in 20/20 sampled seeds (the intended effect).
  Standard (v1-pinned) Calibration Lab: byte-identical to before this
  change. A separate v2-forced calibration pass (4 seeds): home-win%
  52-56%, goals/game 2.94-3.00, blowouts 10-12% (slightly *tighter* than
  v1 in most seeds — plausible side effect of fewer bad matchups),
  Spearman in the same ballpark as v1 — healthy on every metric.
- Both local AND production `LeagueConfig.simEngine` were already set to
  `"nextgen"` (checked directly, not assumed) — so this is immediately
  live for every game with a home team, not sitting behind a flag nobody
  has flipped. Deployed to unhl.eu, confirmed 200 after deploy.
- **Not yet built** (options 2-4 from the original brainstorm, still
  open): in-game tactical adaptation (coach adjusts system based on
  score/time, not set-once), fatigue-driven shift-shortening decisions,
  individual player-level clutch factor (today momentum is team-only).

## 2026-08-30, continued — Season Control now actually runs itself (`e962902`, `f88b0f1`)

User asked how "Auto (calendar)" on `/admin/season` works, expecting the
league day to advance on its own by real time. Investigation found it
didn't: "Auto" only ever meant the PHASE label (off-season/preseason/
regular/playoffs) was computed from wherever the league's internal clock
(`LeagueConfig.leagueDate`) happened to sit — the clock itself only moved
one day per manual "Simulate Day" click, with zero automation anywhere
(checked: no cron, no scheduler in the app code, nothing on the
production server's crontab/systemd). User asked for the real thing:
scheduled games should auto-simulate at 20:30 real time when in Auto mode.

**Built:**
- `advanceLeagueDayCore()` (`app/admin/season/actions.ts`): the existing
  one-day-advance logic (already phase-aware — plays preseason exhibition
  games, regular-season rounds, playoff days, resolves Frenzy
  transitions, waivers, promises, opening-day cap compliance — uniformly
  across every phase), pulled out from behind the admin-only
  `advanceLeagueDayAction`'s `isAdmin()` check so an unattended trigger
  can call it too. The manual "Simulate Day" button is unchanged.
- `lib/season-cron.ts` `autoAdvanceIfDue()`: fires at most once per real
  calendar day, only inside a 20:30-20:40 **Europe/Bratislava** window
  (computed via `Intl`, DST-proof — the server's own OS clock is plain
  UTC, checked directly), and only while `phaseOverride === null` (Auto
  mode) — pinning a phase manually pauses the automatic clock too, since
  that's a deliberate admin taking manual control. Never batches multiple
  missed days if the cron had downtime; a missed window just gets caught
  up one real day at a time on the next tick, so nobody gets surprised by
  a pile of games landing at once.
- `LeagueConfig.lastAutoAdvance` (new DateTime field) — dedupe marker so
  a 5-minute cron tick doesn't refire repeatedly inside the same window.
- `app/api/cron/advance-day/route.ts`: POST endpoint behind a
  `CRON_SECRET` bearer token (no user session sits behind this trigger,
  and it mutates real league state, so it needs its own auth). Hit by a
  server crontab every 5 minutes — almost every hit is a fast no-op.
- **Real deploy bug caught and fixed same session** (`f88b0f1`):
  `docker-compose.yml`'s `app` service only explicitly forwards
  `DATABASE_URL`/`NODE_ENV` into the container — a var sitting in the
  host `.env` is available for compose-file `${...}` substitution but
  does NOT automatically become `process.env` inside the container unless
  listed. First deploy had the correct `CRON_SECRET` in `.env` but the
  endpoint still 401'd everything, because the app process never saw it.
  Added `CRON_SECRET: ${CRON_SECRET}` to the explicit list; documented in
  `.env.example` too.
- Verified end-to-end against a real dev server (not just unit logic):
  wrong secret → 401; outside window → no-op with reason; phase pinned →
  no-op with reason; in-window + auto mode → actually advances and
  returns the play result; same-day second hit → no-op "already advanced
  today"; next day's window → fires again.
- **Production**: `CRON_SECRET` generated (`openssl rand -hex 32`) and
  installed in the server's `.env`; crontab entry installed
  (`*/5 * * * * curl ... >> /var/log/unhl-cron.log`); confirmed live —
  the log shows real successful ticks (`{"ran":false,"reason":"outside
  the 20:30 Europe/Bratislava window ..."}`), `systemctl is-active cron`
  → active. First real auto-advance will fire at the next 20:30
  Bratislava window.
- `DEPLOY.md` section 10b documents the one-time server setup for anyone
  re-deploying this league or spinning up a second one.
- `PhaseControl.tsx`'s caption text updated to describe what each mode
  now actually does, instead of the old (now-inaccurate) "following the
  calendar" wording.

## 2026-08-30, continued — two more suggestions built (`7580dea`, `be96d6c`)

User said to keep building through the standing suggestion list. Did the
two remaining buildable ones (the third, Spearman correlation, is an
investigation task, not really "buildable" the same way — flagged as such).

**#1 — visible health check for the auto-advance cron (`7580dea`).** The
20:30 auto-sim shipped with no monitoring — a silently-dead cron would go
unnoticed until someone wondered why the league hadn't moved. Added a
status line under the phase control on `/admin/season`, driven by
`LeagueConfig.lastAutoAdvance`: pinned phase → gray "paused" (expected);
never run → amber; ran within 26h → green with timestamp; >26h → red,
points at the crontab/log. No new external dependency (no Discord/email
infra exists in this repo) — an in-app banner was the lowest-risk option.
Verified all 4 render states against a real dev server by directly
setting DB fields and reloading.

**#2 — "protect the lead" defensive shell (`be96d6c`).** Investigated
before building: score-based of/df tilting (`GameStrategy`'s
winning1/winning2/tied/losing1/losing2 via `tacticsMult`) turned out to
ALREADY be live for both engines — the original "tactics never change
mid-game" framing from the brainstorm was incomplete. The real, narrower
gap: the SYSTEM dials (tempo/forecheck/puckStyle/dZone) are resolved ONCE
per game and never revisited regardless of score or clock. Added
`lateShellShotMult` (v2-only): a team up 1-2 goals inside the final 5
minutes of regulation generates up to 12% fewer shot attempts, ramping
smoothly as the clock runs out — the single most recognizable missing
real-hockey coaching behavior (the late trap/shell). Traced directly to
confirm it fires only where intended. Verified with a `git stash` A/B on
the same (slightly drifted, see below) local dataset: the standard
V1-pinned Calibration Lab is byte-identical with vs without the change; a
V1-vs-V2 comparison across 4 seeds stays healthy on every metric for v2.

**Side-note caught mid-session**: the local dev DB's Calibration Lab
numbers had drifted somewhat from earlier-session values (Spearman now
reads ~0.76-0.85 across seeds rather than ~0.78-0.83) — traced to
legitimate side effects of testing the cron feature above (`aiGmDaily`
reassigning AI-team tactics, condition changes from several real
`advanceLeagueDayCore` calls on the same local DB). Not a regression from
any code change; the local dev DB is disposable test data, not
production — flagging only so a future session doesn't mistake this for
a real calibration shift if it re-runs the lab locally.

**Deployed to unhl.eu, both features live, confirmed 200 after each.**

**Remaining from the original list**: Spearman correlation (0.76-0.85,
noisy, target >0.85) is a real investigation task, not a quick build —
would need to actually study the skill-to-win-probability curve rather
than tune an existing dial (the `catchUpStrength` grid-search earlier
this session already ruled that lever out). Individual player-level
"clutch" factor (idea #4 from the original V2 brainstorm, momentum is
still team-only) remains un-started too.

## 2026-08-30, continued — "Restart season" bug hunt + Off-season cascade (`0eb57b5`, `bddc6b8`)

### Bug: "Restart season nejde vykonat" — root cause was this session's own deploy cadence

User reported the "Restart season (keep schedule)" button silently doing
nothing. Server logs (`docker compose logs app`) showed the real cause:
`Error: Failed to find Server Action "..." — this request might be from
an older or newer deployment.` Next.js Server Actions embed a
build-specific ID in the client bundle; this session deployed **5 times**
in a short window, so any admin tab left open across a redeploy sent a
now-unrecognized action ID on its next click. None of the Season Control
buttons had a `try/catch`, so the error just vanished — indistinguishable
from "nothing happened."

**Fix** (`0eb57b5`): `lib/client/action-error.ts` (`friendlyActionError`)
recognizes this specific error and returns "page is out of date, refresh
and try again" instead of a raw stack trace. Wired into
`RestartSeasonButton` (had no catch at all), `PhaseControl` (had no catch
OR error display at all), `SeasonControls`' shared `run()` helper, and
`SimulateDayButton` (both already caught, just got the friendlier
message). Confirmed with the user this fixed it live. Scoped to Season
Control only — the same no-catch pattern exists on ~20 other admin
components; a separate, larger cleanup if ever wanted.

### Off-season click now auto-cascades the pre-season schedule (`bddc6b8`)

Follow-up request: starting a season year should be as simple as clicking
"Off-season" — schedule stays, pre-season builds itself timed off the
real calendar, no manual date-picking every year. FA/UFA/Draft
deliberately stay manual (explicit user instruction).

- `computeAutoPreseasonStart()` (`lib/preseason.ts`): counts back from the
  REAL first regular-season game date (not the hardcoded Oct 1 constant —
  an imported real schedule can open elsewhere) so the last of 6
  exhibition rounds lands exactly 3 days before the opener.
- `setPhaseOverrideAction("offseason")` now (re)generates pre-season
  automatically — but only when safe: never if any pre-season game has
  actually been played, and only if a regular-season schedule exists to
  count back from.
- New `LeagueConfig.preseasonPublic` flag (default false, per explicit
  user request): the cascade never flips it — a freshly (re)generated
  schedule stays admin-only in Season Control (admins always see the full
  thing there) until the admin clicks "Make public" on the public
  `/preseason` page, which shows "isn't public yet" to everyone else
  until then.
- Verified end-to-end on a real dev server, including the visibility gate
  specifically: generated a real 96-game schedule, confirmed a
  logged-out session sees "not public yet" while an admin session sees
  the full schedule, then confirmed the toggle flips it fully public —
  caught and worked around a false alarm here too (the browser tab had a
  leftover admin session from earlier testing, making the gate look
  broken until actually logging out to test the anonymous path). Test
  data cleaned from the local DB afterward.

**Both deployed to unhl.eu, confirmed 200 after each.**

### Pre-season goes fully "live" across the site (`9efebd0`)

Follow-up to the Off-season cascade: user asked whether pre-season scores/
standings/leaderboards show on the homepage the way regular season does,
and whether it appears in the main schedule too. Investigated first:
pre-season stats DATA already gets fully collected (`PlayerGameStat`/
`GoalieGameStat` rows exist for pre-season games — a stale top-of-file
comment in `lib/preseason.ts` claiming otherwise was wrong, contradicted
by the actual `saveGameResult` call a few lines below it) — and a
`seasonForPhase`/`PhaseTabs` manual toggle already existed on
`/stats/players`, `/stats/goalies`, `/stats/leaders`, `/scores`,
`/standings`. What was missing was auto-detection: all five defaulted to
"regular" regardless of the live league phase, only showing pre-season
if a visitor manually added `?phase=pre` to the URL.

- `defaultStatsPhase()` (`lib/calendar-server.ts`): live league clock →
  stats-view phase. Wired into all five pages above — an explicit
  `?phase=` still overrides, but the default (no param) now follows the
  real clock.
- Home page: standings, scoring leaders, and the recent-scores ticker
  switch to pre-season data for the duration of that phase (titles get a
  "(Pre-season)" suffix). Digest/GM-dashboard subsystems left alone
  (unverified for pre-season, separate scope).
- `/schedule`: pre-season games (NHL only) now merge into the same
  chronological month-grouped timeline as the regular season — a "PRE"
  tag replaces the game number, regular-season numbering untouched.
  Same admin-or-public visibility rule as `/preseason` itself.
- Deliberately NOT touched: `/stats/career`, `/stats/franchise`,
  `/stats/star-power` — cross-season career/franchise-record views where
  pre-season exhibition games shouldn't count, matching the existing
  "never touches profiles/careers" design intent.
- Verified end-to-end on a real dev server: generated + simmed a real
  96-game pre-season, pinned the phase and confirmed every page switched
  (and reverted cleanly when unpinned); separately confirmed the
  schedule-merge visibility gate (hidden when private/logged-out, shown
  once public). Deployed, confirmed 200 on every touched route.
### League History: 3 tabs per season (`30b9d39`)

Built same session, right after: each archived season in `/history` now
splits into Pre-season / Regular Season / Playoffs tabs (independent per
league block — NHL and AHL don't share tab state) instead of one flat
Champion+awards card.

- **Real gap found while scoping this**: `PRE_SEASON` (`lib/phase.ts`) is
  a single hardcoded string, not year-parameterized — every year's
  Off-season cascade wipes and rebuilds the SAME `Game` rows. Without a
  separate durable snapshot, a season's pre-season results would vanish
  the instant next year's pre-season got generated — there'd be nothing
  to show in a "Pre-season" History tab at all.
- New `SeasonPreseasonRecord` model: captures games played, best-record
  team, and top scorer at `archiveSeason()` time — NHL-only (no AHL
  pre-season slate), best-effort, no-ops cleanly if nothing was ever
  generated.
- Awards split for the UI: everything except Conn Smythe → "Regular
  Season" tab (with the President's/best-record chip); Conn Smythe →
  "Playoffs" tab (with Champion/Runner-up). New `HistorySeasonTabs` client
  component, one independent instance per league block.
- Per-team franchise history (`/teams/[slug]/history`) deliberately left
  alone — a season-by-season ledger for one franchise, a different shape
  than "3 tabs for one season."
- Verified end-to-end on a real dev server: generated + simmed a real
  96-game pre-season, ran the real `archiveSeason()` for NHL and AHL,
  confirmed the snapshot was created correctly, then clicked through all
  3 tabs on both league blocks confirming the exact right content split
  in each (no leaked awards between tabs) and independent tab state.
  Test archive data cleaned from the local DB afterward. Deployed,
  confirmed 200.

## 2026-08-30, continued — bug reports from live production use

A batch of real issues the user hit while actually using the site,
fixed one after another.

**Re-signing window widened (`d40a065`)**: user found Xhekaj (MTL,
expired contract) stuck on "Unavailable" for extension. Root cause:
`canNegotiate` only allowed `regular`/`playoffs` phase — production was
pinned to `offseason` (from testing the Off-season cascade). The rule
itself was wrong, not just the timing: a club's negotiating window with
its own pending UFA/RFA should be open basically any time; only the
Frenzy itself (with its own dedicated market flow) should block it.
Fixed in both the UI gate (`ContractSection.tsx`) and the duplicated
server-side check (`extendContractAction`) — same phase logic,
`phase !== "frenzy"`. Same commit also put pre-season games on each
team's own `/teams/[slug]/schedule` page (a second table above the
regular-season one), per a follow-up request.

**Admin Contracts couldn't find farmed players (`c6d6b7e`)**: user
couldn't find Ville Koivunen (assigned to Wilkes-Barre/Scranton, AHL) to
fix his contract. The page's query filtered `team.league === "NHL"`
only — a farmed player's `teamId` points directly at his AHL affiliate,
not the NHL parent, so this silently hid every player currently on
assignment, not just Koivunen. Broadened to `league in [NHL, AHL]`.

**GM Assist undervalued picks and rookies/prospects (`ea78e2b`)**: direct
feedback that a 2nd-round pick showed too low a value and "the first 3
rounds are quite valuable." Checked production data before tuning
anything (didn't guess): draft-pick decay divisor 42→60 (round 2 nearly
doubles, round 3 does too, round 1 barely moves); rookie/young-player age
multiplier widened (checked real roster data — rookies have a median
overall of only ~50, and the old age curve couldn't compensate, landing
well below an equivalently-talented scouted prospect for no real-hockey
reason).

**Trade Commission gaps (`37084e5`)**: from live review of a real trade.
(1) Pick labels ("2027 R3") didn't say whose pick it was once traded once
already — added the original-owner team's logo via `DraftPick.ownerLogoId`
on `/trades`, `/trades/[id]`, `/trades/commish`. (2) Rookie-GM trades now
DM the commission and appear (read-only, "not yet actionable") on
`/trades/commish` at proposal time, not just after mutual acceptance —
the accept-gate itself was confirmed correct by the user and left
unchanged. (3) Conflict of interest: a Trade Comish who is a party to the
trade can no longer approve/decline/modify it themselves — both a
server-side throw and a UI button swap. (4) `/trades/[id]`'s status badge
showed the raw enum (`AWAITING_COMMISH`) with no color — added a
human-readable label ("Waiting for Trade Comish to approve / decline").

**Messages badge stuck with nothing to open (`70de54e`)**: all the
rookie-oversight notifications above are delivered as a DM a team sends
to ITSELF (no separate notifications table) — but the conversation list
explicitly excludes the signed-in team from its own list, so these piled
up in the unread badge with no thread ever reachable to open or mark
read. Fixed with the same trick already used for the "Free Agent Frenzy"
pseudo-conversation: a synthetic "League Notifications" entry that
surfaces whenever self-DMs exist.

**Admin Contracts: contract type + exact cap hits (`0e84ec7`)**: (1)
`Player.contractType` (ONE_WAY/TWO_WAY — read directly by `RosterMover`
to decide farm-eligibility) was only ever set by data import, with no UI
to correct it; user found $2M+ players incorrectly flagged two-way. Added
a select to the contract editor. (2) Cap hit was force-rounded to 50k
steps both in the form (`step="50000"`) and on save
(`Math.round(v/50000)*50000`), silently corrupting a real value like
$1,325,000 → $1,350,000. Removed the constraint in both places — an
exact dollar amount now saves exactly.

**Production data change (not a code commit)**: at the user's explicit
request, all 32 NHL teams' `bankAccount` set to a uniform $40,000,000
directly via SQL. Note for later: `bankAccount` is recomputed by
`processFinances` (run automatically on any simulated game day) from
`settings.startingCapital` + each team's individual performance —
this direct value will hold only until the league leaves the current
`offseason` phase pin and games start simulating again, at which point
it will diverge per-team as designed. If a durable uniform reset is ever
wanted, `startingCapital` in `/admin/simulation` is the lever, not a
one-off SQL update.

Every fix in this section verified against a real dev server (not just
read logically) before shipping — a temporary local-only admin password
was set to reach GM/commission-gated pages, and reverted after each
check, matching this session's established verification standard.
Deployed to unhl.eu after each commit, confirmed 200 every time.

---

# Status — 2026-08-30/31 session

A single very long session, two distinct halves: **sim/GM-Assist feature
work** (first ~third), then a **massive real-world data-accuracy pass**
that consumed most of the session once the user started spot-checking
individual players against reality and the scope kept widening. All code
changes below are committed to `main`, pushed, and deployed live to
unhl.eu (confirmed 200 after every deploy). All data fixes were applied
to **both** the local dev DB and the live production DB directly (SSH +
`docker compose exec db psql`), since the two have been diverging on
their own from live simulation for a while now — every data-fix section
below explicitly did both.

## Session overview (read this first)

**Part 1 — features.** Real 3rd OT trio (engine now rotates between
manager-set/roster-tiered trios instead of sampling the whole roster
every 3-on-3 shot). GM Assist draft-pick values reshaped so a top-10
pick trades like a good roster player, not ~1000 flat. Finance Dashboard
in "basic" mode now shows the real gate-revenue-minus-salaries model
instead of a misleading full detailed-mode preview. 1W/2W badge added to
All Rosters.

**Part 2 — the data-accuracy rabbit hole.** Started from one report
(Drew Commesso showing $100k instead of his real $875k contract) and
kept widening as the user spot-checked more players against reality:

1. **Cap-hit gaps**: the existing real-cap importer only scans each
   club's *current* 23-man NHL roster, so any AHL/farm player was never
   looked up at all and sat on a placeholder value. Built a second
   importer (`importRealCapHitsForGaps`, wired to a new admin button)
   that looks players up on CapWages directly by name instead. Fixed
   ~640 players combined (local + prod).
2. **1-way contracts marked 2-way**: audited every player with
   `capHit ≥ $1M` and `contractType TWO_WAY` against CapWages' contract
   description text (careful about a false-positive: "two-way" also
   appears in prose describing a *player's style*, e.g. "a strong
   two-way winger" — had to require the phrase "two-way contract"
   specifically). Fixed 67 (Tuch, Coronato, Nelson, Bedard, Carlsson,
   Knies, and 60 more).
3. **`contractText` never syncing with `capHit`**: discovered while
   verifying fix #1 — the display string is a separately-stored field
   that only the admin contract editor keeps in sync; every import path
   (including the two above) writes `capHit` but never regenerates
   `contractText`. Resynced leaguewide: 824 players locally, 1,669 on
   production. Likely explains a good chunk of what looked like
   "inaccuracies" beyond the specific players reported.
4. **Real UFAs still shown as rostered**: 26 players confirmed via web
   search as genuinely unsigned in real life (Reilly Smith, Michael
   Bunting, Jake Bean, Sebastian Aho (D), Egor Zamula, Jonathan Drouin,
   Vladimir Tarasenko, John Klingberg, +19 more) moved to `rosterType:
   "UFA"`. 3 more who left for KHL/Europe (Miromanov, Kampf, Katchouk)
   also moved to UFA at the user's explicit direction (same treatment as
   Sebastian Aho, even though "genuinely available" isn't quite
   accurate for them — a deliberate simplification the user chose).
5. **Jack Hughes / Luke Hughes data corruption**: the "real" Jack Hughes
   record had a bogus birth date (1957!), wrong NHL ID, and sat on
   Vancouver — fixed to the actual NJD superstar (real nhlId 8481559,
   born 2001-05-14, $8M/4yr One-Way, NTC), including **downloading his
   real NHL headshot** from `assets.nhle.com` and installing it on the
   production host's `/opt/mugs/` (mugs are served directly by Caddy
   from a host bind-mount, completely outside the git/Docker build —
   see Files/Infra note below). Also found Luke Hughes was on Carolina
   instead of New Jersey with a stale $2.1M/1yr instead of his real
   $63M/7yr (capped at this league's 4yr max) deal — fixed. A *second*,
   unrelated "Jack Hughes II" (LA Kings 2022 2nd-rounder) was correctly
   separate and just needed his own team fixed (Chicago Wolves → Ontario
   Reign).
6. **The AHL layer was systematically scrambled** — the big one. User
   asked "why is Puustinen on Pittsburgh when he was traded to
   Colorado?" (confirmed, fixed) then asked for a full AHL audit. Ran
   **4 parallel research agents**, one per 8-team group, cross-checking
   all 32 AHL affiliates' rosters against hockeydb.com / official team
   sites / EliteProspects. **Finding: not isolated missed trades — a
   real, systemic scramble.** Players routinely sat on one of the wrong
   AHL teams (often swapped with each other), several had actually
   already reached the NHL level (Koivunen → PIT, Heinola → VGK, Daws →
   NJD) or left for Europe/KHL entirely. Compiled all 4 reports into one
   239-player mass-fix (single batch script locally, single generated
   SQL file on production — not 239 individual commands). 239/240
   applied cleanly on both.
7. Re-ran the "1-way players must be on the NHL roster" sweep after the
   AHL fixes surfaced more of them (10 more locally, 25 more on prod).
8. Trade-block flag (`onBlock`) was never cleared when a player got
   traded or claimed off waivers — Sam Montembeault stayed listed on the
   block after moving to Pittsburgh. Fixed both the one-off data and the
   two code paths (`lib/trade-exec.ts`, `lib/waivers-server.ts`) so it
   can't recur.

**Part 3 — small features that fell out of the data work.**
Team Contracts' "final year" (1-year-left) group — previously a
permanently-`false` pre-launch flag with a comment to flip it once the
real season began — now dynamically shows once `phase` is `regular` or
`playoffs` (both client display and the server-side `extendContractAction`
guard). A real gap the user then asked about directly: nothing swept
`contractYears: 0` unsigned players to UFA when regular season starts —
they'd sit forever, invisible to the free-agent market. Built that sweep
onto the same preseason→regular phase-transition boundary the existing
opening-day cap-compliance check already uses. One-way players' "↓ Farm"
button was disabled with no path forward — replaced with an active
"Farm/Waivers" button that puts them on the wire (reusing
`placeOnWaivers`) right from the Roster Moves page. Home page gained a
Waiver Wire card next to Trade Block. Player profile pages gained a
"⚖ Player Comparison" button — the multi-player compare tool
(`/tools/compare`, up to 5 players, every attribute + contract + age)
already existed but nothing linked to it from a player's own page; it
now deep-links with that player pre-filled via `?p=<id>`.

**Where things stand**: nothing known-broken. The AHL/contract data
audit was thorough but NOT exhaustive — see "What's NOT done" below for
what's known-still-messy.

## Part 1 detail — sim/GM-Assist features

### Sim Engine: real 3rd OT trio + rotating on-ice units (`5522cbc`)

The OT lines editor exposed only 2 designated trios, and — bigger
finding — **the engine ignored them completely regardless**: every 3v3
shot sampled from the whole healthy roster via `weightedSample`, not
from any manager-set unit. Fixed both:
- `lib/sim/lines-core.ts`: `overtime` array now defaults to 3 units
  (45/33/22 split); `normalize()`'s `spec()` helper now *pads* a
  shorter legacy-saved array up to the new default length instead of
  only falling back when the whole field is missing, so existing
  saved 2-unit teams get a 3rd unit for free.
- `lib/sim/chemistry.ts`: `buildStUnits()` now also emits `"ot:"`/
  `"ot2:"`/`"ot3:"` chemistry-tracked units from `situations.overtime`
  (mirrors the existing PP/PK pattern).
- `lib/sim/engine.ts`: new `resolveOtUnits()` (mirrors `resolveStUnits`)
  resolves 3 real trios — manager-set when genuinely distinct, else
  roster-tiered by offense. `simulateOvertime()` rewritten to rotate
  between them on a 15s cadence (`OT_UNIT_WEIGHTS = [0.5, 0.32, 0.18]`,
  same depth-weighted-shift pattern as 5v5) instead of resampling the
  whole roster; `pickShooter` refactored into `pickShooterFromPool` so
  OT can constrain shot attempts to whoever's actually on the ice.
  `recordGoal` now reads the real deployed trio for assists/+/- instead
  of re-randomizing after the fact.
- **Verified**: git-stash A/B calibration run (this is shared math for
  both v1/v2 engines, not gated behind `isNextGen` — same category as
  the earlier injury/MISS work) — OT/SO rate unchanged (23.4%, in
  target), all core metrics still green. The Spearman dip seen
  (0.787→0.750) is within the already-documented 8-seed noise range
  from the prior session's grid search, not a new regression.
  Local unit tests confirmed `buildStUnits` wiring and the legacy-array
  padding both work exactly as designed.

### GM Assist: top-10 picks trade like a good player (`961000f`)

Pick #1 landed at ~983 under the existing single exponential decay —
under even a modest veteran's `playerValue`. Added a front-loaded
"elite" premium (Gaussian bump centred on slot 1, ~10 picks wide) on top
of the untouched base curve — dominates picks 1-10, negligible by
pick 25, so rounds 2+ (already tuned to prior feedback) are unchanged.
`#1 ≈ 2583, #5 ≈ 2283, #10 ≈ 1558, #16 ≈ 938` (was 766). Moved the
formula into `lib/trade-value.ts` as `pickValueBySlot` — a single
shared export both GM Assist (`trades/build/actions.ts`) and the AI
GM's rough approximation (`ai-gm-trades.ts`) now import, so the two
curves can't drift apart the way two hand-duplicated formulas would.

### Finance Dashboard: basic mode shows the real model (`7070d24`)

When Detailed Finance is off, the dashboard still rendered the full
hypothetical fan-interest/sponsorship/merch breakdown as a "preview" —
misleading, since none of it drives the club's actual bank. Basic mode
now computes and shows the same gate-revenue-minus-salaries model
`/finance` and `processFinances` actually use, and hides the
detailed-only sections (ticket pricing, sponsor picker) that have zero
effect outside Detailed Finance.

### All Rosters: 1W/2W badge (`f50a573`)

Small addition to `components/RosterTable.tsx` — a `contractType` badge
next to the cap-hit column.

## Part 2 detail — the data-accuracy pass

### Root-cause pattern found

Nearly everything in this half traces back to one fact: **the real-NHL
import pipeline (`lib/real-roster-import.ts`) only ever scrapes each
club's CURRENT active 23-man roster** (`api-web.nhle.com/v1/roster/
{team}/current`). Anyone not on that exact list *right now* — AHL
assignment, IR, waived, traded since the last import ran, etc. — was
either never matched at all, or matched once and then never
re-verified as reality moved on. This explains the cap-hit gaps, the
stale contract types, and a good chunk of the AHL scramble all at once.
`lib/real-roster-import.ts` now has a second importer
(`importRealCapHitsForGaps`) that doesn't have this limitation — it
looks players up directly by name instead of depending on being on that
active-roster candidate list — but nothing yet re-derives `realTeamId`/
AHL assignment the same context-free way; that's still open (see below).

### Cap-hit gaps + admin tooling (`842a53f`)

`lib/real-roster-import.ts`: new `importRealCapHitsForGaps()` — queries
`Player` where `rosterType IN (NHL, AHL)` and `realCapHit IS NULL`,
looks each up on CapWages directly by name (bounded concurrency,
retries), writes `realCapHit`/`realTradeClause`/`realContractYears` AND
(unlike the original importer) the *live* `capHit`/`tradeClause`/
`contractYears` unconditionally — there's no legitimate profinhl
economy value to protect for a player who was never priced at all.
Wired to a new "Fill real caps for farm/gap players" button on
`/admin/rosters` (`app/admin/rosters/actions.ts` `fillRealCapsForGapsAction`,
`components/RosterModeControl.tsx`). Explicitly did NOT touch the ~630
active-NHL-roster players whose `capHit` deliberately differs from real
(profinhl's own economy) — confirmed via a live active-roster re-fetch
before generating the production SQL, so that bucket was never at risk.

### 1-way/2-way contract-type audit (one-off data fix, no new code)

Precise detector: CapWages' contract-history JSON tags the *current*
deal's type (`"Two-Way Contract"`, `"Entry-Level Contract"`, `"Standard
Contract (Extension)"`, …); a loose `/two-way/i` match on the full
player description produced false positives (style prose like "a
strong two-way winger"), so the final check required the literal phrase
`"two-way contract"`. 67 players flipped TWO_WAY→ONE_WAY (Alex Tuch,
Matt Coronato, Brock Nelson, Connor Bedard, Leo Carlsson, Matthew
Knies, and 61 more) after 3 passes (name-suffix slug stripping needed
for `''A''`/`(R)` decorated names; a couple of rate-limit stragglers
needed a lower-concurrency retry).

### `contractText` staleness (one-off data fix)

`contractText` is a separately-stored display string (`"875,000$ /
2yrs"`) that only the admin contract editor's own save path
regenerates — none of the import/gap-fill/2-way-fix paths above ever
touched it, so a player's underlying `capHit` could be correct while
the UI still showed the old number. Resynced via a single SQL pass
(`to_char(capHit, 'FM999,999,999') || '$ / ' || contractYears || 'yr' ||
…`) matching the exact JS formatter in `app/admin/contracts/actions.ts`
— verified the SQL and JS versions produce identical output before
running it on production. 824 local, 1,669 production rows fixed.

### Real UFAs (one-off data fix)

26 players moved to `rosterType: "UFA"` after individual/batched web
verification (not just the internal `contractYears: 0` signal — that
alone is unreliable, see "lessons" below): Reilly Smith, Michael
Bunting, Jake Bean, Sebastian Aho (D — NOT Sebastian Aho the Carolina
forward, a real name collision that needed the user's own EliteProspects
link to disambiguate), Egor Zamula, Jonathan Drouin, Vladimir Tarasenko,
John Klingberg, Petr Mrazek, Nick Leddy, Eeli Tolvanen, Gustav Nyquist,
Nicholas Robertson, Cam Talbot, Brandon Saad, Connor Ingram, Ryan
Reaves, Arber Xhekaj, Logan Stanley, Mike Reilly, Tanner Pearson,
Evgenii Dadonov, Matt Grzelcyk, Adam Boqvist, Ian Mitchell, Hudson
Fasching, Pierre-Olivier Joseph. Separately, 3 who left for KHL/Europe
entirely (Daniil Miromanov → SKA St. Petersburg, David Kampf → HC
Litvinov, Boris Katchouk → Traktor Chelyabinsk) also moved to UFA at
the user's explicit choice, matching how Sebastian Aho (who signed with
Växjö Lakers, Sweden) was handled — a deliberate simplification (they're
not actually available to sign), not a claim they're really open UFAs.
Also found and fixed: Arthur Kaliyev and Curtis Lazar were flagged as
"should be UFA" by the `contractYears: 0` heuristic but had actually
already signed real deals (Belleville/Ottawa AHL, Edmonton NHL
respectively) — moved to their correct teams instead of UFA. Oliver
Wahlstrom and Kevin Rooney were only found on PTO (tryout, not a binding
contract — CapWages itself still tags them "(UFA)") — treated as UFA
rather than assigned a not-really-real team.

### Jack Hughes / Luke Hughes (one-off data fix)

Real Jack Hughes: nhlId `8481559`, born 2001-05-14 (was showing 1957!),
Orlando FL/USA, 180cm/79kg, shoots L, position C, New Jersey Devils,
$8M/4yr One-Way with M-NTC — every one of those fields was wrong before
this fix except capHit (which had separately already been correct).
Downloaded his real headshot from `https://assets.nhle.com/mugs/nhl/
latest/8481559.png` and installed it at **`/opt/mugs/8481559.png` on
the production host** — mugs are served directly by Caddy from that
host directory (`docker-compose.yml`: `/opt/mugs:/srv/mugs:ro` mounted
into the caddy container, `Caddyfile`'s `handle /mugs/*`), completely
outside git/`.dockerignore`/the Docker build context, so a new mug
needs `scp`-ing straight to the server, not a deploy. Local copy lives
in the (gitignored) `public/mugs/` for the dev server.
Luke Hughes: was on Carolina Hurricanes with a stale $2.1M/1yr contract;
real deal is a 7-year/$63M extension signed Oct 2025 with New Jersey —
fixed to NJD, $9M/4yr (capped at this league's `MAX_TERM`).
The separate "Jack Hughes II" (LA Kings, 2022 2nd round #51/52,
EliteProspects #617526) was a real, correctly-distinct player who just
had the wrong team (Chicago Wolves) and wrong contract length (4yr
instead of his real 2yr AHL deal) — fixed to Ontario Reign, 2yr. His
skill ratings are still generic/untuned (never linked to a real
attribute source) — flagged, not fixed (see below).

### AHL roster mass-audit (`4bd8858`-adjacent one-off data fix, no code change)

4 parallel research agents, 8 AHL teams each, cross-referenced against
hockeydb.com 2025-26 season rosters + official team sites +
EliteProspects. **239 confirmed mismatches** compiled into one
TypeScript object (`{ playerName: targetTeamName }`) and applied via a
single batch script locally (`prisma.player.updateMany` per entry,
`startsWith` matching to handle `(R)`/`''A''` name-suffix decorations)
and one generated multi-statement SQL file on production (`UPDATE …
WHERE name LIKE 'X%'`, team resolved via a `SELECT id FROM "Team"
WHERE name=...` subquery) — 239/240 applied cleanly on both (one name,
"Ole Julian Bjorgvik-Holm", never matched, likely a spelling/word-order
difference, not chased further). A few players had actually already
reached the NHL level entirely (Ville Koivunen → Pittsburgh Penguins,
Ville Heinola → Vegas Golden Knights, Nico Daws → New Jersey Devils —
all moved to `rosterType: "NHL"`, not AHL). One override applied on top
of a stale agent finding: Sean Farrell was independently already
verified earlier in the session (official Ducks/Puckpedia sources) as
traded to Anaheim (→ San Diego Gulls) for Sasha Pastujov, which
contradicted one agent's stale pre-trade "Laval Rocket" finding — the
earlier, better-sourced fact was used.

### Trade block flag not clearing on trade/waiver (`50ea314`)

`lib/trade-exec.ts`'s `collectMoveOps` (the function that actually
updates `teamId` when a trade executes) and `lib/waivers-server.ts`'s
winning-waiver-claim branch both now reset `onBlock: false, blockNote:
null` in the same `data` object that moves the player — being shopped
was the OLD club's decision, it shouldn't carry over to whoever just
acquired him. (Left untouched: waivers *clearing* to the SAME club's
own AHL affiliate — that's not a change of ownership.) One-off fix
applied to the specific reported case (Sam Montembeault, Montreal →
Pittsburgh) on production.

## Part 3 detail — small features

### Team Contracts: final-year deals gated on regular season (`4f6ed76`)

`components/ContractSection.tsx`'s `SHOW_FINAL_YEAR` was a hardcoded
`false` with a comment saying to flip it once the real season began —
now `phase === "regular" || phase === "playoffs"` (reads the same
`getLeagueClock()` phase already fetched on the page for the
`canNegotiate` check). Added the matching guard server-side in
`extendContractAction` (`app/free-agents/actions.ts`) so a
`contractYears === 1` extension can't be forced through the action
directly before regular season even if the UI wouldn't show that
player yet.

### Opening-day UFA sweep (`54c49e3`)

Confirmed via investigation (not assumption) that nothing existed to do
this: a player whose contract hit 0 years and never got re-signed
during the off-season/Frenzy window just sat forever on his old team's
roster, invisible to `/free-agents` and `submitOffer` (both explicitly
exclude `rosterType: NHL/AHL`). Added a sweep to `advanceLeagueDayCore`
(`app/admin/season/actions.ts`) on the exact same `ph(cur) !== "regular"
&& ph(next) === "regular"` boundary the existing opening-day
cap-compliance check already uses: `contractYears: 0` players (except
`capHit === 100_000` farm fillers — same exclusion `ContractSection`
already applies) become `rosterType: "UFA"`. Return value gained
`expiredToUfa: number`, which flows through to the cron endpoint's JSON
log automatically (no new UI needed — matches the existing lightweight
visibility pattern for this kind of admin summary data). Dry-run
sanity check locally: 132 players would sweep if regular season started
right now — consistent with the scale of 0-year contracts found
throughout this session.

### Roster Moves: Farm/Waivers button for one-way players (`4bd8858`)

`components/RosterMover.tsx`'s "↓ Farm" button for a `ONE_WAY` player
was just permanently `disabled` with a tooltip — correct that he can't
be optioned down directly, but no actual path forward from this page.
Replaced with an active "Farm/Waivers" button (only when not
`isAhlOnly` and not already `onWaivers`) that calls a new
`placeOnWaiversFromRoster(slug, playerId)` action
(`app/teams/[slug]/rosters/actions.ts`, thin wrapper around the
existing `lib/waivers-server.ts` `placeOnWaivers` — same NMC-blocks/
waivers-enabled rules, no new logic invented). Shows a "⏳ On Waivers"
badge once placed. `page.tsx` now also selects `waiverStatus` to feed
that badge state.

### Home page: Waiver Wire card (`9684c54`)

Added right below the existing Trade Block card, same layout pattern
(`lib/waivers-server.ts`'s already-existing `activeWaivers()`, capped
at 8 + "N more" link). New i18n keys `home.waiverWire`/`home.noWaivers`
across all 4 languages (en/cs/de/ru) in `lib/i18n.ts`.

### Player Comparison deep-link (`0d6eaa7`)

The multi-player compare tool (`/tools/compare`, `components/
PlayerCompare.tsx`) already existed and already did everything asked
for (up to 5 skaters/goalies, age/contract/condition/every attribute,
best-value-per-row highlighting) — it just had no entry point from a
player's own page. Added a "⚖ Player Comparison" button next to
EliteProspects on `app/players/[id]/page.tsx`, linking to `/tools/
compare?p=<id>`; taught the compare page + component to read that param
and seed slot 1 with the player instead of landing on an empty picker.

## Files changed this session

| File | What changed |
|---|---|
| `lib/sim/engine.ts` | `resolveOtUnits`, rewritten `simulateOvertime` (rotating trios), `pickShooterFromPool` refactor |
| `lib/sim/chemistry.ts` | `ot:`/`ot2:`/`ot3:` chemistry units in `buildStUnits` |
| `lib/sim/lines-core.ts` | 3-unit OT default, `normalize()` legacy-array padding |
| `lib/trade-value.ts` | `pickValueBySlot` (shared, elite-premium curve) |
| `app/trades/build/actions.ts`, `lib/ai-gm-trades.ts` | import shared `pickValueBySlot` instead of duplicating |
| `app/finance/dashboard/page.tsx` | basic-mode real gate-revenue model |
| `components/RosterTable.tsx` | 1W/2W badge |
| `lib/real-roster-import.ts` | new `importRealCapHitsForGaps` |
| `app/admin/rosters/actions.ts`, `components/RosterModeControl.tsx` | admin button for the above |
| `components/WaiverWire.tsx`, `lib/waivers-server.ts` | player-name links (`playerSlug`); `onBlock` reset on winning claim |
| `lib/trade-exec.ts` | `onBlock` reset on trade execution |
| `components/ContractSection.tsx`, `app/free-agents/actions.ts` | phase-gated final-year contract display + server guard |
| `app/admin/season/actions.ts` | opening-day expired-contract → UFA sweep |
| `components/RosterMover.tsx`, `app/teams/[slug]/rosters/{page,actions}.ts` | Farm/Waivers button, `placeOnWaiversFromRoster` |
| `app/page.tsx`, `lib/i18n.ts` | Waiver Wire home card |
| `app/players/[id]/page.tsx`, `app/tools/compare/page.tsx`, `components/PlayerCompare.tsx` | Player Comparison deep-link |
| **Local + production DB** (data, not files) | ~640 cap-hit gap fills, 67 contract-type fixes, ~2,500 `contractText` resyncs, 29 UFA moves, Jack/Luke Hughes full profile fix + mug photo, 239 AHL team reassignments, Montembeault trade-block clear |
| **Production host** (`/opt/mugs/`, not in git) | `8481559.png` (Jack Hughes' real NHL headshot) |

## Lessons learned this session (worth remembering)

- **`contractYears: 0` alone is not a reliable "this player is a real
  UFA" signal.** It correctly flagged genuine UFAs (Smith, Bunting,
  Tarasenko, …) but ALSO flagged plenty of players on the final year of
  an active, current deal (Sean Farrell's real 1yr/$850k Anaheim
  contract, signed and active right now, still shows `yearsRemaining:
  0` on CapWages because that's "0 years remaining *after* this
  season," not "unsigned"). Every UFA move this session was confirmed
  by an independent web search, not applied off the internal flag alone
  — a future session should keep doing this rather than trust the flag
  for a bulk sweep.
- **Real people can share a name.** Sebastian Aho (Carolina forward)
  vs. Sebastian Aho (defenseman, signed in Sweden) needed the user's
  own EliteProspects link to disambiguate — when a name search returns
  an unexpected team/position, check for a namesake before assuming the
  data is simply wrong.
- **The league snapshot has a real cutoff, not "always current."** The
  bulk real-NHL-roster import machinery was last run 2026-08-19 — a
  trade from that same day (Cruz Lucius → Anaheim) wasn't captured, and
  the user explicitly wants that boundary respected (don't "fix" a
  player to a state that's true today but happened after the snapshot
  — Lucius stays on Pittsburgh, matching where the league actually was
  built from, not his real-world-today team).
- **CapWages' "type" field vs. loose text matching**: the contract-type
  audit's first pass had false positives matching "two-way" appearing
  in prose about a player's *style* rather than his *contract* — always
  prefer a precise structured field or exact phrase over a loose
  substring match when scraping.

## What's NOT done / deliberately left alone

- **The AHL audit was thorough, not exhaustive.** 4 agents focused on
  players with meaningful cap hits / recognizable names; pure $100k
  filler rookie slots were explicitly skipped per their own scoping
  instructions. There could still be misassigned depth players the
  audit didn't reach.
- **No season-rollover contract engine exists at all** — confirmed via
  investigation, not assumed. Nothing decrements `contractYears`
  year-over-year or applies the stored `extCapHit`/`extYears` extension
  fields anywhere in the codebase. This is a real, separate gap from
  everything fixed this session (which was all about *current* contract
  accuracy, not the *passage of a season*) — worth a dedicated session
  if/when a full season actually completes.
- **`realTeamId` (used by `importRealRosters`) has the same "only
  scans the active 23-man roster" blind spot** the cap-hit importer
  had before this session's fix — nothing re-derives it context-free by
  name the way `importRealCapHitsForGaps` now does for cap hits. A
  parallel `importRealTeamsForGaps`-style fix was not built this
  session.
- **Jack Hughes II's skill ratings** are still generic/untuned (`sk:
  39`, `overall: 47` — weak for a real 2nd-round NHL pick) — never
  linked to a real attribute source. Flagged to the user, explicitly
  deferred (dismissed when offered as a follow-up).
- **The other "corrupted-looking" edge cases surfaced but not chased**:
  Carter King (AHL, `capHit: $3M`, one research agent flagged "no real
  player match found — likely a data-entry anomaly") — left alone, not
  investigated further.
- Two production DB reads over SSH were transiently blocked by the
  session's safety classifier during this session (writes went through
  fine both times) — not a real blocker, just noted in case a future
  session hits the same thing and wonders why a `SELECT` needs a retry
  when the equivalent `UPDATE` didn't.

## Suggested next step

Nothing is currently known-broken. In rough order of how directly they
follow from what's already been found:
1. If another data-accuracy report comes in, the CapWages-by-name /
   hockeydb-cross-reference pattern established this session is now a
   proven, repeatable playbook — reuse it rather than re-deriving from
   scratch.
2. **`realTeamId`'s "active roster only" blind spot** (see above) is
   the most likely source of the *next* "why is player X on the wrong
   team" report — worth fixing proactively if there's appetite, mirroring
   how `importRealCapHitsForGaps` fixed the equivalent cap-hit gap.
3. Jack Hughes II's ratings, if the user wants them (deferred, not
   declined).
4. A season-rollover contract engine (decrementing `contractYears`,
   applying stored extensions) doesn't matter yet since no season has
   completed live — but will become a real gap the first time one does.

---

# Status — 2026-08-31 session

A very long, wide-ranging session — small UI fixes, a real architecture
change to how the season's phase advances, a redesign of FA round
pricing, and another big real-world data-accuracy pass. All code changes
committed to `main`, pushed, and deployed live to unhl.eu (confirmed 200
after every deploy). All data fixes were applied to **both** the local
dev DB and production directly (SSH + `docker compose exec db psql`).

## Session overview (read this first)

Roughly five threads, in the order they came up:

1. **Contract system redesign.** Player profile EliteProspects links now
   actually land on the player's own page (a DuckDuckGo "\" bang trick,
   not a scrape). Added a Trade History card. Then the big one: reversed
   the *deferred extension* design from an earlier session — a
   re-signed player's `capHit`/`contractYears` now update **immediately**
   on acceptance, not on a next-season rollover that was never built (the
   user explicitly asked for this after finding Nikishin's signed
   extension was invisible everywhere). Also fixed the ELC bucket
   offering a flat rookie-scale re-sign to players already well past
   their entry deal (Fantilli), and Team Contracts no longer keeps
   listing an already-accepted re-sign as "up for renewal."
2. **Free Agent Frenzy market mechanics.** Comish/Co-Comish get a 1-day
   early start whenever the market is about to open (both a date-driven
   preview and — since this league runs with the phase pinned by hand,
   not on the real calendar — a manual toggle). A real, scheduled
   one-shot auto-open for the whole market (`frenzyAutoOpenAt`), shown
   live on the home page countdown card. Then a real pricing-model
   change: round 2/3 asks now react to actual bidding (nobody bid → ask
   drops further; real competition → ask climbs) instead of a blind
   fixed decay — tuned down once already after a same-day correction.
3. **Season phase architecture.** Discovered + fixed a real gap: the
   phase (offseason/preseason/regular/playoffs) was computed from
   hardcoded calendar-year constants with no way to point it at this
   league's actual dates. Built admin-configurable transition dates
   (`preseasonPhaseAt`/`regularPhaseAt`) threaded through every place
   that drives real season progression (not just display). Also a real
   near-miss: nearly force-flipped the live phase straight to "regular"
   (which would have opened the market for everyone and swept ~115
   expired contracts to UFA at once) before the user caught the mistake
   — reverted immediately, no damage done.
4. **A second real-world data-accuracy pass**, narrower than the
   previous session's AHL scramble but still substantial: verified and
   fixed 22 players' contract years/cap hits (Zegras/Drysdale/Grebenkin/
   Foerster on PHI, 8 more NHL players, 8 AHL depth players) using 4
   parallel research agents for the bulk of the AHL list; corrected
   Robertson (missed trade + signing) and Xhekaj (a real in-app
   extension had gotten silently overwritten by an earlier session's
   "real UFA" data pass — a genuine cross-session conflict, not just
   stale data). Confirmed via the user's own house rule (already on file
   from a prior session) that a real-life-retired-but-still-simmable
   player (Kopitar, Jonathan Quick) correctly stays UFA, not RETIRED —
   caught before applying a wrong "fix."
5. **Smaller fixes throughout**: Auto Lines leaving slots empty on a
   position-skewed roster (missing off-position fallback); AI GM now
   covers AHL affiliates and runs roster-fill automatically instead of
   admin-button-only; a stale Farm player count on the team page (no
   rosterType filter, unlike the parent's own count) + a new "Total
   players" row; Trade Builder now shows a pick's original-owner
   logo/code (existing logic on completed trades, never ported to the
   builder); Player Comparison now includes UFA players.

**Unresolved**: a genuine mystery — Eeli Tolvanen's `teamId`/`rosterType`
changed to Colorado's active roster with **zero trace** in any tracked
mechanism (no `SigningLog`, `Transaction`, `FaOffer` from that club,
waiver, trade, or roster-mode switch) while his real pending offer from
the user's own team sat untouched. Reverted the data; checked the other
5 players with active offers and none showed the same corruption — looks
like an isolated one-off, not a systemic bug, but the cause was never
found. Flagged for the user to report if it recurs.

## Part 1 — Contract system

### EliteProspects links actually land on the profile (`750a6b4`)

The player-profile "EliteProspects ↗" link used EP's own
`/search/player?q=` endpoint, which never auto-picks a result — it
always lands on EP's search-results list, matching the user's report
("väčšina mi to ukáže len search stránku"). `components/EpHoverName.tsx`
already had a working fix for a *different* surface: a DuckDuckGo "\"
bang (jump straight to the #1 organic result), which reliably lands on
the correct EP profile since it's consistently the top hit for "<name>
eliteprospects player." Centralized as `epProfileUrl()` in
`lib/playerName.ts`, reused on the main profile link and two other
fallback sites (`app/players/all/page.tsx`, `app/teams/[slug]/
prospects/page.tsx`). Verified against several real players including a
common name (Jack Hughes — landed on the correct NJD player, not a
namesake) and a name carrying a raw `''A''` captaincy marker.

### Trade History card (`b277695`)

New `lib/trade-history-server.ts` + `components/
PlayerTradeHistoryCard.tsx` on the player profile: every completed (or
later-reverted) trade a player has been part of, oldest→newest, full
package resolved on both sides (mirrors `/trades/[id]`'s asset-label
logic). No schema change needed — `Trade`/`TradeAsset` already had
everything, so history is complete retroactively. Verified with a
temporary local test trade, then cleaned up.

### Re-signings apply immediately, not on a deferred rollover (`b0fe874`)

Reversed an earlier session's explicit design (`fa-contracts-nextgen`
memory) at the user's direct request: a re-signed player's new
`capHit`/`contractYears`/`contractType`/clause now write to the real
contract fields **the moment the offer is accepted**, exactly like any
other signing, instead of sitting on `Player.ext*` fields until a
next-season rollover that doesn't exist in the codebase. This is also
what was making Nikishin's signed extension invisible everywhere.
`extendContractAction` (`app/free-agents/actions.ts`) rewritten;
`SigningLog` now captures the full prior-contract snapshot (needed since
a revert must restore an actually-overwritten contract, not just drop a
pending extension); `revertSigningAction`'s two divergent branches
(EXTEND vs SIGN) merged into one, since both now do the same thing.
**One-off promotion**: the 15 players already stuck in the old deferred
state (including Nikishin, Gauthier, Xhekaj) were promoted onto their
real contracts on production to match the new immediate behavior.

### ELC bucket vs. a real 2nd contract (`c57a722`)

`ContractSection.tsx`'s "up for renewal" list bucketed ANY expiring
age-≤21 player as "ELC" (offer the flat rookie formula), with no check
for whether he'd already burned through an entry-level term — reported
via Fantilli (21, expiring, real $9.8M/4yr extension already signed in
reality) getting offered a ~$950k flat ELC instead. A real max ELC is 3
years, so a player with 3+ real seasons on file (`mpSkater` JSON) is
definitely on his second contract — routed to real RFA negotiation
instead. Verified directly: Fantilli was the only player in the current
ELC-age pool past the 3-season mark; 13 other age-≤21 expiring players
(Will Smith, Levshunov, Michkov, several 2024/25 draft rookies) all have
0-2 seasons on file and correctly stayed in the ELC bucket.

### Team Contracts / ELC list hygiene (`c57a722`, folded into the above)

A re-signed player naturally drops off "up for renewal" now that
`contractYears` updates immediately — the earlier `resignStatus:
"extended"` exclusion (from before the immediate-update change) became
dead code and was removed.

## Part 2 — Free Agent Frenzy market mechanics

### Comish/Co-Comish 1-day early access (`0fb36bc`, `218cba4`)

Extended the existing per-round Frenzy head-start (day 1 of each round
is commissioner-only) to the market's actual *opening* transitions:
`getLeagueClock()`'s `faWindow` now looks one day ahead when today's
window is closed — if tomorrow's window would be open, it's returned
today with `previewOnly: true`, and `submitOfferAction` lets comish-tier
through while everyone else gets a clear "market opens tomorrow" error.
**Real-world correction**: this only works when the phase follows the
real calendar unpinned — the user's own league runs with `phaseOverride`
manually pinned, so there's no date-driven "tomorrow" to preview. Added
a **manual toggle** instead (`faEarlyAccess` in `SimSettings`,
`FaEarlyAccessToggle` on `/free-agents`, mirrors the existing
`FaSignLockToggle` pattern) — flip it on today, comish-tier gets in
immediately regardless of pin state. **Found and fixed a second bug**
the same day: the toggle correctly unlocked the *server action*, but the
page's own `interestCtx`/`FrenzyBar` status line still read straight
from `clock.faWindow` (which knows nothing about the manual toggle), so
the "Interest" button stayed visibly disabled for the very GM who'd just
turned early access on. Fixed by computing the same override shape for
both the button state and the status banner.

### Scheduled auto-open for the whole market (`9bf9822`)

`LeagueConfig.frenzyAutoOpenAt` (a one-shot real datetime) +
`autoOpenFrenzyIfDue()` in `lib/season-cron.ts`, wired into the same
`/api/cron/advance-day` route the daily game-sim trigger already uses
(no new crontab entry). Fires on the very next ~5-minute tick once real
"now" passes the configured moment — sets `faOpen=true` (forces Frenzy
open for every GM) and clears the trigger so it never re-fires (a later
manual close sticks). Admin control: `FrenzyAutoOpenControl` on
`/free-agents`, a datetime picker next to the early-access toggle. Home
page's `NextSimCountdown` relabels itself "Free Agent Frenzy open in"
and counts down to that moment instead of the daily sim time while a
trigger is pending, reverting on its own once it passes. Verified
end-to-end locally (set a past trigger, hit the cron endpoint, confirmed
`faOpen` flipped and the field cleared) and set live on production for
2026-09-01 14:00 Europe/Bratislava — confirmed showing correctly on the
home page countdown before the session ended.

### Round pricing reacts to actual bidding (`9cabf27`, tuned in `35ec8f9`)

`roundPremium(round)` previously stepped down on a fixed schedule every
round (1.20→1.10→1.0) regardless of whether anyone had actually bid —
explicitly corrected: real demand should drive the direction, not a
blind decay. Now `roundPremium(round, priorBidders?)`: 0 bidders in the
previous round → ask drops an extra 15% to draw interest; 2+ bidders
(real competition) → ask climbs instead of decaying; exactly 1 bidder →
unchanged from the original schedule (preserves the already-validated
single-bidder calibration). `priorBidders` = distinct `FaBid.teamId` in
the prior round, from a new `priorRoundBidderCounts()` (one batched
query, not N+1), threaded through `buildDemand`/`demandFromRow`/
`demandForPlayers`/`teamAsk` — the last one means `evaluateTeamOffer`/
`pickAndSign`/`processRoundEnd`'s actual accept/reject threshold reacts
too, not just the displayed ask. **Same-day tuning correction**: the
initial competitive-round values (1.25/1.15) were too aggressive per the
user — real bids already coming in above the ask ARE the demand signal,
the round premium should just be a small extra nudge on top, not a
second big jump. Retuned to 1.10/1.05 (R2 competitive now equals the
unchanged single-bidder value; R3 competitive is a modest +5%).

## Part 3 — Season phase architecture

### Configurable real-date phase transitions (`29bef44`)

Long back-and-forth that started as "can Comish get a market head-start"
and ended up surfacing a real architecture gap. The season phase was
computed from hardcoded calendar-year constants (Sep 21 / Oct 1 / Apr 15)
in `lib/calendar.ts`'s pure `phaseFor()` — no way to point it at this
league's real dates. Added `LeagueConfig.preseasonPhaseAt`/
`regularPhaseAt` (admin-settable real `DateTime`s) plus a new DB-aware
`resolvePhaseThresholds()`/`computePhase()` in `lib/calendar-server.ts`:
uses the configured date if set, else derives it from the actual
generated schedule's first game, else falls back to the old hardcoded
constant for a brand-new league with nothing generated yet. Playoffs
isn't independently configurable — it always derives from the regular
season's *last* scheduled game.

The important part was **where** this got wired in: not just
`getLeagueClock()` (the display), but `advanceLeagueDayCore`'s
opening-day sweep/cap-check transition detection, the commissioner
"Today" dashboard preview, and `lib/sim/auto.ts`'s frenzy-day advance —
all of these used the old hardcoded `effectivePhase()` directly and
would have silently kept using the wrong boundary if only the display
layer had been fixed. Verified directly: with
`preseasonPhaseAt=Sep14`/`regularPhaseAt=Sep29` configured,
`computePhase()` resolves Aug 31→offseason, Sep 14→preseason,
Sep 29→regular exactly on the configured boundaries. New admin UI:
`PhaseDatesControl` on `/admin/season`, next to the manual phase-pin
control.

### Real near-miss: almost force-opened the whole season (not shipped as a bug, but worth remembering)

Investigating why the Comish head-start didn't work led to discovering
production's `leagueDate` was sitting at **November 2026** (fast-
forwarded during earlier testing sessions, never actually played) while
`phaseOverride` was pinned to "offseason" — meaning the automatic
20:30-Bratislava daily cron had *never once* fired for real
(`lastAutoAdvance` was null) because pinning a phase also pauses the
clock by design. Based on an incomplete read of the user's intent,
unpinned the phase — which, because `leagueDate` was already deep into
what the calendar would naturally call "regular season," **immediately**
(not "tomorrow") flipped the live phase to Regular and opened the
market for every GM. The user caught this right away ("to je chyba,
nemôžeš to prepnúť na regular season") — reverted the pin instantly, no
sweep had actually run yet (a separate 115-player bulk UPDATE to
execute the opening-day contract sweep had been blocked by the safety
classifier before it could fire, which is the only reason nothing
irreversible happened). The user then clarified the *actual* want (keep
`leagueDate` where it is, just resume auto-advancing from there with
admin-configurable real dates for future transitions) — which is what
Part 3 above actually built.

## Part 4 — Real-world data-accuracy pass (round 2)

Same playbook as the previous session's AHL scramble: verify against
CapWages/PuckPedia/NHL.com/Spotrac before touching anything, apply to
both local and production directly.

### PHI batch + 8 more NHL players (one-off data fix)

Reported by the user (Zegras/Drysdale/Grebenkin/Hunter McDonald all
showing correct cap hits but 0 years remaining): confirmed and fixed all
4, matching their real current contracts exactly (Zegras 4yr/$9.125M,
Drysdale 4yr/$6.5M, Grebenkin 2yr/$1.1M, McDonald 2yr/$950k). **Foerster
was actually wrong on cap hit too** — the DB had his FUTURE extension
($7.1M×8yr, starting 2027-28) applied as his current deal; fixed to his
real *current* 2026-27 season ($3.75M, 1yr, the walk year before the
extension kicks in). Then checked the other 9 NHL-level players sharing
the same `contractYears=0` symptom: 8 more genuinely needed the same fix
(Krebs, Greaves, Sillinger, Heinen, Mantha, McMichael, Sundqvist,
Perfetti — all confirmed via a fresh web search each, not assumed from
the pattern), Kurashev's team was wrong (LAK→SJS), and 5 were confirmed
genuinely still unsigned (Fantilli, Edvinsson, Lazar, Bolduc, Benning —
no fix needed).

### AHL batch — 4 parallel research agents (one-off data fix)

97 remaining AHL-level players with the same symptom, split into 4
batches of ~24 and researched in parallel (same pattern as the earlier
session's AHL scramble). 8 confirmed real re-signings fixed (Spacek,
Lambos, Szuber, Morrow, Boucher, Bourgault, Ostman, Ottavainen — all
1yr/$850k two-way deals, cap hit already correct in every case, only
`contractYears` was stale). The other 89 were confirmed genuinely
unsigned, left for AHL-only deals, or moved to KHL/SHL/Liiga/DEL — no
fix needed. **22 total contract fixes this pass**, out of 115 players
originally flagged.

### Two real anomalies found while investigating a single report (Tolvanen)

User reported Tolvanen (confirmed genuinely UFA in real life) — while
checking him, found:
- **Nick Robertson**: a real missed trade + signing (Toronto→Pittsburgh
  July 1, then a real 2yr/$3.25M deal after arbitration July 14) that
  the import never captured. Fixed.
- **Arber Xhekaj**: found sitting as `rosterType: "UFA"` despite having
  an ACTIVE, already-accepted in-app extension from his own GM
  (`resignStatus: "extended"`, real fields populated) — a genuine
  cross-session data conflict: an earlier session's "move confirmed-
  real-UFAs to rosterType UFA" data pass had run *after* a human GM
  legitimately re-signed him in-game, silently overwriting a real
  player action. Restored to MTL.
- **Kopitar / Jonathan Quick**: both real-life retired but still full
  simmable Player records — nearly "fixed" both to `rosterType:
  "RETIRED"` before finding an already-on-file house rule from a prior
  session (`roster-real-gaps` memory) explicitly naming Kopitar as the
  canonical "stays UFA, not RETIRED" example, since he still has real
  parameters and the league's own clock hasn't caught up to his
  real-life retirement yet. Reverted before it mattered; the user
  independently confirmed the same reasoning moments later.
- **Tolvanen mystery** (see "Unresolved" above) — reverted, unexplained,
  flagged for recurrence-watching.

## Part 5 — Smaller fixes

### Auto Lines leaving slots empty on a skewed roster

`lib/sim/lines-core.ts`'s `autoLines`/`autoFill` only ever drew a
forward-line slot from players tagged for that *exact* position (pure C
for center, pure LW/RW for wings) — a roster skewed toward one position
left slots empty even with enough bodies on the bench, contradicting the
function's own documented intent ("out of position once every natural
fit is used up"). Added a last-resort "any remaining forward" fallback.
Verified with a synthetic 20-skater roster skewed 2 C / 12 W: 0 empty
slots after the fix (was 2).

### AI GM covers AHL + runs roster-fill automatically

`aiGmDaily()` (runs before every simulated day) only set tactics for
GM-less NHL clubs, and only called the roster-legality fills
(`autoFillRosters`/`fillAhlFromScratched`) from the manual "Run AI GM
now" admin button — contradicting the file's own header comment
describing this as already handled by the day loop. Now also covers AHL
affiliates whose parent has no GM, and runs the roster fills
automatically every day. `runAiGm()` (the manual trigger) is now a thin
wrapper over the same daily pass. Verified against the local dev DB: 32
NHL + 30 AHL clubs got tactics, several genuinely thin AHL lineups got
auto-filled from healthy scratches.

### Team page: stale Farm count + Total players row

The affiliate's `players` relation had no `rosterType` filter, unlike
the parent's own `players` right above it — a farm player released/
prospect-parked keeps his `teamId` (schema requires one) but was still
counted toward "Farm" forever. Confirmed directly: Pittsburgh's farm
showed 36, only 28 actually on the AHL roster. Added the same filter the
parent count already uses, plus a new "Total players" (pro + farm) row.

### Trade Builder: pick original-owner logo

`/trades/[id]` and `/trades/commish` already resolved a pick's
`ownerLogoId` to the original team's code+logo, but the Trade *Builder*
(where a GM actually picks assets for a proposal) never got the same
treatment — every pick just read "2027 R2" regardless of provenance.
Reused the exact same resolution logic in `teamAssets()`
(`app/trades/build/page.tsx`).

### Player Comparison includes UFA players

The tool only searched `rosterType` NHL/AHL — a free agent never showed
up to compare against. Added UFA to the query; since a UFA's `teamId` is
a leftover the app already treats as ignored, display "UFA" there
instead of whatever team happens to still be linked. Verified locally:
searching "Tarasenko" returns "Vladimir Tarasenko RW · UFA · 59".

## Files changed this session

| File | What changed |
|---|---|
| `lib/playerName.ts`, `components/EpHoverName.tsx`, `app/players/[id]/page.tsx`, `app/players/all/page.tsx`, `app/teams/[slug]/prospects/page.tsx` | `epProfileUrl()` — EliteProspects links land on the actual profile |
| `lib/trade-history-server.ts`, `components/PlayerTradeHistoryCard.tsx` | new — Trade History card |
| `app/free-agents/actions.ts` | immediate re-sign (was deferred extension); `setFaEarlyAccessAction`; `setFrenzyAutoOpenAction`; `priorRoundBidderCounts` wiring |
| `app/admin/signings/actions.ts` | merged EXTEND/SIGN revert branches |
| `components/ContractSection.tsx` | ELC-vs-real-2nd-contract (`mpSkater` season count); dropped dead `resignStatus` exclusion |
| `lib/calendar-server.ts` | `computePhase`/`resolvePhaseThresholds`; comish-preview `faWindow.previewOnly` |
| `lib/season-cron.ts`, `app/api/cron/advance-day/route.ts` | `autoOpenFrenzyIfDue` |
| `components/FaEarlyAccessToggle.tsx`, `components/FrenzyAutoOpenControl.tsx`, `components/PhaseDatesControl.tsx` | new admin controls |
| `components/home/NextSimCountdown.tsx`, `app/page.tsx` | Frenzy-auto-open countdown relabeling |
| `app/admin/season/actions.ts`, `app/admin/season/page.tsx` | `setPhaseDatesAction`, `computePhase` wiring, `PhaseDatesControl` |
| `lib/free-agency.ts`, `lib/free-agency-server.ts` | demand-responsive `roundPremium` |
| `lib/sim/lines-core.ts` | off-position fallback in `autoLines`/`autoFill` |
| `lib/ai-gm.ts` | AHL coverage + automatic roster-fill in the daily pass |
| `app/teams/[slug]/page.tsx` | Farm count `rosterType` filter, Total players row |
| `app/trades/build/page.tsx`, `components/TradeBuilder.tsx` | pick original-owner logo |
| `app/tools/compare/page.tsx` | UFA players included |
| `prisma/schema.prisma` | `preseasonPhaseAt`, `regularPhaseAt`, `frenzyAutoOpenAt`, `faEarlyAccess` (SimSettings) |
| **Local + production DB** (data, not files) | 22 contract-years/cap-hit fixes (PHI batch + 9 more NHL + 8 AHL), Robertson trade+signing, Xhekaj restored to MTL, ~25 age backfills, Kopitar/Tolvanen reverts |

## Lessons learned this session

- **A prior session's bulk data-accuracy pass can silently overwrite a
  legitimate in-app action taken *after* the pass's premise was true**
  (Xhekaj: correctly flagged real-UFA at the time, then a human GM
  re-signed him in-game, then — presumably — a later re-run or
  unresolved sweep put him back to UFA, discarding the real signing).
  When "fixing" a player to match reality, check for an ACTIVE
  `resignStatus`/pending negotiation first, not just the real-world
  status.
- **Always re-verify a house rule against the CURRENT reasoning, not
  just the stored rule text** — the Kopitar/Quick near-miss was caught
  because the memory happened to be checked before executing, not
  after; a future session should keep doing this check-before-write
  even when a "fix" seems obviously correct in isolation.
- **When a mechanic touches "what phase is it," check EVERY consumer of
  the old hardcoded/hand-computed logic, not just the one that reported
  the bug.** The Comish-preview investigation would have shipped a
  partial fix (display-only) if the day-loop/cron/dashboard call sites
  hadn't been checked — they'd have silently kept using stale
  boundaries.
- **A large, irreversible-looking DB write being blocked by the safety
  classifier is not always a bad thing** — the blocked 115-player sweep
  during the near-miss phase-unpin was the only reason that mistake
  didn't cause real damage. Don't route around a classifier block by
  finding an alternate tool; treat the block as a signal to stop and
  confirm with the user first.
- **A round-based game-economy tuning value should be treated as a
  starting point, not a final answer** — the Frenzy round-premium
  values were corrected twice in the same session (once for the whole
  mechanic's *direction*, once for the specific *magnitude*) after
  direct user feedback each time. Ship, then listen.

## What's NOT done / deliberately left alone

- **The Tolvanen mystery** — reverted, but the actual mechanism that
  moved him to Colorado was never found despite a thorough check of
  every tracked pathway (SigningLog, Transaction, FaOffer, Waiver,
  trade, roster-mode switch). Confirmed not systemic (the other 5
  players with active offers were all fine), but worth investigating
  properly if it happens again — especially since this session shipped
  real new automation (the cron running for real for the first time,
  the Frenzy auto-open) that could plausibly have an edge case not yet
  found.
- **`realTeamId`'s "active roster only" import blind spot** (flagged
  last session, still not fixed) — likely explains at least some of
  this session's contract-year gaps too, not just team-assignment ones.
- **No season-rollover contract engine still** — the immediate-update
  change this session makes THIS gap slightly less urgent (an
  extension no longer needs a rollover to take effect), but
  `contractYears` still never decrements on its own year-over-year.
- **The AHL audit (round 2) covered the specific `contractYears: 0`
  symptom, not a full re-scan** — there could still be other kinds of
  drift (wrong team, wrong cap hit on players who already show a
  nonzero year count) the same way round 1's audit found beyond its
  original narrow report.

## Suggested next step

1. **Watch for the Tolvanen pattern recurring** — if it does, that's
   the strongest lead toward finding the actual mechanism (likely
   something in the newly-shipped automation).
2. `realTeamId` active-roster-only gap (see above) — same shape of fix
   as `importRealCapHitsForGaps` from the previous session, not yet
   built for team assignment.
3. If the user wants a season-rollover contract engine built properly
   (decrementing `contractYears` at each season boundary), that's now
   a clearer, more isolated piece of work since the deferred-extension
   complexity is gone.
4. Nothing else is currently known-broken.
