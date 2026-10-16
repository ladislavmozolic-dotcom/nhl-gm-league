// Broadcast wording for HOW a shot was taken and how the goalie stopped it. Pure and client-safe, shared by the
// saved play-by-play and the live feed so both read alike. Variety comes from a hash of the event, never an RNG.

const NOUN: Record<string, string> = { SLAP: "slap shot", WRIST: "wrist shot", SNAP: "snap shot", BACKHAND: "backhand", TIP: "tip-in", ONE_TIMER: "one-timer" };
const PLACE: Record<string, string> = { POINT: "from the point", PERIMETER: "from a sharp angle", CIRCLE: "from the circle", SLOT: "from the slot", NET_FRONT: "from right in front" };

/** "one-timer from the circle" / "tip-in in front of the net" — null when we know nothing. */
export function shotHow(shotType?: string | null, sector?: string | null): string | null {
  const noun = shotType ? NOUN[shotType] : undefined;
  if (!noun) return null;
  if (shotType === "TIP") return `${noun} in front of the net`;
  const place = sector ? PLACE[sector] : undefined;
  return place ? `${noun} ${place}` : noun;
}

const SAVE_HIGH = ["with the glove", "with the blocker", "with the glove", "with his shoulder"];
const SAVE_LOW = ["with the pad", "with the skate", "with the pad", "with the stick"];
const SAVE_MID = ["with the glove", "with the pad", "with the blocker", "with the chest"];

/** How the goalie got it: glove/blocker on high-danger looks, pad/skate on low ones. Deterministic per event. */
export function saveWhere(danger?: number | string | null, key = 0): string {
  const d = typeof danger === "number" ? danger : danger === "hd" ? 3 : danger === "md" ? 2 : danger === "ld" ? 1 : 2;
  const list = d >= 3 ? SAVE_HIGH : d <= 1 ? SAVE_LOW : SAVE_MID;
  return list[Math.abs(Math.floor(key)) % list.length];
}

/** " with a one-timer from the circle" for a goal line (empty when unknown). */
export const goalHow = (shotType?: string | null, sector?: string | null): string => {
  const h = shotHow(shotType, sector);
  return h ? ` with a ${h}` : "";
};

/** How the goal went in beyond the shot itself: a rebound, a wraparound, a point shot that changed direction. */
export function goalPlay(play?: string | null): string {
  return play === "rebound" ? " — he was first to the rebound" : play === "wrap" ? " — a wraparound from behind the net" : play === "deflect" ? " — it changed direction off a body in front" : "";
}
