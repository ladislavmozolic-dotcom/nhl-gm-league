// Visual layout for the PP/PK formation diagrams (Line Editor). Positions are
// illustrative percentages on an offensive-zone rink (y=0 the goal line,
// y=100 the blue line).
//
// Each role is a FIXED seat tied to a personnel slot, not something the sim
// reassigns by attribute fit: role[i] always means "whoever's in personnel
// slot i" (F1/F2/F3/D1/D2 on the PP, in that order) for a given tactic — the
// role name shown for a seat never changes just because the GM swapped which
// player occupies it. Every layout below is written in that exact slot
// order (forwards first, then defense), hand-curated per style so the
// forward slots land on forward-typical roles and the defense slots land on
// D-typical roles (Point, mainly) — the earlier attribute-based auto-fit
// version moved the role a player played depending on his stats, which read
// as unstable/inconsistent in the picker table once a slot's occupant
// changed; a fixed seat-to-role mapping is simpler and matches what the GM
// actually sees when picking personnel.
export type FormationRole = { key: string; label: string; x: number; y: number };

export const PP_LAYOUTS: Record<string, FormationRole[]> = {
  balanced: [
    { key: "r1", label: "LW", x: 26, y: 55 },
    { key: "r2", label: "C", x: 50, y: 38 },
    { key: "r3", label: "RW", x: 74, y: 55 },
    { key: "r4", label: "LD", x: 30, y: 84 },
    { key: "r5", label: "RD", x: 70, y: 84 },
  ],
  // Real 1-2-2 shape (per NHL coaching references): one point up top, two
  // half-walls at the tops of the circles, and TWO players low — one at the
  // net front, one working below the goal line/around the crease.
  umbrella: [
    { key: "r1", label: "Right Half-Wall", x: 76, y: 58 },
    { key: "r2", label: "Net-Front", x: 34, y: 20 },
    { key: "r3", label: "Below the Goal Line", x: 68, y: 14 },
    { key: "r4", label: "Point", x: 50, y: 84 },
    { key: "r5", label: "Left Half-Wall", x: 24, y: 58 },
  ],
  "131": [
    { key: "r1", label: "Right Half-Wall", x: 78, y: 58 },
    { key: "r2", label: "Bumper (one-timer)", x: 50, y: 40 },
    { key: "r3", label: "Net-Front", x: 50, y: 16 },
    { key: "r4", label: "Point", x: 50, y: 84 },
    { key: "r5", label: "Left Half-Wall", x: 22, y: 58 },
  ],
  overload: [
    { key: "r1", label: "Corner", x: 16, y: 34 },
    { key: "r2", label: "Net-Front", x: 50, y: 18 },
    { key: "r3", label: "Backdoor", x: 78, y: 30 },
    { key: "r4", label: "Point", x: 62, y: 82 },
    { key: "r5", label: "Half-Boards", x: 28, y: 60 },
  ],
};

export const PK_LAYOUTS: Record<string, FormationRole[]> = {
  balanced: [
    { key: "r1", label: "C", x: 32, y: 52 },
    { key: "r2", label: "W", x: 68, y: 52 },
    { key: "r3", label: "LD", x: 32, y: 80 },
    { key: "r4", label: "RD", x: 68, y: 80 },
  ],
  box: [
    { key: "r1", label: "Left Top", x: 34, y: 40 },
    { key: "r2", label: "Right Top", x: 66, y: 40 },
    { key: "r3", label: "Left D", x: 34, y: 78 },
    { key: "r4", label: "Right D", x: 66, y: 78 },
  ],
  // Real 1-2-1: one forward pressures the point up top, two D guard the
  // half-wall seams on the flanks, one forward covers the net/slot down low.
  diamond: [
    { key: "r1", label: "Top (pressure)", x: 50, y: 32 },
    { key: "r2", label: "Net Coverage", x: 50, y: 82 },
    { key: "r3", label: "Left D", x: 24, y: 60 },
    { key: "r4", label: "Right D", x: 76, y: 60 },
  ],
  aggressive: [
    { key: "r1", label: "Pressure F", x: 40, y: 26 },
    { key: "r2", label: "Pressure F", x: 60, y: 26 },
    { key: "r3", label: "Left D", x: 32, y: 70 },
    { key: "r4", label: "Right D", x: 68, y: 70 },
  ],
};

// A 5-on-3 kill is always physically a triangle (1F + 2D — there's no 4th man
// to make a real box/diamond shape), so the four pkStyle picks don't change
// the SHAPE here the way they do at 4-on-5 — they change how high/aggressive
// the lone forward plays, which is the one real tactical knob left at 3 men.
export const PK3_LAYOUTS: Record<string, FormationRole[]> = {
  balanced: [
    { key: "r1", label: "C", x: 50, y: 46 },
    { key: "r2", label: "LD", x: 32, y: 82 },
    { key: "r3", label: "RD", x: 68, y: 82 },
  ],
  box: [
    { key: "r1", label: "Top (protect middle)", x: 50, y: 42 },
    { key: "r2", label: "Left D", x: 32, y: 80 },
    { key: "r3", label: "Right D", x: 68, y: 80 },
  ],
  diamond: [
    { key: "r1", label: "Top (read passes)", x: 50, y: 36 },
    { key: "r2", label: "Left D", x: 30, y: 82 },
    { key: "r3", label: "Right D", x: 70, y: 82 },
  ],
  aggressive: [
    { key: "r1", label: "Pressure F", x: 50, y: 24 },
    { key: "r2", label: "Left D", x: 32, y: 76 },
    { key: "r3", label: "Right D", x: 68, y: 76 },
  ],
};
