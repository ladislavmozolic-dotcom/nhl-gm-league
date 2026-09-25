// Client-safe special-event constants (see lib/special-games.ts).
export type EventKind = "HERITAGE" | "WINTER" | "STADIUM" | "GLOBAL";
export const EVENT_KINDS: { key: EventKind; label: string; icon: string; outdoor: boolean }[] = [
  { key: "WINTER", label: "Winter Classic", icon: "❄️", outdoor: true },
  { key: "STADIUM", label: "Stadium Series", icon: "🏟️", outdoor: true },
  { key: "HERITAGE", label: "Heritage Classic", icon: "🍁", outdoor: true },
  { key: "GLOBAL", label: "Global Series", icon: "🌍", outdoor: false },
];
export const kindOf = (k: string | null | undefined) => EVENT_KINDS.find((e) => e.key === k) ?? null;
export const isOutdoor = (k: string | null | undefined) => !!kindOf(k)?.outdoor;
