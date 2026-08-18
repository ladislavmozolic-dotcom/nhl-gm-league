export const CATEGORIES = ["discussion", "trades", "offtopic", "comish"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CAT_META: Record<Category, { label: string; desc: string; adminOnly: boolean; color: string }> = {
  discussion: { label: "Diskusia", desc: "Diskusia k našej lige.", adminOnly: false, color: "text-blue-400" },
  trades: { label: "Trejdy", desc: "GMs zadávajú koho hľadajú a čo ponúkajú.", adminOnly: false, color: "text-emerald-400" },
  offtopic: { label: "Ostatné", desc: "Kecy mimo hlavnú ligu — v rámci slušnosti.", adminOnly: false, color: "text-slate-400" },
  comish: { label: "Comish Corner", desc: "Oznámenia komisára.", adminOnly: true, color: "text-amber-400" },
};

export const catOk = (c: string): Category => (CATEGORIES as readonly string[]).includes(c) ? (c as Category) : "discussion";
