import Link from "next/link";

const TABS = [
  { key: "leaders", label: "Individual Leaders", href: "/stats/leaders" },
  { key: "advanced", label: "Advanced", href: "/stats/advanced" },
  { key: "edge", label: "EDGE Tracking", href: "/stats/edge" },
  { key: "players", label: "Player Stats", href: "/stats/players" },
  { key: "goalies", label: "Goalie Stats", href: "/stats/goalies" },
  { key: "teams", label: "Team Stats", href: "/stats/teams" },
  { key: "franchise", label: "Franchise Leaders", href: "/stats/franchise" },
  { key: "career", label: "Career Stats", href: "/stats/career" },
];

export default function StatsTabs({ active, league = "NHL" }: { active: string; league?: string }) {
  const q = league === "AHL" ? "?league=AHL" : "";
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-3">
      {league === "AHL" && <span className="px-2 py-1 rounded bg-emerald-600/20 text-emerald-400 text-xs font-bold mr-1">AHL</span>}
      {TABS.map((t) => (
        <Link key={t.key} href={`${t.href}${q}`}
          className={`px-3 py-1.5 rounded-md text-[13px] font-semibold transition-colors ${
            active === t.key ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}
