"use client";

import { useEffect, useState } from "react";

// Real cropped/background-removed team jersey art (see /public/jerseys), all
// re-rendered in 2026 from one shared back-view template (same 700x590 canvas,
// same name-plate/number/sleeve-number geometry for every team) with the
// baked-in sample player's name/number erased down to the bare panel color —
// see CALIBRATION for the live name/number overlay. Because every team shares
// the same template, numberLeftPct/numberTopPct/nameLeftPct/nameTopPct/
// numberFontPct/nameFontBasePct/numberMaxWidthPct/nameMaxWidthPct are the same
// for every team; only the lettering color(s) differ per team's real jersey.
type Calib = {
  numberLeftPct: number; numberTopPct: number; numberFontPct: number; numberMaxWidthPct: number;
  nameLeftPct: number; nameTopPct: number; nameFontBasePct: number; nameMaxWidthPct: number;
  textColor: string;
  // overrides textColor for just the number/name span, for the handful of teams
  // whose real jersey uses a different color for the number than the name plate.
  numberColor?: string;
  nameColor?: string;
};

const SHARED_GEOMETRY = {
  numberLeftPct: 50, numberTopPct: 57.8, numberFontPct: 30, numberMaxWidthPct: 46,
  nameLeftPct: 50, nameTopPct: 31.4, nameFontBasePct: 12, nameMaxWidthPct: 52,
};

const CALIBRATION: Record<string, Calib> = {
  "anaheim-ducks": { ...SHARED_GEOMETRY, textColor: "#ffffff" },
  "boston-bruins": { ...SHARED_GEOMETRY, textColor: "#ffb81c" },
  "buffalo-sabres": { ...SHARED_GEOMETRY, textColor: "#ffb81c" },
  "calgary-flames": { ...SHARED_GEOMETRY, textColor: "#f1be48" },
  "carolina-hurricanes": { ...SHARED_GEOMETRY, textColor: "#ffffff" },
  "chicago-blackhawks": { ...SHARED_GEOMETRY, textColor: "#ffffff" },
  "colorado-avalanche": { ...SHARED_GEOMETRY, textColor: "#ffffff" },
  "columbus-blue-jackets": { ...SHARED_GEOMETRY, textColor: "#ffffff" },
  "dallas-stars": { ...SHARED_GEOMETRY, textColor: "#ffffff" },
  "detroit-red-wings": { ...SHARED_GEOMETRY, textColor: "#ffffff" },
  "edmonton-oilers": { ...SHARED_GEOMETRY, textColor: "#ffffff", numberColor: "#ff4c00" },
  "florida-panthers": { ...SHARED_GEOMETRY, textColor: "#ffffff" },
  "los-angeles-kings": { ...SHARED_GEOMETRY, textColor: "#a2aaad" },
  "minnesota-wild": { ...SHARED_GEOMETRY, textColor: "#ddcba8" },
  "montreal-canadiens": { ...SHARED_GEOMETRY, textColor: "#ffffff" },
  "nashville-predators": { ...SHARED_GEOMETRY, textColor: "#ffb81c" },
  "new-jersey-devils": { ...SHARED_GEOMETRY, textColor: "#ffffff" },
  "new-york-islanders": { ...SHARED_GEOMETRY, textColor: "#ffffff" },
  "new-york-rangers": { ...SHARED_GEOMETRY, textColor: "#ffffff", numberColor: "#c8102e" },
  "ottawa-senators": { ...SHARED_GEOMETRY, textColor: "#ffffff" },
  "philadelphia-flyers": { ...SHARED_GEOMETRY, textColor: "#ffffff" },
  "pittsburgh-penguins": { ...SHARED_GEOMETRY, textColor: "#ffb81c" },
  "san-jose-sharks": { ...SHARED_GEOMETRY, textColor: "#ffffff" },
  "seattle-kraken": { ...SHARED_GEOMETRY, textColor: "#99d9d9" },
  "st-louis-blues": { ...SHARED_GEOMETRY, textColor: "#041e42" },
  "tampa-bay-lightning": { ...SHARED_GEOMETRY, textColor: "#ffffff" },
  "toronto-maple-leafs": { ...SHARED_GEOMETRY, textColor: "#ffffff" },
  "utah-mammoth": { ...SHARED_GEOMETRY, textColor: "#ffffff" },
  "vancouver-canucks": { ...SHARED_GEOMETRY, textColor: "#ffffff" },
  "vegas-golden-knights": { ...SHARED_GEOMETRY, textColor: "#c8c9c7" },
  "washington-capitals": { ...SHARED_GEOMETRY, textColor: "#ffffff" },
  "winnipeg-jets": { ...SHARED_GEOMETRY, textColor: "#ffffff" },
};

// name font shrinks for longer surnames so a long one still fits the plate —
// ratios relative to nameFontBasePct (a <=4-char name gets the full base size).
const nameSizeRatio = (n: string) => (n.length <= 4 ? 1 : n.length <= 6 ? 0.922 : n.length <= 8 ? 0.8 : 0.7);

// The per-team calibration above only accounts for name length in coarse buckets,
// which isn't enough for wide letters (M/W) or teams with a large nameFontBasePct —
// text can still run past the jersey art's edges. As a hard safety net, measure the
// actual rendered width (canvas, since layout isn't known until after paint) and
// shrink further so it never exceeds a safe fraction of the jersey's own width.
let measureCtx: CanvasRenderingContext2D | null | undefined;
function getMeasureCtx() {
  if (measureCtx === undefined) {
    measureCtx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  }
  return measureCtx;
}
function fitFontSize(text: string, fontSizePx: number, letterSpacingPx: number, maxWidthPx: number): number {
  const ctx = getMeasureCtx();
  if (!ctx || !text || fontSizePx <= 0) return fontSizePx;
  ctx.font = `800 ${fontSizePx}px system-ui, -apple-system, sans-serif`;
  const width = ctx.measureText(text).width + letterSpacingPx * Math.max(0, text.length - 1);
  if (width <= maxWidthPx) return fontSizePx;
  return Math.max(8, Math.floor(fontSizePx * (maxWidthPx / width)));
}

export default function JerseyChip({ teamSlug, number, lastName, size = 84 }: {
  teamSlug: string; number?: number | null; lastName?: string | null; size?: number;
}) {
  const c = CALIBRATION[teamSlug];
  const numberText = number != null ? String(number) : "";
  const nameText = lastName ? lastName.toUpperCase() : "";
  const numberBaseFontPx = c ? Math.round((c.numberFontPct / 100) * size) : 0;
  const nameBaseFontPx = c ? Math.round((c.nameFontBasePct / 100) * size * nameSizeRatio(nameText)) : 0;

  // start at the calibrated size (matches server render) and correct down to fit
  // once we can measure text in the browser, avoiding a hydration mismatch.
  const [numberFontPx, setNumberFontPx] = useState(numberBaseFontPx);
  const [nameFontPx, setNameFontPx] = useState(nameBaseFontPx);

  useEffect(() => {
    if (!c) return;
    setNumberFontPx(fitFontSize(numberText, numberBaseFontPx, -0.5, (c.numberMaxWidthPct / 100) * size));
  }, [numberText, numberBaseFontPx, size, c]);

  useEffect(() => {
    if (!c) return;
    setNameFontPx(fitFontSize(nameText, nameBaseFontPx, 0.3, (c.nameMaxWidthPct / 100) * size));
  }, [nameText, nameBaseFontPx, size, c]);

  return (
    <div style={{ position: "relative", width: size, flex: "none" }}>
      <img src={`/jerseys/${teamSlug}.png`} alt="" style={{ display: "block", width: "100%", height: "auto", borderRadius: 4 }} />
      {c && number != null && (
        <span style={{ position: "absolute", left: `${c.numberLeftPct}%`, top: `${c.numberTopPct}%`, transform: "translate(-50%, -50%)", fontSize: numberFontPx, fontWeight: 800, color: c.numberColor ?? c.textColor, letterSpacing: -0.5, textShadow: "0 1px 2px rgba(0,0,0,0.5)", pointerEvents: "none" }}>
          {numberText}
        </span>
      )}
      {c && lastName && (
        <span style={{ position: "absolute", left: `${c.nameLeftPct}%`, top: `${c.nameTopPct}%`, transform: "translate(-50%, -50%)", fontSize: nameFontPx, fontWeight: 800, color: c.nameColor ?? c.textColor, letterSpacing: 0.3, textShadow: "0 1px 1px rgba(0,0,0,0.5)", pointerEvents: "none", whiteSpace: "nowrap" }}>
          {nameText}
        </span>
      )}
    </div>
  );
}
