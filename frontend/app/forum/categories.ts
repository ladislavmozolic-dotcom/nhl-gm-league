export const CATEGORIES = ["general", "trades", "league", "offtopic"] as const;
export const catOk = (c: string) => (CATEGORIES as readonly string[]).includes(c) ? c : "general";
