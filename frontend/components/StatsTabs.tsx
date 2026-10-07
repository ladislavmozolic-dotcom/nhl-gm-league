"use client";

import Link from "next/link";
import { useT } from "@/components/LangProvider";

const TABS = [
  { key: "leaders", dictKey: "stats.tab.leaders", defaultLabel: "Leaders", icon: "👑", href: "/stats/leaders" },
  { key: "players", dictKey: "stats.tab.players", defaultLabel: "Skaters", icon: "👤", href: "/stats/players" },
  { key: "goalies", dictKey: "stats.tab.goalies", defaultLabel: "Goalies", icon: "🧤", href: "/stats/goalies" },
  { key: "teams", dictKey: "stats.tab.teams", defaultLabel: "Teams", icon: "🛡️", href: "/stats/teams" },
  { key: "advanced", dictKey: "stats.tab.advanced", defaultLabel: "Advanced", icon: "⚡", href: "/stats/advanced" },
  { key: "edge", dictKey: "stats.tab.edge", defaultLabel: "EDGE", icon: "📡", href: "/stats/edge" },
  { key: "career", dictKey: "stats.tab.career", defaultLabel: "Career", icon: "📜", href: "/stats/career" },
  { key: "star-power", dictKey: "stats.tab.starPower", defaultLabel: "Star Power", icon: "⭐", href: "/stats/star-power" },
  { key: "franchise", dictKey: "stats.tab.franchise", defaultLabel: "Franchise", icon: "🏛️", href: "/stats/franchise" },
];

export default function StatsTabs({ active, league = "NHL" }: { active: string; league?: string }) {
  const tr = useT();
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
        const label = tr(t.dictKey) || t.defaultLabel;
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
            <span>{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
