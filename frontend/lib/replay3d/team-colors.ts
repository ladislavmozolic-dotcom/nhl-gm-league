// Jersey colours for the 3D rink. The home side wears its dark (primary) sweater,
// the visitors wear white trimmed in their primary — exactly like a real NHL / AHL
// broadcast, which also guarantees the two sides never clash on the ice.

export type Kit = {
  jersey: string;
  trim: string;
  stripe: string;
  number: string;
  numberBorder: string;
  pants: string;
  helmet: string;
  socks: string;
  socksTrim: string;
  shoulderYoke?: string;
  isDark: boolean;
};

type Palette = {
  primary: string;
  secondary: string;
  trim?: string;
  pants?: string;
  helmet?: string;
  yoke?: string;
};

// 32 NHL franchises
const NHL: Record<string, Palette> = {
  ANA: { primary: "#f47a38", secondary: "#111111", trim: "#b9975b", pants: "#111111", helmet: "#111111" },
  BOS: { primary: "#ffb81c", secondary: "#111111", trim: "#ffffff", pants: "#111111", helmet: "#111111" },
  BUF: { primary: "#003087", secondary: "#ffb81c", trim: "#ffffff", pants: "#003087", helmet: "#003087" },
  CGY: { primary: "#c8102e", secondary: "#f1be48", trim: "#ffffff", pants: "#c8102e", helmet: "#c8102e" },
  CAR: { primary: "#cc0000", secondary: "#111111", trim: "#a2aaad", pants: "#111111", helmet: "#111111" },
  CHI: { primary: "#cf0a2c", secondary: "#111111", trim: "#ffffff", pants: "#111111", helmet: "#111111" },
  COL: { primary: "#6f263d", secondary: "#236192", trim: "#a2aaad", pants: "#236192", helmet: "#6f263d" },
  CBJ: { primary: "#002654", secondary: "#ce1126", trim: "#a2aaad", pants: "#002654", helmet: "#002654" },
  DAL: { primary: "#006847", secondary: "#111111", trim: "#8f8f8c", pants: "#111111", helmet: "#006847" },
  DET: { primary: "#ce1126", secondary: "#ffffff", trim: "#ffffff", pants: "#ce1126", helmet: "#ce1126" },
  EDM: { primary: "#041e42", secondary: "#ff4c00", trim: "#ffffff", pants: "#041e42", helmet: "#041e42", yoke: "#ff4c00" },
  FLA: { primary: "#c8102e", secondary: "#041e42", trim: "#b9975b", pants: "#041e42", helmet: "#041e42" },
  LAK: { primary: "#111111", secondary: "#a2aaad", trim: "#ffffff", pants: "#111111", helmet: "#111111" },
  MIN: { primary: "#154734", secondary: "#a6192e", trim: "#ddcba4", pants: "#154734", helmet: "#154734" },
  MTL: { primary: "#af1e2d", secondary: "#192168", trim: "#ffffff", pants: "#192168", helmet: "#af1e2d" },
  NSH: { primary: "#ffb81c", secondary: "#041e42", trim: "#ffffff", pants: "#041e42", helmet: "#ffb81c" },
  NJD: { primary: "#ce1126", secondary: "#111111", trim: "#ffffff", pants: "#111111", helmet: "#111111" },
  NYI: { primary: "#00539b", secondary: "#f47d30", trim: "#ffffff", pants: "#00539b", helmet: "#00539b" },
  NYR: { primary: "#0038a8", secondary: "#ce1126", trim: "#ffffff", pants: "#0038a8", helmet: "#0038a8" },
  OTT: { primary: "#c52032", secondary: "#111111", trim: "#c29b38", pants: "#111111", helmet: "#111111" },
  PHI: { primary: "#f74902", secondary: "#111111", trim: "#ffffff", pants: "#111111", helmet: "#111111" },
  PIT: { primary: "#111111", secondary: "#fcb514", trim: "#ffffff", pants: "#111111", helmet: "#111111" },
  SJS: { primary: "#006d75", secondary: "#ea7200", trim: "#111111", pants: "#111111", helmet: "#006d75" },
  SEA: { primary: "#001628", secondary: "#99d9d9", trim: "#e93844", pants: "#001628", helmet: "#001628" },
  STL: { primary: "#002f87", secondary: "#fcb514", trim: "#041e42", pants: "#002f87", helmet: "#002f87" },
  TBL: { primary: "#002868", secondary: "#ffffff", trim: "#111111", pants: "#002868", helmet: "#002868" },
  TOR: { primary: "#00205b", secondary: "#ffffff", trim: "#ffffff", pants: "#00205b", helmet: "#00205b" },
  UTA: { primary: "#010101", secondary: "#6cace4", trim: "#ffffff", pants: "#010101", helmet: "#010101" },
  VAN: { primary: "#00205b", secondary: "#00843d", trim: "#ffffff", pants: "#00205b", helmet: "#00205b" },
  VGK: { primary: "#333f42", secondary: "#b4975a", trim: "#c8102e", pants: "#111111", helmet: "#333f42" },
  WSH: { primary: "#041e42", secondary: "#c8102e", trim: "#ffffff", pants: "#041e42", helmet: "#041e42" },
  WPG: { primary: "#041e42", secondary: "#004c97", trim: "#ac162c", pants: "#041e42", helmet: "#041e42" },
};

// 32 AHL franchises (keyed by slug / normalized name)
const AHL: Record<string, Palette> = {
  "ontario-reign": { primary: "#111111", secondary: "#a2aaad", trim: "#ffffff", pants: "#111111", helmet: "#111111" },
  "grand-rapids-griffins": { primary: "#ce1126", secondary: "#002868", trim: "#d4af37", pants: "#002868", helmet: "#ce1126" },
  "abbotsford-canucks": { primary: "#00205b", secondary: "#00843d", trim: "#ffffff", pants: "#00205b", helmet: "#00205b" },
  "bakersfield-condors": { primary: "#041e42", secondary: "#ff4c00", trim: "#ffffff", pants: "#041e42", helmet: "#041e42" },
  "belleville-senators": { primary: "#c52032", secondary: "#111111", trim: "#c29b38", pants: "#111111", helmet: "#111111" },
  "bridgeport-islanders": { primary: "#00539b", secondary: "#f47d30", trim: "#ffffff", pants: "#00539b", helmet: "#00539b" },
  "calgary-wranglers": { primary: "#c8102e", secondary: "#f1be48", trim: "#ffffff", pants: "#c8102e", helmet: "#c8102e" },
  "charlotte-checkers": { primary: "#c8102e", secondary: "#111111", trim: "#ffffff", pants: "#111111", helmet: "#111111" },
  "chicago-wolves": { primary: "#660000", secondary: "#d4af37", trim: "#111111", pants: "#111111", helmet: "#111111" },
  "cleveland-monsters": { primary: "#5c061c", secondary: "#002654", trim: "#d4af37", pants: "#002654", helmet: "#5c061c" },
  "coachella-valley-firebirds": { primary: "#001628", secondary: "#ff4c00", trim: "#99d9d9", pants: "#001628", helmet: "#001628" },
  "colorado-eagles": { primary: "#236192", secondary: "#6f263d", trim: "#d4af37", pants: "#236192", helmet: "#236192" },
  "hartford-wolf-pack": { primary: "#0038a8", secondary: "#ce1126", trim: "#ffffff", pants: "#0038a8", helmet: "#0038a8" },
  "henderson-silver-knights": { primary: "#a2aaad", secondary: "#b4975a", trim: "#111111", pants: "#111111", helmet: "#a2aaad" },
  "hershey-bears": { primary: "#3d2314", secondary: "#ddcba4", trim: "#ffffff", pants: "#3d2314", helmet: "#3d2314" },
  "iowa-wild": { primary: "#154734", secondary: "#a6192e", trim: "#ddcba4", pants: "#154734", helmet: "#154734" },
  "laval-rocket": { primary: "#192168", secondary: "#af1e2d", trim: "#ffffff", pants: "#192168", helmet: "#192168" },
  "lehigh-valley-phantoms": { primary: "#f74902", secondary: "#111111", trim: "#ffffff", pants: "#111111", helmet: "#111111" },
  "manitoba-moose": { primary: "#041e42", secondary: "#00843d", trim: "#a2aaad", pants: "#041e42", helmet: "#041e42" },
  "milwaukee-admirals": { primary: "#041e42", secondary: "#6cace4", trim: "#ffb81c", pants: "#041e42", helmet: "#041e42" },
  "providence-bruins": { primary: "#111111", secondary: "#ffb81c", trim: "#ffffff", pants: "#111111", helmet: "#111111" },
  "rochester-americans": { primary: "#003087", secondary: "#ce1126", trim: "#ffffff", pants: "#003087", helmet: "#003087" },
  "rockford-icehogs": { primary: "#cf0a2c", secondary: "#111111", trim: "#ffffff", pants: "#111111", helmet: "#111111" },
  "san-diego-gulls": { primary: "#f47a38", secondary: "#003087", trim: "#111111", pants: "#111111", helmet: "#111111" },
  "san-jose-barracuda": { primary: "#006d75", secondary: "#ea7200", trim: "#ffffff", pants: "#111111", helmet: "#006d75" },
  "springfield-thunderbirds": { primary: "#002868", secondary: "#6cace4", trim: "#ce1126", pants: "#002868", helmet: "#002868" },
  "syracuse-crunch": { primary: "#002868", secondary: "#a2aaad", trim: "#ffffff", pants: "#002868", helmet: "#002868" },
  "texas-stars": { primary: "#006847", secondary: "#d4af37", trim: "#111111", pants: "#111111", helmet: "#006847" },
  "toronto-marlies": { primary: "#00205b", secondary: "#ffffff", trim: "#ffffff", pants: "#00205b", helmet: "#00205b" },
  "tucson-roadrunners": { primary: "#8b1e1e", secondary: "#d4af37", trim: "#006d75", pants: "#111111", helmet: "#8b1e1e" },
  "utica-comets": { primary: "#ce1126", secondary: "#002868", trim: "#ffffff", pants: "#002868", helmet: "#ce1126" },
  "wilkes-barre-scranton-penguins": { primary: "#111111", secondary: "#fcb514", trim: "#ffffff", pants: "#111111", helmet: "#111111" },
};

const FALLBACK: Palette[] = [
  { primary: "#7a1f2b", secondary: "#f2c14e", trim: "#ffffff", pants: "#111111", helmet: "#7a1f2b" },
  { primary: "#1d3f72", secondary: "#e4e4e4", trim: "#ffb81c", pants: "#1d3f72", helmet: "#1d3f72" },
  { primary: "#0f5132", secondary: "#f8c537", trim: "#ffffff", pants: "#0f5132", helmet: "#0f5132" },
  { primary: "#3b2a6b", secondary: "#c0c0c0", trim: "#ffffff", pants: "#111111", helmet: "#3b2a6b" },
  { primary: "#8a2c0d", secondary: "#111111", trim: "#ffffff", pants: "#111111", helmet: "#8a2c0d" },
  { primary: "#14465c", secondary: "#f28c28", trim: "#ffffff", pants: "#14465c", helmet: "#14465c" },
  { primary: "#4a4a4a", secondary: "#d72631", trim: "#ffffff", pants: "#111111", helmet: "#4a4a4a" },
  { primary: "#5c1a5c", secondary: "#4fc3f7", trim: "#ffffff", pants: "#111111", helmet: "#5c1a5c" },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

function findPalette(code?: string | null, slugOrName?: string | null): Palette {
  const c = (code ?? "").toUpperCase().trim();
  if (c && NHL[c]) return NHL[c];

  const s = norm(slugOrName ?? "");
  if (s) {
    if (AHL[s]) return AHL[s];
    for (const [k, p] of Object.entries(AHL)) {
      if (s.includes(k) || k.includes(s)) return p;
    }
    // Also try matching NHL by slug (e.g. edmonton-oilers)
    for (const [codeKey, p] of Object.entries(NHL)) {
      const teamSlug = norm(codeKey);
      if (s.includes(teamSlug) || s.includes(norm(codeKey))) return p;
    }
  }

  return FALLBACK[hash(c || s) % FALLBACK.length];
}

/** Light vs dark text for a background (relative luminance). */
export function inkOn(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? "#111111" : "#ffffff";
}

export function teamKit(
  teamOrCode: { code?: string | null; slug?: string | null; name: string } | string | null | undefined,
  nameOrHome: string | boolean = "",
  homeFlag = true
): Kit {
  let code: string | null | undefined;
  let slugOrName: string | null | undefined;
  let isHome = true;

  if (typeof teamOrCode === "object" && teamOrCode !== null) {
    code = teamOrCode.code;
    slugOrName = teamOrCode.slug || teamOrCode.name;
    isHome = typeof nameOrHome === "boolean" ? nameOrHome : homeFlag;
  } else {
    code = teamOrCode;
    slugOrName = typeof nameOrHome === "string" ? nameOrHome : "";
    isHome = typeof nameOrHome === "boolean" ? nameOrHome : homeFlag;
  }

  const p = findPalette(code, slugOrName);
  const trimColor = p.trim ?? (inkOn(p.primary) === "#111111" ? "#111111" : "#ffffff");
  const pants = p.pants ?? (inkOn(p.primary) === "#111111" ? "#111111" : "#1a1a1a");
  const helmet = p.helmet ?? p.primary;

  if (isHome) {
    return {
      jersey: p.primary,
      trim: p.secondary,
      stripe: trimColor,
      number: inkOn(p.primary),
      numberBorder: p.secondary,
      pants,
      helmet,
      socks: p.primary,
      socksTrim: p.secondary,
      shoulderYoke: p.yoke ?? p.secondary,
      isDark: true,
    };
  }

  // Away: White jersey trimmed in team colors
  return {
    jersey: "#ffffff",
    trim: p.primary,
    stripe: p.secondary,
    number: p.primary,
    numberBorder: p.secondary,
    pants,
    helmet: "#ffffff",
    socks: "#ffffff",
    socksTrim: p.primary,
    shoulderYoke: p.primary,
    isDark: false,
  };
}
