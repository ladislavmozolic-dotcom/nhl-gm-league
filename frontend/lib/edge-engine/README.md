# EdgeNHL Rating Engine 2.0

A standalone, offline tool that builds the full STHS rating package from real hockey data.
**Not wired to the website or the DB** — it's a library + CLI you run yourself. Later it can
be imported by the Players Calculator, but nothing here touches pages or Prisma.

Produces: `CK FG DI SK ST EN DU PH FO PA SC DF PS EX LD` + `MO` (default 50).
`PO` and `OV` are **intentionally not produced** — PO needs a separate prospect model and OV
is display-only (STHS computes it and the sim never reads it).

## Pipeline

```
REAL DATA → 3-SEASON WEIGHTING → SAMPLE REGRESSION → RAW SKILL → PERCENTILE → PNHL CURVE → FINAL
```

- **3-season weighting** (`math.ts`): TOI-weighted per-60, current 100% / −1yr 55% / −2yr 30%.
  A 14-game season just contributes little exposure — no GP thresholds.
- **Sample regression** (`math.ts`): each metric is shrunk toward its league prior by
  `R = exposure/(exposure+K)`; small samples pull to the mean. `K` is per-parameter (`config.ts`).
  The same `R` becomes the parameter's **confidence** 0-100.
- **Percentile**: each sub-metric → z-score vs a league reference (`REF` in `config.ts`),
  weight-combined per the spec, then `normalCdf` → percentile within the comparison group (F/D).
- **PNHL curve** (`config.ts`): percentile → rating, deliberately conservative — elite land in
  the high-70s/low-80s, matching current ProfiNHL, not 95-99.
- **Final blend**: `0.85 × curveRating + 0.15 × absoluteRating` so a genuinely exceptional
  (or poor) season still nudges the number.

The **five decision ratings SK/PH/PA/SC/DF** are what STHS compares when a player decides to
skate / pass / shoot, so the engine keeps their mutual scale — the goal is correct *archetypes*,
not just correct overall.

## Run it

```bash
npx tsx lib/edge-engine/cli.ts                  # built-in demo roster
npx tsx lib/edge-engine/cli.ts --why            # + per-player reasons & QA flags
npx tsx lib/edge-engine/cli.ts --out ratings.csv # write the STHS CSV
npx tsx lib/edge-engine/cli.ts --in roster.json  # your own PlayerInput[] JSON
```

## Feeding real data

The engine consumes a normalized shape (`types.ts`); a loader just maps columns onto it.

| Source | Fills | Notes |
|---|---|---|
| **MoneyPuck** season skater CSV (per situation) | goals, xGoals, SOG, primary/secondary assists, hits, giveaways, takeaways, blocks, penalties, faceoffs, on-ice xGA/CA relative | free for non-commercial use *with attribution* |
| **NHL EDGE** | max speed, 20+/22+ bursts, skating distance, shot speed | public NHL-wide from 2021-22; no clean API → CSV/manual |
| **NHL API** | bio (pos/age/height/weight), career GP, playoff GP, captaincy | `api-web.nhle.com` |
| injury feed | games missed to injury, eligible games | drives DU (not GP) |
| AHL export | G/A1/A2/SOG/hits/FO | routed through the League Translation Engine |

Feed **counts + ice time**, not pre-divided rates — the engine builds and weights per-60 itself.

### Real-data pipeline (built)

The MoneyPuck loader + calibration are implemented and run on the real league:

```bash
# 1. Download 3 seasons (MoneyPuck seasonSummary skaters; 2025 = 2025-26). Non-commercial + attribution.
for Y in 2025 2024 2023; do
  curl -sA Mozilla/5.0 -o $DIR/mp$Y.csv \
    "https://moneypuck.com/moneypuck/playerData/seasonSummary/$Y/regular/skaters.csv"; done

# 2. Fit REF (league mean/sd of every per-60 sub-metric) from the real distributions
npx tsx lib/edge-engine/calibrate.ts $DIR        # → ref.calibrated.json

# 3. Build the whole roster + STHS CSV (optional bio.json adds bio/EDGE/career/injury)
npx tsx lib/edge-engine/build.ts --dir $DIR --bio bio.json --out ratings.csv
```

`loaders/moneypuck.ts` maps the 154-column CSV, folds the 5on5/5on4/4on5/all rows into a
season, and computes the **team-relative** DF metrics (on-ice minus icetime-weighted team mean).
`loaders/assemble.ts` merges the seasons by playerId and attaches bio. MoneyPuck has no fights,
skating, or bio → FG/SK lean on priors/fallbacks and want an EDGE + bio feed.

**Two calibration files** ship in this folder and are loaded automatically if present:
- `curves.calibrated.json` — output curves = the empirical quantile function of the CURRENT
  ProfiNHL rating distribution (NHL skaters, per parameter × F/D). Regenerate from the DB
  (`rate_col` per player → quantiles at fixed percentiles, top point = max). This is the spec's
  "use the current ProfiNHL distribution as the base curve."
- `ref.calibrated.json` — input references fitted by `calibrate.ts` from real MoneyPuck rates.

With both, the engine reproduces the current ProfiNHL scale well on real data: DF, EN, ST, DI,
FO, CK match closely; PA/SC land within a few points; **SK** needs a real NHL EDGE feed (absent
from MoneyPuck) and **PH** is turnover-based by design (spec expects a ±3-5 scouting override for
elite puck-handlers). `bio.json` keys by MoneyPuck playerId (= NHL id = our `nhlId`) or exact
name; see `build.ts` header.

### Incremental rollout (keep-prior fallback)

A parameter whose source feed is missing falls back to the player's `previous` rating (from
`bio.json`) instead of degrading. So a run with MoneyPuck + our DB bio **computes** CK, DI, EN,
PH, FO, PA, SC, DF, ST from data and **keeps the current DB value** for SK (needs EDGE), EX/LD
(need career/captaincy), DU (needs injury feed), FG (needs fights), PS (needs shootouts). Wire
those feeds and each flips from "kept prior" to computed. `build.ts` prints QA flag counts +
biggest moves and writes `<out>.qa.csv` (Player, Param, Old, New, Delta, Flag, Reason) so you
can see every re-rate before adopting. Anchor check on real data: McDavid keeps SK 79 / EX 77 /
LD 92, PA→72 SC→63 DF→65 (DB 82/72/67); FO correctly drops inflated hand values (a 44%-faceoff
center → ~62, not 84); ST lifts underrated heavies (Kane 99 kg → 84).

## AHL players

`bio.isAhl` routes a player through `leagueEq.ts`: each rate is translated
`NHLmetric = α + β·AHL + γ·age` (fit from dual-league players) into an NHL-equivalent season,
then rated by the same pipeline — far better than a flat "× 0.75". Confidence is damped ×0.7.
Skating (no public AHL EDGE) and advanced defensive metrics fall back to a prior/scouting input.

## Per-parameter summary

| Rating | Represents | Main inputs | Group |
|---|---|---|---|
| CK | hit frequency | 5v5 + all hits/60 | F/D |
| FG | fighting tendency | fights/82 (3yr) | all |
| DI | discipline | minor + non-fight major penalties/60 (inverse) | F/D |
| SK | skating | EDGE max speed + bursts (fallback: prior/scouting) | F/D |
| ST | strength | weight + weight-for-height residual + shot speed | all |
| EN | stamina/workload | TOI/GP + high-workload% + distance | F/D |
| DU | injury resistance | injury-availability 3yr (50/30/20), ±8 YoY clamp | all |
| PH | puck control | giveaways ÷ involvement (iCF+1.5·A1+0.75·A2), DZ giveaways, drawn, rush | F/D |
| FO | faceoffs | Bayesian-regressed FO% (K=300, position fallback) | C/W/D |
| PA | playmaking | 5v5 & PP primary/secondary assists/60 | F/D |
| SC | scoring | 5v5 G + ixG + SOG + PP G + shooting talent | F/D |
| DF | defensive impact | relative xGA/HD/CA/PK + blocks + takeaways | F/D |
| PS | shootout/breakaway | career SO regressed, blended with SC+PH | all |
| EX | experience | career GP + playoff GP + seasons | all |
| LD | leadership | captaincy history + playoff + tenure (±5 override) | all |
| MO | morale | default 50 (STHS manages it) | — |

## Calibration & our own base

`config.ts` is the single tuning file — `REF` distributions, `WEIGHTS`, `K`, `CURVES`,
`LEAGUE_EQ`. **The default builds our OWN base**: the hand-designed conservative `CURVES` define
the rating scale (never copied from the current ProfiNHL numbers), and `REF` is fitted from real
MoneyPuck data (`ref.calibrated.json`). So ratings are produced purely from the spec on a scale
we control — zero dependence on ProfiNHL ratings.

`curves.calibrated.json` (the ProfiNHL rating-distribution quantile curves) is kept only for an
optional side-by-side: run with `EDGE_PROFI_CURVES=1` to map onto the legacy ProfiNHL scale.
`QA` (build.ts, only when a `previous` is supplied) flags moves vs a prior cycle (Δ>5 yellow,
Δ>8 red) — reporting only, never part of the formula.

Params with no auto data feed (SK→EDGE, DU→injury, FG→fights — none has a clean public API)
return a neutral base + a `NEEDS …` reason (never a ProfiNHL value). Supply the manual CSVs and
they compute for the players they cover:

```bash
npx tsx lib/edge-engine/build.ts --dir $DIR --bio bio.json \
  --edge edge.csv --injury injury.csv --fights fights.csv --out ratings.csv
```

- `edge.csv`  : `playerId,name,maxSpeedMph,bursts20,bursts22,skatingMiles,shotSpeedMph`
- `injury.csv`: `playerId,season,gamesMissedInjury,eligibleGames[,longTermEvents]` (row per season)
- `fights.csv`: `playerId,fights` (3-season total)

`playerId` = NHL id = MoneyPuck id = our `nhlId`. EX/LD use real NHL-API career + our captaincy
(field or the legacy `''C''`/`''A''` name marker); PS uses the spec's SC/PH proxy when there's no
shootout sample. Verified: with feeds, McDavid FG 24 / SK 78 / DU 72; Tom Wilson FG 99 (fighter).

## Files

`types.ts` schemas · `math.ts` weighting/regression/percentile/curves · `config.ts` all
calibration (+ loads the two `*.calibrated.json`) · `params.ts` the 16 parameter calculators ·
`leagueEq.ts` AHL→NHL translation · `engine.ts` orchestrator · `qa.ts` old-vs-new ·
`sthsExport.ts` CSV · `demo.ts` sample roster · `cli.ts` demo runner · `loaders/moneypuck.ts` +
`loaders/assemble.ts` + `loaders/edge.ts` + `loaders/extras.ts` (injury/fights) data loaders ·
`calibrate.ts` fits `ref.calibrated.json` · `build.ts` full-roster runner (`--edge`/`--injury`/
`--fights` optional feeds) · `curves.calibrated.json` + `ref.calibrated.json` fitted values.
