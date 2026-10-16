// Jersey colours for the 3D rink. The home side wears its dark (primary) sweater,
// the visitors wear white trimmed in their primary — exactly like a real NHL
// broadcast, which also guarantees the two sides never clash on the ice.

export type Kit = { jersey: string; trim: string; number: string; pants: string; helmet: string };

// primary / secondary per NHL club code
const NHL: Record<string, [string, string]> = {
  ANA: ["#111111", "#f47a38"], BOS: ["#111111", "#ffb81c"], BUF: ["#003087", "#ffb81c"], CGY: ["#c8102e", "#f1be48"],
  CAR: ["#cc0000", "#111111"], CHI: ["#cf0a2c", "#111111"], COL: ["#6f263d", "#236192"], CBJ: ["#002654", "#ce1126"],
  DAL: ["#006847", "#8f8f8c"], DET: ["#ce1126", "#ffffff"], EDM: ["#041e42", "#ff4c00"], FLA: ["#041e42", "#c8102e"],
  LAK: ["#111111", "#a2aaad"], MIN: ["#154734", "#a6192e"], MTL: ["#af1e2d", "#192168"], NSH: ["#ffb81c", "#041e42"],
  NJD: ["#ce1126", "#111111"], NYI: ["#00539b", "#f47d30"], NYR: ["#0038a8", "#ce1126"], OTT: ["#c52032", "#111111"],
  PHI: ["#f74902", "#111111"], PIT: ["#111111", "#fcb514"], SJS: ["#006d75", "#ea7200"], SEA: ["#001628", "#99d9d9"],
  STL: ["#002f87", "#fcb514"], TBL: ["#002868", "#ffffff"], TOR: ["#00205b", "#ffffff"], UTA: ["#010101", "#6cace4"],
  VAN: ["#00205b", "#00843d"], VGK: ["#333f42", "#b4975a"], WSH: ["#041e42", "#c8102e"], WPG: ["#041e42", "#004c97"],
};

// AHL affiliates and anything unknown: a stable pick from a broadcast-friendly palette
const FALLBACK: Array<[string, string]> = [
  ["#7a1f2b", "#f2c14e"], ["#1d3f72", "#e4e4e4"], ["#0f5132", "#f8c537"], ["#3b2a6b", "#c0c0c0"],
  ["#8a2c0d", "#111111"], ["#14465c", "#f28c28"], ["#4a4a4a", "#d72631"], ["#5c1a5c", "#4fc3f7"],
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function pair(code: string | null | undefined, name: string): [string, string] {
  const c = (code ?? "").toUpperCase();
  return NHL[c] ?? FALLBACK[hash(c || name) % FALLBACK.length];
}

/** Light vs dark text for a background (relative luminance). */
function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? "#111111" : "#ffffff";
}

export function teamKit(code: string | null | undefined, name: string, home: boolean): Kit {
  const [primary, secondary] = pair(code, name);
  if (home) return { jersey: primary, trim: secondary, number: inkOn(primary), pants: "#151515", helmet: primary };
  return { jersey: "#f4f4f4", trim: primary, number: primary, pants: "#151515", helmet: "#f4f4f4" };
}
