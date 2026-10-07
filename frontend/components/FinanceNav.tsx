import Link from "next/link";
import type { Lang } from "@/lib/i18n";

const SECTIONS = [
  { key: "league", labelEn: "League Overview", labelSk: "Prehľad ligy", href: "/finance", icon: "🌐" },
  { key: "dashboard", labelEn: "Club Dashboard", labelSk: "Klubový pult", href: "/finance/dashboard", icon: "📊" },
  { key: "fan-interest", labelEn: "Fan Interest", labelSk: "Záujem fanúšikov", href: "/finance/fan-interest", icon: "🎟" },
  { key: "season-tickets", labelEn: "Season Tickets", labelSk: "Permanentky", href: "/finance/season-tickets", icon: "🎫" },
  { key: "attendance", labelEn: "Attendance", labelSk: "Návštevnosť", href: "/finance/attendance", icon: "🏟" },
  { key: "merchandise", labelEn: "Merchandise", labelSk: "Merchandise", href: "/finance/merchandise", icon: "👕" },
  { key: "sponsorship", labelEn: "Sponsorship", labelSk: "Sponzoring", href: "/finance/sponsorship", icon: "🤝" },
  { key: "playoffs", labelEn: "Playoffs", labelSk: "Playoff", href: "/finance/playoffs", icon: "🏆" },
] as const;

export default function FinanceNav({
  current,
  lang = "en",
}: {
  current: string;
  lang?: Lang;
}) {
  const isSk = lang === "cs";

  return (
    <nav aria-label="Finance sections" className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
      {SECTIONS.map((s) => {
        const isActive = current === s.key;
        return (
          <Link
            key={s.key}
            href={s.href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all duration-200 ${
              isActive
                ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300 shadow-md shadow-cyan-950/20"
                : "border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-white hover:bg-slate-850"
            }`}
          >
            <span className="text-sm">{s.icon}</span>
            <span>{isSk ? s.labelSk : s.labelEn}</span>
          </Link>
        );
      })}
      <Link
        href="/salary-cap"
        className="ml-auto inline-flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors whitespace-nowrap shrink-0"
      >
        <span>🧢</span>
        <span>{isSk ? "Cap Central →" : "Cap Central →"}</span>
      </Link>
    </nav>
  );
}
