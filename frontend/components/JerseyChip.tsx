"use client";

// Real cropped/background-removed team jersey art (see /public/jerseys). Only teams
// in BLANK_TEAMS had their baked-in "PLAYER"/"00" placeholder erased and calibrated
// for the name/number overlay below — every other team still shows the placeholder
// text on the fabric (the real name/OV/CON already render as normal text elsewhere
// in the slot), until the same erase+calibrate pass is done for the rest of the league.
const BLANK_TEAMS = new Set(["pittsburgh-penguins"]);

const nameSize = (n: string) => (n.length <= 4 ? 9 : n.length <= 6 ? 8.3 : n.length <= 8 ? 7.2 : 6.3);

export default function JerseyChip({ teamSlug, number, lastName, size = 84 }: {
  teamSlug: string; number?: number | null; lastName?: string | null; size?: number;
}) {
  const blank = BLANK_TEAMS.has(teamSlug);
  return (
    <div style={{ position: "relative", width: size, flex: "none" }}>
      <img src={`/jerseys/${teamSlug}.png`} alt="" style={{ display: "block", width: "100%", height: "auto", borderRadius: 4 }} />
      {blank && number != null && (
        <span style={{ position: "absolute", left: "49.8%", top: "48.1%", transform: "translate(-50%, -50%)", fontSize: 19, fontWeight: 800, color: "#fff", letterSpacing: -0.5, textShadow: "0 1px 2px rgba(0,0,0,0.5)", pointerEvents: "none" }}>
          {number}
        </span>
      )}
      {blank && lastName && (
        <span style={{ position: "absolute", left: "49.8%", top: "19.3%", transform: "translate(-50%, -50%)", fontSize: nameSize(lastName), fontWeight: 800, color: "#fff", letterSpacing: 0.3, textShadow: "0 1px 1px rgba(0,0,0,0.5)", pointerEvents: "none", whiteSpace: "nowrap" }}>
          {lastName.toUpperCase()}
        </span>
      )}
    </div>
  );
}
