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
