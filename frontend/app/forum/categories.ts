export const CATEGORIES = ["discussion", "trades", "offtopic", "comish"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CAT_META: Record<Category, {
  label: string; desc: string; adminOnly: boolean; color: string;
  icon: string; ring: string; glow: string; chip: string;
}> = {
  discussion: {
    label: "Discussion", desc: "Discussion about our league.", adminOnly: false,
    color: "text-blue-400", icon: "💬",
    ring: "border-blue-500/30 hover:border-blue-400/60", glow: "from-blue-500/15", chip: "bg-blue-500/15 text-blue-300",
  },
  trades: {
    label: "Trades", desc: "GMs post who they are looking for and what they offer.", adminOnly: false,
    color: "text-emerald-400", icon: "🔁",
    ring: "border-emerald-500/30 hover:border-emerald-400/60", glow: "from-emerald-500/15", chip: "bg-emerald-500/15 text-emerald-300",
  },
  offtopic: {
    label: "Off-topic", desc: "Chat outside the main league — keep it civil.", adminOnly: false,
    color: "text-slate-300", icon: "🎲",
    ring: "border-slate-600/40 hover:border-slate-400/60", glow: "from-slate-400/10", chip: "bg-slate-600/25 text-slate-300",
  },
  comish: {
    label: "Comish Corner", desc: "Commissioner announcements.", adminOnly: true,
    color: "text-amber-400", icon: "📢",
    ring: "border-amber-500/30 hover:border-amber-400/60", glow: "from-amber-500/15", chip: "bg-amber-500/15 text-amber-300",
  },
};

export const catOk = (c: string): Category => (CATEGORIES as readonly string[]).includes(c) ? (c as Category) : "discussion";
