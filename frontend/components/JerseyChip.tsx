"use client";

// Real cropped/background-removed team jersey art (see /public/jerseys). Every
// team's baked-in "PLAYER"/"00" placeholder has been erased and calibrated
// (position + font size, both as % of the image's own width so they scale
// with the `size` prop) for a live name/number overlay — see CALIBRATION.
type Calib = {
  numberLeftPct: number; numberTopPct: number; numberFontPct: number;
  nameLeftPct: number; nameTopPct: number; nameFontBasePct: number;
  textColor: string;
};

const CALIBRATION: Record<string, Calib> = {
  "pittsburgh-penguins": { numberLeftPct: 49.8, numberTopPct: 48.1, numberFontPct: 22.62, nameLeftPct: 49.8, nameTopPct: 19.3, nameFontBasePct: 10.71, textColor: "#ffffff" },
  "anaheim-ducks": { numberLeftPct: 49.5, numberTopPct: 62.29, numberFontPct: 19.598, nameLeftPct: 49.5, nameTopPct: 37.29, nameFontBasePct: 15.829, textColor: "#f5f2f0" },
  "boston-bruins": { numberLeftPct: 49.75, numberTopPct: 62.29, numberFontPct: 19.403, nameLeftPct: 49.5, nameTopPct: 36.86, nameFontBasePct: 16.542, textColor: "#fffffd" },
  "buffalo-sabres": { numberLeftPct: 49.75, numberTopPct: 67.37, numberFontPct: 13.568, nameLeftPct: 49.75, nameTopPct: 42.37, nameFontBasePct: 26.382, textColor: "#fefefe" },
  "calgary-flames": { numberLeftPct: 50.0, numberTopPct: 65.68, numberFontPct: 20.976, nameLeftPct: 50.24, nameTopPct: 37.71, nameFontBasePct: 16.22, textColor: "#f6f5f4" },
  "carolina-hurricanes": { numberLeftPct: 49.76, numberTopPct: 64.89, numberFontPct: 17.561, nameLeftPct: 49.76, nameTopPct: 40.84, nameFontBasePct: 21.341, textColor: "#fcffff" },
  "chicago-blackhawks": { numberLeftPct: 50.48, numberTopPct: 63.74, numberFontPct: 18.841, nameLeftPct: 49.76, nameTopPct: 40.46, nameFontBasePct: 16.908, textColor: "#ffffff" },
  "colorado-avalanche": { numberLeftPct: 50.0, numberTopPct: 62.2, numberFontPct: 18.719, nameLeftPct: 49.26, nameTopPct: 37.01, nameFontBasePct: 17.241, textColor: "#ffffff" },
  "columbus-blue-jackets": { numberLeftPct: 49.51, numberTopPct: 62.21, numberFontPct: 21.078, nameLeftPct: 49.51, nameTopPct: 38.17, nameFontBasePct: 15.441, textColor: "#faffff" },
  "dallas-stars": { numberLeftPct: 50.25, numberTopPct: 61.36, numberFontPct: 22.66, nameLeftPct: 50.0, nameTopPct: 35.23, nameFontBasePct: 18.103, textColor: "#ffffff" },
  "detroit-red-wings": { numberLeftPct: 50.25, numberTopPct: 62.5, numberFontPct: 21.182, nameLeftPct: 50.0, nameTopPct: 36.36, nameFontBasePct: 20.69, textColor: "#ffffff" },
  "edmonton-oilers": { numberLeftPct: 49.75, numberTopPct: 51.14, numberFontPct: 35.961, nameLeftPct: 49.51, nameTopPct: 13.26, nameFontBasePct: 19.828, textColor: "#fefdfd" },
  "florida-panthers": { numberLeftPct: 50.24, numberTopPct: 63.26, numberFontPct: 19.903, nameLeftPct: 50.0, nameTopPct: 37.88, nameFontBasePct: 20.388, textColor: "#ffffff" },
  "los-angeles-kings": { numberLeftPct: 49.75, numberTopPct: 59.54, numberFontPct: 24.631, nameLeftPct: 49.51, nameTopPct: 30.15, nameFontBasePct: 21.552, textColor: "#eaebec" },
  "minnesota-wild": { numberLeftPct: 50.24, numberTopPct: 58.02, numberFontPct: 26.087, nameLeftPct: 49.76, nameTopPct: 28.63, nameFontBasePct: 17.754, textColor: "#ffffff" },
  "montreal-canadiens": { numberLeftPct: 49.75, numberTopPct: 58.4, numberFontPct: 25.98, nameLeftPct: 49.51, nameTopPct: 29.39, nameFontBasePct: 18.015, textColor: "#ffffff" },
  "nashville-predators": { numberLeftPct: 49.76, numberTopPct: 59.16, numberFontPct: 24.878, nameLeftPct: 49.51, nameTopPct: 30.15, nameFontBasePct: 16.22, textColor: "#ffecaf" },
  "new-jersey-devils": { numberLeftPct: 50.25, numberTopPct: 56.11, numberFontPct: 26.961, nameLeftPct: 50.0, nameTopPct: 19.47, nameFontBasePct: 33.456, textColor: "#efefef" },
  "new-york-islanders": { numberLeftPct: 50.0, numberTopPct: 56.11, numberFontPct: 28.78, nameLeftPct: 49.76, nameTopPct: 24.81, nameFontBasePct: 17.927, textColor: "#fffdfc" },
  "new-york-rangers": { numberLeftPct: 50.0, numberTopPct: 58.02, numberFontPct: 26.471, nameLeftPct: 49.75, nameTopPct: 27.1, nameFontBasePct: 21.446, textColor: "#ffffff" },
  "ottawa-senators": { numberLeftPct: 50.0, numberTopPct: 56.87, numberFontPct: 24.638, nameLeftPct: 49.76, nameTopPct: 27.1, nameFontBasePct: 21.135, textColor: "#fffffe" },
  "philadelphia-flyers": { numberLeftPct: 45.02, numberTopPct: 55.68, numberFontPct: 30.348, nameLeftPct: 49.25, nameTopPct: 22.73, nameFontBasePct: 20.896, textColor: "#feffff" },
  "san-jose-sharks": { numberLeftPct: 49.28, numberTopPct: 54.92, numberFontPct: 30.288, nameLeftPct: 49.28, nameTopPct: 22.35, nameFontBasePct: 17.668, textColor: "#ffffff" },
  "seattle-kraken": { numberLeftPct: 49.51, numberTopPct: 54.55, numberFontPct: 31.068, nameLeftPct: 49.27, nameTopPct: 21.59, nameFontBasePct: 17.84, textColor: "#ffffff" },
  "st-louis-blues": { numberLeftPct: 50.49, numberTopPct: 53.05, numberFontPct: 33.005, nameLeftPct: 50.0, nameTopPct: 18.32, nameFontBasePct: 18.966, textColor: "#ffffff" },
  "tampa-bay-lightning": { numberLeftPct: 49.76, numberTopPct: 53.05, numberFontPct: 32.367, nameLeftPct: 49.52, nameTopPct: 18.32, nameFontBasePct: 18.599, textColor: "#ffffff" },
  "toronto-maple-leafs": { numberLeftPct: 49.51, numberTopPct: 52.67, numberFontPct: 33.498, nameLeftPct: 49.51, nameTopPct: 17.56, nameFontBasePct: 18.966, textColor: "#ffffff" },
  "utah-mammoth": { numberLeftPct: 49.76, numberTopPct: 51.91, numberFontPct: 34.146, nameLeftPct: 49.76, nameTopPct: 14.5, nameFontBasePct: 22.195, textColor: "#ffffff" },
  "vancouver-canucks": { numberLeftPct: 49.75, numberTopPct: 51.89, numberFontPct: 34.804, nameLeftPct: 49.75, nameTopPct: 15.15, nameFontBasePct: 20.588, textColor: "#ffffff" },
  "vegas-golden-knights": { numberLeftPct: 50.24, numberTopPct: 51.89, numberFontPct: 34.634, nameLeftPct: 49.76, nameTopPct: 15.15, nameFontBasePct: 20.488, textColor: "#ffffff" },
  "washington-capitals": { numberLeftPct: 49.5, numberTopPct: 51.89, numberFontPct: 35.149, nameLeftPct: 49.75, nameTopPct: 15.53, nameFontBasePct: 19.926, textColor: "#ffffff" },
  "winnipeg-jets": { numberLeftPct: 49.75, numberTopPct: 52.65, numberFontPct: 33.824, nameLeftPct: 49.75, nameTopPct: 16.29, nameFontBasePct: 21.446, textColor: "#ffffff" },
};

// name font shrinks for longer surnames so a long one still fits the plate —
// ratios relative to nameFontBasePct (a <=4-char name gets the full base size).
const nameSizeRatio = (n: string) => (n.length <= 4 ? 1 : n.length <= 6 ? 0.922 : n.length <= 8 ? 0.8 : 0.7);

export default function JerseyChip({ teamSlug, number, lastName, size = 84 }: {
  teamSlug: string; number?: number | null; lastName?: string | null; size?: number;
}) {
  const c = CALIBRATION[teamSlug];
  return (
    <div style={{ position: "relative", width: size, flex: "none" }}>
      <img src={`/jerseys/${teamSlug}.png`} alt="" style={{ display: "block", width: "100%", height: "auto", borderRadius: 4 }} />
      {c && number != null && (
        <span style={{ position: "absolute", left: `${c.numberLeftPct}%`, top: `${c.numberTopPct}%`, transform: "translate(-50%, -50%)", fontSize: Math.round((c.numberFontPct / 100) * size), fontWeight: 800, color: c.textColor, letterSpacing: -0.5, textShadow: "0 1px 2px rgba(0,0,0,0.5)", pointerEvents: "none" }}>
          {number}
        </span>
      )}
      {c && lastName && (
        <span style={{ position: "absolute", left: `${c.nameLeftPct}%`, top: `${c.nameTopPct}%`, transform: "translate(-50%, -50%)", fontSize: Math.round((c.nameFontBasePct / 100) * size * nameSizeRatio(lastName)), fontWeight: 800, color: c.textColor, letterSpacing: 0.3, textShadow: "0 1px 1px rgba(0,0,0,0.5)", pointerEvents: "none", whiteSpace: "nowrap" }}>
          {lastName.toUpperCase()}
        </span>
      )}
    </div>
  );
}
