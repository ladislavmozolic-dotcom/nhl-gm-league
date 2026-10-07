import Link from "next/link";

const TABS = [
  { key: "leaders", label: "Leaders", icon: "👑", href: "/stats/leaders" },
  { key: "players", label: "Skaters", icon: "👤", href: "/stats/players" },
  { key: "goalies", label: "Goalies", icon: "🧤", href: "/stats/goalies" },
  { key: "teams", label: "Teams", icon: "🛡️", href: "/stats/teams" },
  { key: "advanced", label: "Advanced", icon: "⚡", href: "/stats/advanced" },
  { key: "edge", label: "EDGE", icon: "📡", href: "/stats/edge" },
  { key: "career", label: "Career", icon: "📜", href: "/stats/career" },
  { key: "star-power", label: "Star Power", icon: "⭐", href: "/stats/star-power" },
  { key: "franchise", label: "Franchise", icon: "🏛️", href: "/stats/franchise" },
];

export default function StatsTabs({ active, league = "NHL" }: { active: string; league?: string }) {
  const q = league === "AHL" ? "?league=AHL" : "";
  return (
    <div className="bg-slate-900/80 border border-slate-800/90 p-1.5 rounded-2xl flex flex-wrap items-center gap-1.5 shadow-xl backdrop-blur-md">
      {league === "AHL" && (
        <span className="px-2.5 py-1 rounded-xl bg-emerald-600/25 border border-emerald-500/40 text-emerald-400 text-xs font-black tracking-wide mr-0.5">
          AHL
        </span>
      )}
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <Link
            key={t.key}
            href={`${t.href}${q}`}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-[13px] font-bold transition-all ${
              isActive
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-400/40"
                : "text-slate-400 hover:text-white hover:bg-slate-800/70"
            }`}
          >
            <span className="text-sm leading-none">{t.icon}</span>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
