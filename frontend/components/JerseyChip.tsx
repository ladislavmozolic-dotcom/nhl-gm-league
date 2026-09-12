"use client";

import { useEffect, useState } from "react";

// Real cropped/background-removed team jersey art (see /public/jerseys). Every
// team's baked-in "PLAYER"/"00" placeholder has been erased and calibrated
// (position + font size, both as % of the image's own width so they scale
// with the `size` prop) for a live name/number overlay — see CALIBRATION.
type Calib = {
  numberLeftPct: number; numberTopPct: number; numberFontPct: number; numberMaxWidthPct: number;
  nameLeftPct: number; nameTopPct: number; nameFontBasePct: number; nameMaxWidthPct: number;
  textColor: string;
};

// numberMaxWidthPct/nameMaxWidthPct cap how wide the text is allowed to render, as a
// % of the image's own width. Derived from the jersey's alpha channel (the actual
// garment silhouette at the number/name's vertical position) scaled down further,
// since that silhouette includes the sleeves — much wider than the narrower chest
// "plate" text should stay inside.
const CALIBRATION: Record<string, Calib> = {
  "pittsburgh-penguins": { numberLeftPct: 49.8, numberTopPct: 48.1, numberFontPct: 22.62, numberMaxWidthPct: 60.425, nameLeftPct: 49.8, nameTopPct: 19.3, nameFontBasePct: 10.71, nameMaxWidthPct: 50.189, textColor: "#ffffff" },
  "anaheim-ducks": { numberLeftPct: 49.5, numberTopPct: 62.29, numberFontPct: 19.598, numberMaxWidthPct: 59.447, nameLeftPct: 49.5, nameTopPct: 37.29, nameFontBasePct: 15.829, nameMaxWidthPct: 50.302, textColor: "#f5f2f0" },
  "boston-bruins": { numberLeftPct: 49.75, numberTopPct: 62.29, numberFontPct: 19.403, numberMaxWidthPct: 60.249, nameLeftPct: 49.5, nameTopPct: 36.86, nameFontBasePct: 16.542, nameMaxWidthPct: 51.891, textColor: "#fffffd" },
  "buffalo-sabres": { numberLeftPct: 49.75, numberTopPct: 67.37, numberFontPct: 13.568, numberMaxWidthPct: 60.854, nameLeftPct: 49.75, nameTopPct: 42.37, nameFontBasePct: 26.382, nameMaxWidthPct: 52.412, textColor: "#fefefe" },
  "calgary-flames": { numberLeftPct: 50, numberTopPct: 65.68, numberFontPct: 20.976, numberMaxWidthPct: 59.073, nameLeftPct: 50.24, nameTopPct: 37.71, nameFontBasePct: 16.22, nameMaxWidthPct: 49.854, textColor: "#f6f5f4" },
  "carolina-hurricanes": { numberLeftPct: 49.76, numberTopPct: 64.89, numberFontPct: 17.561, numberMaxWidthPct: 60.439, nameLeftPct: 49.76, nameTopPct: 40.84, nameFontBasePct: 21.341, nameMaxWidthPct: 52.585, textColor: "#fcffff" },
  "chicago-blackhawks": { numberLeftPct: 50.48, numberTopPct: 63.74, numberFontPct: 18.841, numberMaxWidthPct: 60.531, nameLeftPct: 49.76, nameTopPct: 40.46, nameFontBasePct: 16.908, nameMaxWidthPct: 52.415, textColor: "#ffffff" },
  "colorado-avalanche": { numberLeftPct: 50, numberTopPct: 62.2, numberFontPct: 18.719, numberMaxWidthPct: 60, nameLeftPct: 49.26, nameTopPct: 37.01, nameFontBasePct: 17.241, nameMaxWidthPct: 51.379, textColor: "#ffffff" },
  "columbus-blue-jackets": { numberLeftPct: 49.51, numberTopPct: 62.21, numberFontPct: 21.078, numberMaxWidthPct: 59.706, nameLeftPct: 49.51, nameTopPct: 38.17, nameFontBasePct: 15.441, nameMaxWidthPct: 51.127, textColor: "#faffff" },
  "dallas-stars": { numberLeftPct: 50.25, numberTopPct: 61.36, numberFontPct: 22.66, numberMaxWidthPct: 60, nameLeftPct: 50, nameTopPct: 35.23, nameFontBasePct: 18.103, nameMaxWidthPct: 52.414, textColor: "#ffffff" },
  "detroit-red-wings": { numberLeftPct: 50.25, numberTopPct: 62.5, numberFontPct: 21.182, numberMaxWidthPct: 60.69, nameLeftPct: 50, nameTopPct: 36.36, nameFontBasePct: 20.69, nameMaxWidthPct: 52.759, textColor: "#ffffff" },
  "edmonton-oilers": { numberLeftPct: 49.75, numberTopPct: 51.14, numberFontPct: 35.961, numberMaxWidthPct: 58.276, nameLeftPct: 49.51, nameTopPct: 13.26, nameFontBasePct: 19.828, nameMaxWidthPct: 40.345, textColor: "#fefdfd" },
  "florida-panthers": { numberLeftPct: 50.24, numberTopPct: 63.26, numberFontPct: 19.903, numberMaxWidthPct: 61.165, nameLeftPct: 50, nameTopPct: 37.88, nameFontBasePct: 20.388, nameMaxWidthPct: 51.99, textColor: "#ffffff" },
  "los-angeles-kings": { numberLeftPct: 49.75, numberTopPct: 59.54, numberFontPct: 24.631, numberMaxWidthPct: 60.69, nameLeftPct: 49.51, nameTopPct: 30.15, nameFontBasePct: 21.552, nameMaxWidthPct: 51.724, textColor: "#eaebec" },
  "minnesota-wild": { numberLeftPct: 50.24, numberTopPct: 58.02, numberFontPct: 26.087, numberMaxWidthPct: 61.208, nameLeftPct: 49.76, nameTopPct: 28.63, nameFontBasePct: 17.754, nameMaxWidthPct: 51.739, textColor: "#ffffff" },
  "montreal-canadiens": { numberLeftPct: 49.75, numberTopPct: 58.4, numberFontPct: 25.98, numberMaxWidthPct: 61.422, nameLeftPct: 49.51, nameTopPct: 29.39, nameFontBasePct: 18.015, nameMaxWidthPct: 53.186, textColor: "#ffffff" },
  "nashville-predators": { numberLeftPct: 49.76, numberTopPct: 59.16, numberFontPct: 24.878, numberMaxWidthPct: 61.122, nameLeftPct: 49.51, nameTopPct: 30.15, nameFontBasePct: 16.22, nameMaxWidthPct: 52.244, textColor: "#ffecaf" },
  "new-jersey-devils": { numberLeftPct: 50.25, numberTopPct: 56.11, numberFontPct: 26.961, numberMaxWidthPct: 61.078, nameLeftPct: 50, nameTopPct: 19.47, nameFontBasePct: 33.456, nameMaxWidthPct: 50.098, textColor: "#efefef" },
  "new-york-islanders": { numberLeftPct: 50, numberTopPct: 56.11, numberFontPct: 28.78, numberMaxWidthPct: 61.122, nameLeftPct: 49.76, nameTopPct: 24.81, nameFontBasePct: 17.927, nameMaxWidthPct: 51.22, textColor: "#fffdfc" },
  "new-york-rangers": { numberLeftPct: 50, numberTopPct: 58.02, numberFontPct: 26.471, numberMaxWidthPct: 61.765, nameLeftPct: 49.75, nameTopPct: 27.1, nameFontBasePct: 21.446, nameMaxWidthPct: 52.843, textColor: "#ffffff" },
  "ottawa-senators": { numberLeftPct: 50, numberTopPct: 56.87, numberFontPct: 24.638, numberMaxWidthPct: 61.208, nameLeftPct: 49.76, nameTopPct: 27.1, nameFontBasePct: 21.135, nameMaxWidthPct: 51.739, textColor: "#fffffe" },
  "philadelphia-flyers": { numberLeftPct: 45.02, numberTopPct: 55.68, numberFontPct: 30.348, numberMaxWidthPct: 61.642, nameLeftPct: 49.25, nameTopPct: 22.73, nameFontBasePct: 20.896, nameMaxWidthPct: 52.935, textColor: "#feffff" },
  "san-jose-sharks": { numberLeftPct: 49.28, numberTopPct: 54.92, numberFontPct: 30.288, numberMaxWidthPct: 61.923, nameLeftPct: 49.28, nameTopPct: 22.35, nameFontBasePct: 17.668, nameMaxWidthPct: 51.827, textColor: "#ffffff" },
  "seattle-kraken": { numberLeftPct: 49.51, numberTopPct: 54.55, numberFontPct: 31.068, numberMaxWidthPct: 61.845, nameLeftPct: 49.27, nameTopPct: 21.59, nameFontBasePct: 17.84, nameMaxWidthPct: 51.99, textColor: "#ffffff" },
  "st-louis-blues": { numberLeftPct: 50.49, numberTopPct: 53.05, numberFontPct: 33.005, numberMaxWidthPct: 62.414, nameLeftPct: 50, nameTopPct: 18.32, nameFontBasePct: 18.966, nameMaxWidthPct: 52.069, textColor: "#ffffff" },
  "tampa-bay-lightning": { numberLeftPct: 49.76, numberTopPct: 53.05, numberFontPct: 32.367, numberMaxWidthPct: 61.546, nameLeftPct: 49.52, nameTopPct: 18.32, nameFontBasePct: 18.599, nameMaxWidthPct: 50.725, textColor: "#ffffff" },
  "toronto-maple-leafs": { numberLeftPct: 49.51, numberTopPct: 52.67, numberFontPct: 33.498, numberMaxWidthPct: 62.069, nameLeftPct: 49.51, nameTopPct: 17.56, nameFontBasePct: 18.966, nameMaxWidthPct: 52.069, textColor: "#ffffff" },
  "utah-mammoth": { numberLeftPct: 49.76, numberTopPct: 51.91, numberFontPct: 34.146, numberMaxWidthPct: 61.463, nameLeftPct: 49.76, nameTopPct: 14.5, nameFontBasePct: 22.195, nameMaxWidthPct: 50.195, textColor: "#ffffff" },
  "vancouver-canucks": { numberLeftPct: 49.75, numberTopPct: 51.89, numberFontPct: 34.804, numberMaxWidthPct: 63.48, nameLeftPct: 49.75, nameTopPct: 15.15, nameFontBasePct: 20.588, nameMaxWidthPct: 52.5, textColor: "#ffffff" },
  "vegas-golden-knights": { numberLeftPct: 50.24, numberTopPct: 51.89, numberFontPct: 34.634, numberMaxWidthPct: 62.488, nameLeftPct: 49.76, nameTopPct: 15.15, nameFontBasePct: 20.488, nameMaxWidthPct: 52.585, textColor: "#ffffff" },
  "washington-capitals": { numberLeftPct: 49.5, numberTopPct: 51.89, numberFontPct: 35.149, numberMaxWidthPct: 62.376, nameLeftPct: 49.75, nameTopPct: 15.53, nameFontBasePct: 19.926, nameMaxWidthPct: 52.673, textColor: "#ffffff" },
  "winnipeg-jets": { numberLeftPct: 49.75, numberTopPct: 52.65, numberFontPct: 33.824, numberMaxWidthPct: 62.794, nameLeftPct: 49.75, nameTopPct: 16.29, nameFontBasePct: 21.446, nameMaxWidthPct: 52.5, textColor: "#ffffff" },
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
        <span style={{ position: "absolute", left: `${c.numberLeftPct}%`, top: `${c.numberTopPct}%`, transform: "translate(-50%, -50%)", fontSize: numberFontPx, fontWeight: 800, color: c.textColor, letterSpacing: -0.5, textShadow: "0 1px 2px rgba(0,0,0,0.5)", pointerEvents: "none" }}>
          {numberText}
        </span>
      )}
      {c && lastName && (
        <span style={{ position: "absolute", left: `${c.nameLeftPct}%`, top: `${c.nameTopPct}%`, transform: "translate(-50%, -50%)", fontSize: nameFontPx, fontWeight: 800, color: c.textColor, letterSpacing: 0.3, textShadow: "0 1px 1px rgba(0,0,0,0.5)", pointerEvents: "none", whiteSpace: "nowrap" }}>
          {nameText}
        </span>
      )}
    </div>
  );
}
