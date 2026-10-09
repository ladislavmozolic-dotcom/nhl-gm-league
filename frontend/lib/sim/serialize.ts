// JSON round-trip for engine inputs that contain Maps/Sets (a SimTeam does), so a live game's
// starting teams and in-game changes can be stored and the game rebuilt after a restart.

const MAP = "$map", SET = "$set";

export function encodeSim(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v instanceof Map) return { [MAP]: [...v.entries()] };
    if (v instanceof Set) return { [SET]: [...v.values()] };
    return v;
  });
}

export function decodeSim<T = unknown>(json: string): T {
  return JSON.parse(json, (_k, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (MAP in v) return new Map(v[MAP]);
      if (SET in v) return new Set(v[SET]);
    }
    return v;
  }) as T;
}

/** Same, but as a plain JSON value (for a Prisma Json column) instead of a string. */
export const toJsonValue = (value: unknown): unknown => JSON.parse(encodeSim(value));
export const fromJsonValue = <T = unknown>(value: unknown): T => decodeSim<T>(JSON.stringify(value));
