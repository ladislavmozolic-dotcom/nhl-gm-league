# Sim Engine V3 — offline workbench

**Status:** `3.0.0-wip`, not selectable in Admin, not returned by
`activeSimEngine()`, and not reachable from season, pre-season, or playoff
simulation. Existing league games therefore remain on their current V1/V2
path. V3 can only be called explicitly in an offline diagnostic with
`simulateGame(..., { engineVersion: ENGINE_V3 })`.

The goal is not a cosmetic third label. V3 should make coaching, deployment,
and player roles more legible while preserving the calibrated league-level
distribution. Each item below must be independently gated by
`st.isExperimentalV3`, measured against V2 under fixed seeds, and only then
considered for an eventual preview screen.

## Candidate sequence

1. **Fatigue-aware deployment — first increment implemented offline.**
   Existing fatigue changes a skater's attributes during an overlong shift,
   but the bench did not use that information when choosing when to change.
   V3 now shortens a depleted unit's target shift by up to 10 seconds from
   the existing 38–55s (forwards) / 42–61s (defence) random range. It derives
   the adjustment from the unit's existing EN and CON values; neutral and
   high-stamina units retain exactly the V2 target length. This is local to
   `advanceShift`, produces no extra RNG draws, and is gated strictly by
   `st.isExperimentalV3`.
2. **Coach-driven game-state adaptation — second increment implemented offline.**
   V2's existing coach adjustment is a fixed third-period multiplier. V3 now
   begins its additional response only in the final 10 minutes and ramps it
   towards the horn. It uses the already-resolved coach OF, DF, and EX profile:
   a more attacking coach presses harder when trailing; a more defensive coach
   suppresses chances more when protecting a lead. It complements rather than
   overwrites the GM's `GameStrategy`, is bounded to a small range, and is
   gated by `st.isExperimentalV3`.
3. **Player-role matchup effects — third increment implemented offline.**
   V2's home-ice matching only deploys a checking line more often. V3 now
   recognizes the existing profile types `Defensive Forward`, `Forechecker /
   Grinder`, and `Two-Way Forward`; when the home checking line actually faces
   the away top line, its DF/CK strength reduces that top line's chance danger
   by a bounded 0.4–3%. This is an xG-quality effect, not a blanket scoring
   penalty, and is gated by `st.v3CheckingMatchup`.
4. **Quality-sensitive offensive-defenceman assists — fourth increment implemented offline.**
   V2's flat D-assist dampener fixes the team-wide D share but flattens elite
   offensive defenders too much. V3 normalizes a bounded PA/OF quality curve
   within the actual on-ice D pair: the pair retains the same average D-assist
   weight, while its stronger distributor earns a larger share.
5. **Offensive-zone faceoff set plays — fifth increment implemented offline.**
   A won offensive-zone draw creates a short 10-second, 6% shot-generation
   window, but only while the winning team keeps the puck in the attacking
   zone. The existing FO battle still decides possession; this never creates
   an automatic shot or goal.
6. **Defensive rebound clearance — sixth increment implemented offline.**
   Goalie rebound control still determines whether a rebound exists. Once loose,
   a defending pair's DF/CK can clear a bounded 4–16% of rebounds instead of
   automatically conceding an attacking recovery.
7. **Momentum timeout — seventh increment implemented offline.**
   In the final three minutes of a one-goal game, a coach with an unused timeout
   can use a real stoppage to halt a large opposing momentum swing.
8. **Assist-spread calibration — eighth increment implemented offline.**
   V3 slightly softens only the exponent used to select an assist recipient.
   Team assists and goals do not change; secondary assists are shared a little
   more broadly to reduce an excessive top-scorer tail.
9. **Emotional-PIM discipline — ninth increment implemented offline.**
   V3 reduces only fighting, scrums, brawls and abuse-of-official events to 35%
   of their previous rate. Ordinary infractions and power-play opportunities are
   deliberately unchanged.
10. **Elite-finishing curve — tenth increment implemented offline.**
    The leader diagnosis showed 77 goals and 61 assists at a normal 22.4 minutes
    of TOI. V3 therefore reduces only the finishing exponent from 1.70 to 1.55,
    anchored at the league-average finishing rating of 60; this tests whether
    the extreme goal tail can be corrected without changing deployment.

## Non-negotiable gates for every increment

- V1 and V2 must remain deterministic and byte-identical to their pre-change
  results for identical inputs and seeds.
- V3 starts as V2-equivalent before its feature flag is enabled; this makes a
  fixed-seed A/B diff attributable to one change.
- Run the normal Calibration Lab plus a V3-specific multi-seed run. Check the
  core rates, home win %, blowouts, upsets, quality-to-points, and the metric
  directly affected by the feature.
- Record the design, measured deltas, seed range, and decision in this file.
- No `LeagueConfig` option, admin toggle, schedule route, or deployment is
  added until an increment has passed those gates and is explicitly approved.

`frontend/scripts/calibration-v3.ts` is the dedicated read-only V3 pass. It
loads the same teams and settings as Calibration Lab but explicitly supplies
`ENGINE_V3`; it does not write games, configuration, or league data.

### Initial fixed-seed comparison — 2026-10-08

Using the same stored settings and seed base (90,000), V2 vs V3 landed at:

| Metric | V2 | V3 |
| --- | ---: | ---: |
| Goals / team / game | 2.96 | 3.00 |
| Shots / team / game | 31.3 | 31.3 |
| Home win % | 53.5% | 52.5% |
| Blowouts | 13.0% | 12.6% |
| Injuries / team / game | 0.515 | 0.536 |
| Quality → points | 0.826 | 0.843 |

V3 passed the key outcome-rate checks in this one seed. The 19.0 PIM failure
also exists in V2, so it is not a V3 regression. V3's 139 top-scorer result
needs the required multi-seed check before it can be accepted; the calibration
scripts accept an optional seed-base argument for that purpose.

### Third paired seed — 290,000: isolation hold

V3's full pass returned 2.99 goals, 31.4 shots, 12.5% blowouts, and 0.538
injuries per team/game, but its top scorer reached 142 points/82 and its
quality-to-points value was 0.729. More importantly, an offline V3 baseline
with both new V3 modules explicitly disabled did not reproduce the V2 report
for the same seed. The workbench now supports `fatigue-only`, `coach-only`,
and `baseline` modes to isolate this, but no third gameplay feature will be
added until V3 baseline identity with V2 is restored and tested.

### Checking-matchup initial pass — seed 90,000

With the third increment enabled, V3 produced 3.00 goals, 31.3 shots, 52.6%
home wins, 12.6% blowouts, and 0.536 injuries per team/game — all within their
preferred ranges. The shared PIM baseline failure remains. This first pass did
not create a league-wide scoring-rate shift; further multi-seed checks should
specifically examine top-line xG and scoring concentration before any future
promotion discussion.

### Quality-sensitive D assists — initial pass, seed 90,000

The fourth increment yielded 3.02 goals, 31.4 shots, 52.8% home wins, 12.4%
blowouts, and 0.500 injuries per team/game. Quality-to-points reached 0.865;
the top scorer was 131 points/82, narrowly above the preferred band. This is
an offline result only; before promotion, use multiple seeds to inspect both
the total D-assist share and the number of elite offensive D in scoring leaders.

The Calibration Lab now reports **Defencemen assist share** directly (target
26–30%), so this V3 module can be evaluated from league output instead of
leaderboard impressions alone.

### Combined V3 multi-seed check — 90,000 / 190,000 / 290,000

Across 2,976 offline games, the three-seed average was **2.99 goals**, **31.4
shots**, **53.8% home wins**, **13.2% blowouts**, **0.517 injuries**, and
**29.3% D-assist share** per team/game. Those core ranges are healthy. The
top-scorer average (138 points/82) remains slightly high and should be the
next calibration focus; PIM (~19.7) is the pre-existing shared V2/V3 issue.

### Emotional-PIM discipline — seed 90,000

The V3-only emotional-event multiplier was reduced to 35%. The same offline
992-game run now returns **11.7 PIM per team/game**, inside the 7–12 target,
with fighting at 3.0 minutes. Goals (2.96), shots (31.4), home wins (54.9%),
OT/SO rate (20.7%), blowouts (12.5%), and injuries (0.491) remain in range.
This is a calibration result only; it does not affect any selectable engine.

### Elite-finishing curve — seed 90,000

The first run reduces the top scorer from 138 to **134 points/82**, with goals
falling from 77 to 74 and assists nearly unchanged (60). Team scoring remains
2.96 goals and 31.4 shots per game. Quality-to-points improves to 0.859 and
upsets to 28%, while all primary calibration checks pass; save percentage at
0.912 remains the sole warning. The preferred leader target is still 130 or
below, so this requires multi-seed measurement before any later decision.

### Second paired seed — 190,000

The second V2/V3 pair confirms the same conclusion: goals (2.98 vs 3.01),
shots (31.5 vs 31.5), home win rate (52.5% vs 54.6%), and injuries (0.539 vs
0.524) remain in their expected bands. PIM remains a shared baseline failure
(19.5 vs 19.4). V2's Spearman was 0.733 and V3's 0.769, confirming that the
known quality-to-points issue is not introduced by V3. V3's 14.6% blowout rate
is narrowly outside the preferred band on this seed, so it must be monitored
across further seeds before a third gameplay feature is accepted.

## First implementation target

The fatigue-aware deployment and coach-driven game-state increments are now in
the offline workbench. Before a third V3 mechanic is added, run the multi-seed
comparison and record shift-length distribution, fourth-line/third-pair TOI,
late-period shot share, injury rate, and V3-vs-V2 calibration here. The next
recommended mechanic is a real checking-line effect using the existing player
types and attributes.

### Elite-finishing curve — multi-seed check (90,000 / 190,000 / 290,000) — 2026-10-09

| Seed | Goals | Shots | Home W% | Blowouts | PIM | Top scorer (pts/82) | Spearman |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 90,000 | 2.96 | 31.4 | — | — | — | 134 | — |
| 190,000 | 2.98 | 31.3 | 56.3% | 11.9% | 11.1 | 142 (69G/73A) | 0.868 |
| 290,000 | 2.98 | 31.5 | 55.5% | 11.4% | 11.4 | 124 (78G/46A) | 0.738 |

Core rates, PIM, D-assist share (29.7%), xG tracking and injuries are green on all
three seeds. The top-scorer average is ~133 — still slightly above the 130 ceiling,
and the single-player maximum swings ±9 between seeds, so it is mostly sample noise
rather than a systematic tail. Seed 290,000 repeats the low quality-to-points value
(0.738; V2 shows the same seed-dependent dip), so it is not attributed to the
finishing curve. Open items: (1) the V3-baseline-vs-V2 identity break from the
290,000 note is still unresolved and blocks any further gameplay mechanic;
(2) save % (.911–.912) is a shared V2/V3 warning.

### Baseline identity restored — 2026-10-09

`frontend/scripts/v3-identity.ts` runs V2 and V3-with-all-ten-flags-off on the same
seeds and compares the full serialized `GameResult` (version stamp aside). Result:
**identical on 400 games each at seeds 90,000 / 190,000 / 290,000**. The engine itself
never broke identity — the earlier mismatch came from `calibration-v3.ts`'s `baseline`
mode, which only disabled fatigue + coach while the later eight modules stayed on by
default. `baseline` now disables all ten. The gate "V3 starts as V2-equivalent" is
met, so the next gameplay mechanic is unblocked; re-run `v3-identity.ts` after every
increment to prove each flag is truly isolated.

### Quality→points (Spearman) is seed noise, not a V3 regression — 2026-10-09

Per-seed Spearman has an sd of ~0.045, so 3-seed averages cannot resolve differences
below ~0.04 (single-flag runs on 3 seeds swung ±0.03 even for harmless modules, and
any RNG-path change re-rolls the season). Measured on 30 independent seed bases
(2,000,000 + i·100,000), 992 games each:

| Engine | Spearman mean | sd | se |
| --- | ---: | ---: | ---: |
| V2 | 0.793 | 0.045 | 0.008 |
| V3 (all 10 flags) | 0.794 | 0.058 | 0.011 |

No difference. An earlier 10-seed pass that suggested V3 ≈ 0.76 (rebound clearance
looked worst) was a ~2σ fluke and an engine tweak to coach adaptation tried on that
basis was reverted. **Rule going forward: judge Spearman / top-scorer / gap only on
≥ 30 seed bases; use 3 seeds for the coarse rate checks (goals, shots, PIM, home win %).**
Note V2 itself averages 0.79, below the 0.85 target — a shared calibration item, not V3.

### Goalie rhythm — eleventh increment, offline — 2026-10-09

A goalie idle for more than 4:00 of game time is colder on the next shot: goal
probability ×1.00→1.06, ramping from 4:00 to 8:00 idle and capped, for that one shot
only (`v3GoalieRhythmMult`, flag `goalieRhythm`, tracked per goalie in
`st.lastShotAgainst`). No extra RNG draws; empty-net shots are excluded.

Gates: `v3-identity.ts` with all eleven flags off — identical on 400 games (seed 90,000).
Seeds 90,000 / 190,000 / 290,000: goals 2.97 / 2.98 / 2.98, shots 31.4 / 31.3 / 31.5,
home win 55.6 / 56.0 / 55.4%, PIM 11.8 / 11.1 / 11.3, blowouts 12.9 / 11.9 / 11.5% —
all in range, and indistinguishable from the pre-increment run. Save % stays .911
(shared warning). **The effect is below measurement noise** (long idle stretches are
rare at ~31 shots/team), so it is safe but nearly inert; strengthen it (lower the
idle threshold or raise the 6% cap) only if a visible effect is wanted. Spearman/top
scorer need the 30-seed protocol before any claim either way.

### Goalie rhythm — strengthened — 2026-10-09

The first version (4:00 threshold, +6% cap) was below measurement noise. Now: idle > 2:00
ramps to **+12% at 5:00** idle. Seeds 90,000 / 190,000 / 290,000: goals 3.00 / 3.02 / 3.05
(was 2.97–2.98), save % 0.910 / 0.910 / 0.909 (was .911, the shared warning is gone on
one seed and borderline on two), GSAx +0.27 / +0.26 / +0.24, shots unchanged
(31.4–31.5), home win 55.4–55.9%, blowouts 11.7–12.4%, PIM 11.1–11.8. All in range;
goals sit in the upper half of 2.9–3.15 so watch them when stacking further scoring-
positive mechanics. Identity gate (all flags off) re-run: identical.

### Full V3 (12 flags) vs V2 — 30 seed bases — 2026-10-09

30 independent seed bases (2,000,000 + i·100,000), 992 games each, mean ± se:

| Metric | V2 | V3 (all 12) |
| --- | ---: | ---: |
| Quality → points (Spearman) | 0.793 ± 0.008 | 0.795 ± 0.008 |
| Top scorer (pts/82) | 133.6 ± 1.6 | 131.9 ± 1.6 |
| Top-8 vs bottom-8 gap | 37.4 ± 0.7 | 37.0 ± 0.7 |
| Goals / team / game | 2.985 ± 0.008 | 3.032 ± 0.009 |
| Save % | .911 | .910 |
| Blowouts % | 13.1 ± 0.2 | 13.2 ± 0.2 |

Competitive balance, scoring concentration and blowouts are statistically identical to
V2 (differences well inside 1–1.5 se). The only real shift is goals +0.047/team/game
(+1.6%), from goalie rhythm, still inside the 2.9–3.15 target; save % drops .001 as
intended. The top-scorer average stays above the 130 ceiling in both engines (shared
calibration item). Verdict: the 12-increment V3 is calibration-safe as a package.

### Goalie composure — thirteenth increment, offline — 2026-10-09

Flag `goalieComposure`: a goalie is *rattled* for 2:00 after allowing a goal (goal chance ×1.06)
and *locked in* after 12+ consecutive saves (×0.96); a goal resets the streak, so the two
states never overlap. State is per game (`st.goalieStreak`, `st.lastGoalAgainst`); no extra
RNG draws; empty-net shots excluded. Pure helper `v3GoalieComposureMult` is unit-tested.

Gates: identity with all 13 flags off — identical on 400 games (seed 90,000); 10/10 tests.
Seeds 90,000 / 190,000 / 290,000: goals 2.98 / 3.04 / 3.06, shots 31.3–31.5, save %
.911 / .910 / .909, home win 53.6–53.8%, PIM 11.0–11.8, GSAx +0.30 / +0.24 / +0.21,
blowouts **14.2** / 13.8 / 12.4%. Net scoring effect is roughly neutral (rattled and
locked-in roughly cancel), but blowouts now touch the 14% ceiling on seed 90,000 —
the rattled state adds a little goal clustering. Needs the 30-seed protocol (blowouts,
Spearman, top scorer) before any promotion discussion; if blowouts drift, shorten the
rattled window to 90s or soften to ×1.04.

### Full V3 (13 flags) vs V2 — 30 seed bases — 2026-10-09

Same protocol (seed bases 2,000,000 + i·100,000, 992 games each), mean ± se:

| Metric | V2 | V3 (all 13) |
| --- | ---: | ---: |
| Quality → points (Spearman) | 0.793 ± 0.008 | 0.794 ± 0.009 |
| Top scorer (pts/82) | 133.6 ± 1.6 | 131.3 ± 1.5 |
| Top-8 vs bottom-8 gap | 37.4 ± 0.7 | 36.4 ± 0.8 |
| Goals / team / game | 2.985 ± 0.008 | 3.024 ± 0.008 |
| Save % | .911 | .910 |
| Blowouts % | 13.08 ± 0.19 | 13.49 ± 0.22 |
| Home win % | 53.2 ± 0.3 | 53.7 ± 0.2 |
| PIM / team / game | 19.8 ± 0.07 | 11.4 ± 0.06 |

Competitive balance and scoring concentration are unchanged. Blowouts +0.4 pts is ~1.4 se
(not significant; stays under the 14% ceiling), so the seed-90,000 reading of 14.2% was
noise and the rattled-goalie window needs no softening. Goals +0.04 (+1.3%) and PIM
19.8→11.4 (V3 emotional-discipline, in the 7–12 target; V2's 19.8 is the known shared
failure) are the only real shifts, both intended. Package remains calibration-safe.

### Overtime stars — fourteenth increment, offline — 2026-10-09

Flag `overtimeStars`: in 3-on-3 situations the finishing exponent gets +0.15
(`V3_OT_STAR_EXPONENT`), so true finishers matter more in the open ice. The curve stays
anchored at an average finisher (60), so league 3v3 scoring is unchanged; no extra RNG.

Gates: identity with all 14 flags off — identical on 400 games (seed 190,000). Seeds
90,000 / 190,000 / 290,000: goals 2.98 / 3.04 / 3.06 (identical to before the increment),
shots 31.3–31.5, save % .911 / .910 / .909, home win 53.6–53.8%, blowouts 14.2 / 13.8 / 12.4%.
OT/SO share on 8 other seed bases: V2 19.97%, V3 20.10%, V3 without this flag 20.10%
(a 17.4% / 18.1% reading on two single seeds was noise). **Honest limit:** OT is a small
slice of games, so the effect is below the noise of every league-level metric; it is safe
but nearly inert, like the first goalie-rhythm version. V2 itself sits at the bottom of the
20–26% OT/SO target — a shared item, not a V3 regression.

### Power-play puck movement — fifteenth increment, offline — 2026-10-09

Calibration Lab now reports **Power play %** (target 19–23%; PK % is its complement) and
**PP opportunities / team / game** (2.8–3.8). V2 baseline at seed 90,000: PP 20.5%, 3.01 opps.

Flag `ppPuckMovement`: PP shot probability is scaled by `v3PpPuckMovementMult` — the five PP
skaters' mean PA against the PK skaters' mean DF, ±0.6% per point of gap, capped ±12%.
**Centring matters:** the typical gap is strongly negative (PK defenders out-rate PP
passers on DF vs PA), so a centre of 0 cost ~1 pt of PP% (21.1→20.2) and -5 still ~0.9;
`V3_PP_CENTER = -12` restores it. On 8 seed bases (3,000,000 + i·100,000): PP% 21.00 with
the flag vs 21.09 without; goals 3.012 vs 3.014. Shots, PP opportunities (2.96) unchanged.

Gates: identity with all 15 flags off — identical on 400 games (seed 90,000); 12/12 tests.
Seeds 90,000 / 190,000 / 290,000: goals 2.98 / 3.04 / 3.06, PP% 21.2 / 21.6 / 21.5, PP opps
2.94–2.96, blowouts 14.4 / 13.7 / 12.5% (seed 90,000 marginally over the 14% ceiling for the
second time on that seed — a seed-specific reading, the 30-seed mean was 13.5%), OT/SO 17.8 /
18.3 / 22.0% (seed noise; 8-seed mean ~20.1%). **Not yet shown:** that the flag widens the
team-to-team PP% spread as designed — this needs a per-team PP% histogram over many seeds.

### PP puck movement — per-team spread — 2026-10-09

`frontend/scripts/pp-team-spread.ts` simulates 12 seed bases (4,000,000 + i·100,000; 32 teams,
~2,200 PP opportunities per team) with V3 minus the flag vs V3 with it:

| | without flag | with flag |
| --- | ---: | ---: |
| League PP% | 21.39 | 21.22 |
| Team PP% sd | 3.55 | 3.84 |
| Team PP% range | 15.8 – 30.1 | 15.3 – 30.7 |
| corr(team PA skill, PP%) | 0.715 | 0.765 |

The mean holds (−0.17 pt) while the spread widens ~8% and PP% tracks team passing skill more
closely, as designed (binomial sampling noise is only ~0.9 pt, so the change is real but
modest). Both versions already have a wide spread — V3's 3.8 pt sd is on the high side of
real-NHL team PP% variation, so do not strengthen the slope further. A separate PK mechanic
is not needed: the same gap term already drives the PK side (strong PK D lower PP% for the
opposing team).

### Speed draws penalties — sixteenth increment, offline — 2026-10-09

Flag `speedDrawsPenalties`: the infraction rate a team takes is scaled by
`v3SpeedDrawsPenaltiesMult(oppSkating, ownSkating)` — ±0.3% per point of ice-time-weighted SK
gap to the opponent, capped ±10%. The factor is antisymmetric between the two teams (what one
gains the other loses, product ≈ 1), so league penalty volume needs no centring. No extra RNG
draws.

Gates: identity with all 16 flags off — identical on 400 games (seed 290,000); 13/13 tests.
Seeds 90,000 / 190,000 / 290,000: goals 2.98 / 3.05 / 3.06, PIM 11.7 / 11.0 / 11.3, PP opps
2.95 / 2.95 / 2.95 (unchanged), PP% 21.3 / 21.8 / 21.6, blowouts 14.5 / 13.6 / 11.8%
(seed 90,000 again slightly over 14%: seed-specific, 30-seed mean was 13.5%), OT/SO 17.7 /
18.3 / 22.4% (seed noise). Spearman 0.881 / 0.851 / 0.781 is within the known ±0.045 per-seed
noise. **Not yet shown:** that fast teams actually end up with more PP opportunities than
slow ones — a per-team PP-opportunity vs team-SK correlation over many seeds is still to do.

### Speed draws penalties — per-team check — 2026-10-09

`frontend/scripts/pp-opp-speed.ts` (12 seed bases 5,000,000 + i·100,000; team SK sd 3.15, range
42.1–54.8) compares V3 minus the flag with V3 plus it:

| | without flag | with flag |
| --- | ---: | ---: |
| PP opps / team / game (mean) | 2.968 | 2.972 |
| corr(team SK, PP opps) | 0.223 | 0.495 |
| slope (opps per SK point) | 0.0053 | 0.0126 |

Mean volume is unchanged and faster teams now draw clearly more power plays, as designed. The
total effect across the league's 12-point SK range is about ±0.08 opportunities per game,
a believable, modest edge.

### Net-front battle — seventeenth increment, offline — 2026-10-09

Flag `netFront`: on point shots (screens/tips) and rebounds, goal probability is scaled by
`v3NetFrontMult` — the on-ice attacking forwards' mean ST against the defending pair's mean
ST, ±0.5% per point, capped ±8%. Forwards run ~2 ST below D (79.2 vs 81.0 on ice-time-weighted
means), so `V3_NETFRONT_CENTER = -2` keeps the league level. No extra RNG draws.

Gates: identity with all 17 flags off — identical on 400 games (seed 90,000); 14/14 tests.
Seeds 90,000 / 190,000 / 290,000: goals 2.98 / 3.05 / 3.06 (unchanged from the previous
increment), shots 31.3–31.5, save % .911 / .909 / .909, PP% 21.3 / 21.8 / 21.4, D-assist
share 29.5–29.9%, top scorer 132 / 123 / 131, blowouts 14.4 / 13.6 / 11.9% (seed 90,000 again
slightly high — seed-specific, 30-seed mean ~13.5%). **Not yet shown:** that a physical
forward line really scores more on rebounds/screens than a light one; effect is likely small
(these two shot types are a minor share of shots).

### Full V3 (17 flags) vs V2 — 30 seed bases — 2026-10-09

Same protocol (seed bases 2,000,000 + i·100,000, 992 games each), mean ± se:

| Metric | V2 | V3 (all 17) |
| --- | ---: | ---: |
| Quality → points (Spearman) | 0.793 ± 0.008 | 0.811 ± 0.007 |
| Top scorer (pts/82) | 133.6 ± 1.6 | 130.9 ± 1.6 |
| Top-8 vs bottom-8 gap | 37.4 ± 0.7 | 38.1 ± 0.7 |
| Goals / team / game | 2.985 ± 0.008 | 3.018 ± 0.008 |
| Save % | .911 | .910 |
| Blowouts % | 13.08 ± 0.19 | 13.72 ± 0.20 |
| Home win % | 53.2 ± 0.3 | 53.6 ± 0.3 |
| PIM / team / game | 19.8 ± 0.07 | 11.4 ± 0.05 |
| Power play % | 21.06 ± 0.09 | 21.26 ± 0.12 |
| PP opportunities / team / game | 2.988 ± 0.008 | 2.973 ± 0.007 |
| OT / SO % | 20.5 ± 0.2 | 19.9 ± 0.2 |

Notes: quality → points is now +0.018 above V2 (~1.7 se — the PP-puck-movement, speed and
net-front increments tie results to team ratings, a mild improvement toward the 0.85 target);
top scorer is now ~131 (~ceiling 130); goals +0.03; blowouts +0.6 pt (~2.1 se, still under the
14% ceiling at 13.7%, worth watching); OT/SO 19.9% (V2 20.5%) sits right at the bottom of the
20–26% target, a shared V2/V3 item. PP% and PP volume hold. Package remains calibration-safe;
no single metric left its target band on the 30-seed mean except PIM (improved) and OT/SO
(marginal, shared).

### Shootout duel — eighteenth increment, offline — 2026-10-09

The shootout ignored the goalie's own PS (penalty-shot) rating. Flag `shootoutDuel`: attempt
probability is scaled by `v3ShootoutDuelMult(shooter PS, goalie PS)` — ±0.8% per point, capped
±15%. `frontend/scripts/so-duel.ts` (14 seed bases, ~11,300 attempts each) set the centre:
−8 (top-3 shooters vs goalies) cost ~2.2 pts of conversion because many more shooters than
the top three take attempts; `V3_SHOOTOUT_CENTER = -20` restores it.

| | without flag | with flag |
| --- | ---: | ---: |
| SO conversion % | 33.14 | 33.00 |
| corr(goalie PS, goals allowed %) | −0.455 | −0.615 |

Gates: identity with all 18 flags off — identical on 400 games; 15/15 tests. Regulation
metrics (3 seeds) unchanged: goals 2.98 / 3.05 / 3.06, shots 31.3–31.5, home win 53.6%,
blowouts 14.4 / 13.6 / 11.9%, OT/SO 17.7 / 18.4 / 22.3% (seed noise; 30-seed mean 19.9%).

### Garbage time — nineteenth increment, offline — 2026-10-09

V2's lead-protection shell stops at a 2-goal margin ("3+ is already comfortable"), so a blowout
keeps full tempo. Flag `garbageTime` (`v3GarbageTimeShotMult`): from the 2nd period a team up 3+
takes ×0.94 shot attempts (×0.90 in the 3rd); a team down 3+ gets ×1.05 in the 3rd. Bounded,
deterministic, no RNG.

Gates: identity with all 19 flags off — identical on 400 games (seed 290,000); 16/16 tests.
Effect on 12 seed bases (7,000,000 + i·100,000), V3 minus the flag vs V3 plus it: blowouts
13.93 → 13.75%, goals 3.031 → 3.037, Spearman 0.815 → 0.821, upset rate 27.8 → 27.3%
(all within noise). 3-seed spot check: goals 2.97 / 3.04 / 3.05, shots 31.2–31.5, blowouts
14.2 / 13.8 / 12.1%. **Honest limit:** the effect on blowouts is only ~−0.2 pt — it does not
correct the +0.6 pt drift seen against V2; that drift comes from the scoring-positive
increments and needs a flag-by-flag split. Open observation: the V3 upset rate (~27–28%) sits
at the bottom of the 28–45% target; V2's value on the same seeds has not been measured here yet.

### Flag-group split vs V2 — 19 flags, 30 fresh seed bases — 2026-10-09

Seed bases 8,000,000 + i·100,000 (992 games each), mean ± se. Groups removed from the full
V3: **goalie** = goalieRhythm, goalieComposure, shootoutDuel, reboundClearance, blockSkill;
**special** = ppPuckMovement, speedDrawsPenalties, netFront, overtimeStars, emotionalDiscipline;
**game** = garbageTime, coachAdaptation, fatigueDeployment, momentumTimeout, faceoffPressure.

| Config | Blowouts % | Upset % | Goals | Spearman | Top scorer |
| --- | ---: | ---: | ---: | ---: | ---: |
| V2 | 13.19 ± 0.20 | 28.7 ± 0.6 | 3.008 ± 0.005 | 0.800 ± 0.010 | 134.1 ± 1.5 |
| V3 all 19 | 13.38 ± 0.22 | 28.8 ± 0.4 | 3.032 ± 0.008 | 0.796 ± 0.009 | 130.2 ± 1.7 |
| V3 − goalie group | 13.00 ± 0.20 | 28.7 ± 0.5 | 3.004 ± 0.005 | 0.800 ± 0.008 | 129.9 ± 1.6 |
| V3 − special group | 13.31 ± 0.24 | 29.0 ± 0.4 | 3.029 ± 0.007 | 0.792 ± 0.008 | 131.3 ± 1.3 |
| V3 − game group | 13.42 ± 0.23 | 28.1 ± 0.5 | 3.038 ± 0.009 | 0.802 ± 0.009 | 133.5 ± 1.3 |

Conclusions:
- **Blowout "drift" and low upset rate were seed noise.** On fresh seeds V3 (13.38%) vs V2
  (13.19%) differ by <1 se, and the upset rate is identical to V2 (28.8 vs 28.7%), inside the
  28–45% band. The earlier 27–28% upset reading was V2-level noise around the band's edge.
- **Spearman is identical to V2 (0.796 vs 0.800)** — the +0.018 seen on the previous seed set
  was likewise noise. Per-seed sd is ~0.05, so only ≥30-seed means mean anything.
- **The only systematic shift is goals: +0.024 (≈2.5 se), and it comes from the goalie group**
  (removing it returns goals to 3.004 and blowouts to 13.0%). It is the rhythm/composure pair
  (net goal-positive) that costs ~0.8% more goals; still inside 2.9–3.15.
- Top scorer ~130 vs 134: the finishing curve helps as intended.

### Shooter form — twentieth increment, offline — 2026-10-09

Flag `shooterForm` (`v3ShooterFormMult`, state `st.shooterGoalAt` / `st.shooterColdShots`): for 10:00
after his own goal a skater's shots are ×1.04 likelier to score; after 5+ shots on goal since
his last goal (or since the start of the game) they are ×0.97. A goal resets the drought counter,
so the two states never overlap; empty-net shots excluded; no RNG draws.

Gates: identity with all 20 flags off — identical on 400 games (seed 90,000); 17/17 tests.
Seeds 90,000 / 190,000 / 290,000: goals 2.98 / 3.05 / 3.04 (unchanged vs the previous
increment — the +4% and −3% roughly cancel), shots 31.2–31.5, save % .911 / .909 / .909, top
scorer 130 / 124 / 126, top-5 share 2.9–3.1%, blowouts 14.2 / 14.0 / 12.3%. Not measured: the
per-player streakiness distribution (a skater's multi-goal-game rate); that needs a dedicated
multi-seed check before any claim beyond "league-neutral".

### Flag-strength tuning — 2026-10-09

`frontend/scripts/flag-effect.ts <flag> [seeds]` measures a flag's *target* effect (not league
averages) with the flag on vs off, other 19 flags on, 10 seed bases (9,000,000 + i·100,000).
First pass showed four weak flags:

| Flag | Target metric | Off → On (before) |
| --- | --- | --- |
| blockSkill | corr(D blocking, blocks/game) | 0.518 → 0.532 |
| netFront | corr(team F ST, goals/game) | 0.163 → 0.160 (nil) |
| shooterForm | multi-goal skater-games per 1000 | 18.29 → 18.46 |
| overtimeStars | better-team win % in OT | 54.1 → 54.1, **857 OT games identical** |

**overtimeStars was dead code.** Overtime runs in a separate 3-on-3 model (15 s steps, own
`conversion()` call); the possession loop never plays OT, so the `shotSituation === "3V3"` hook
only fired for rare regulation 3-on-3 spells. The exponent bump now lives in the real OT model
(`V3_OT_STAR_EXPONENT` raised 0.15 → 0.3).

Retuned: blockSkill ±3%/pt cap ±20% (was ±1.2%/±10%); netFront ±1.2%/pt cap ±15% (was ±0.5%/±8%);
shooterForm ×1.08 / ×0.95 (was ×1.04 / ×0.97). Re-measured:

| Flag | Target metric | Off → On (after) |
| --- | --- | --- |
| blockSkill | corr(D blocking, blocks/game) | 0.537 → 0.567 |
| netFront | corr(team F ST, goals/game) | 0.174 → 0.190 |
| shooterForm | multi-goal skater-games per 1000 | 18.03 → 18.38 |
| overtimeStars | better-team win % in OT | 51.2 → 52.1 (868 vs 865 OT games) |

All four now move in the intended direction, still modestly — hockey's randomness caps these.
Sanity: identity gate (all flags off) identical on 400 games, 17/17 tests, and 3-seed league rates
unchanged (goals 2.99 / 2.98 / 3.06, shots 31.1–31.4, PP% 21.2–21.3, PIM 10.8–11.7, blowouts
14.1 / 11.6 / 13.6%; top scorer 120 / 123 / 138 is seed noise). Not yet re-run: the 30-seed package
check with the retuned strengths. Still open: goalie group's +0.8% goals (see group split).

### 60-seed goals/blowouts tuning — 2026-10-09

60 fresh seed bases (10,000,000 + i·100,000; 992 games each), mean ± se. With the retuned (stronger)
flags the package had drifted: goals 3.028 vs V2 3.009 and **blowouts 14.07 vs V2 12.99 (~5 se)**.

Group removals (goals / blowouts): no goalieRhythm 2.973 / 13.76; no goalieComposure 3.035 / 13.65.
So **goalieRhythm adds ~+0.055 goals** (V3 without it is 0.036 *below* V2), composure ≈ −0.008.
Later split at rhythm cap 8%: no shooterForm 3.011 / 13.81; no netFront+blockSkill 3.036 / 13.59;
no ppPuckMovement+speedDrawsPenalties+overtimeStars 3.022 / 13.76; all-on 3.018 / 13.97 —
each removal moves blowouts only 0.2–0.4 (1–2 se), so the drift is **spread across many flags,
not one**, and the blunt targeted lever is `garbageTime`.

Changes: goalieRhythm cap **12% → 8%** (goals back to ~V2); garbageTime strengthened.
Variants of garbageTime, all-on, 60 seeds (goals / blowouts / save % / home win % / top scorer):

| Variant (up-3+ P2 / P3, down-3+ P3) | Goals | Blowouts | Save % | Home win % | Top scorer |
| --- | ---: | ---: | ---: | ---: | ---: |
| ×0.94 / ×0.90, ×1.05 (old) | 3.018 | 13.97 | .9097 | 53.7 | 131.6 |
| ×0.90 / ×0.82, ×1.08 (A) | 3.019 | 13.49 | .9096 | 53.6 | 131.5 |
| **×0.86 / ×0.76, ×1.10 (B, adopted)** | **3.015** | **13.23** | .9096 | 53.7 | 130.6 |
| V2 | 3.009 | 12.99 | .9111 | 53.5 | 134.1 |

B leaves goals within 0.006 of V2 and blowouts within 0.24 (≈1.2 se) of V2, with a smaller top
scorer tail. It only acts at 3+ goal margins, so it cannot change close games. Gates after the
change: identity (all flags off) identical on 400 games; 17/17 tests.
