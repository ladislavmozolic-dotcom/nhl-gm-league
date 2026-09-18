import Link from "next/link";
import { BackPill } from "@/components/ui";

const sections = [
  ["fan-interest", "Fan Interest", "/finance/fan-interest"],
  ["season-tickets", "Season Tickets", "/finance/season-tickets"],
  ["attendance", "Attendance", "/finance/attendance"],
  ["merchandise", "Merchandise", "/finance/merchandise"],
  ["sponsorship", "Sponsorship", "/finance/sponsorship"],
] as const;

export default function FinanceNav({ current }: { current: "dashboard" | "league" | (typeof sections)[number][0] }) {
  return (
    <nav aria-label="Finance sections" className="flex flex-wrap items-center gap-2">
      {current !== "dashboard" && <BackPill href="/finance/dashboard">Finance Dashboard</BackPill>}
      {current === "dashboard" && (
        <Link href="/finance/dashboard" aria-current="page" className="inline-flex items-center rounded-lg border border-blue-500/40 bg-blue-500/15 px-3 py-1.5 text-sm font-medium text-blue-200 whitespace-nowrap">
          Finance Dashboard
        </Link>
      )}
      {sections.map(([key, label, href]) => (
        <Link key={key} href={href} aria-current={current === key ? "page" : undefined}
          className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${current === key ? "border-blue-500/40 bg-blue-500/15 text-blue-200" : "border-slate-700/70 bg-slate-800/60 text-slate-300 hover:bg-slate-700 hover:text-white"}`}>
          {label} →
        </Link>
      ))}
    </nav>
  );
}
