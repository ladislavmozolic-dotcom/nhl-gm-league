"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Secondary tabs that live UNDER Roster — Depth Chart is nested here rather than
 *  cluttering the team's top menu. */
export default function RosterTabs({ slug }: { slug: string }) {
  const pathname = usePathname() || "";
  const tabs = [
    { label: "Roster", href: `/teams/${slug}/roster` },
    { label: "Depth Chart", href: `/teams/${slug}/depth-chart` },
  ];
  return (
    <div className="flex items-center gap-2">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link key={t.href} href={t.href}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              active ? "bg-blue-600 text-white" : "bg-slate-800/60 text-slate-400 hover:text-slate-200"
            }`}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
