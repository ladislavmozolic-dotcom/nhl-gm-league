"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Admin Panel", exact: true },
  { href: "/admin/season", label: "Season Control" },
  { href: "/admin/simulation", label: "Simulation Engine" },
  { href: "/admin/team-lines", label: "Team Lines & Tactics" },
  { href: "/admin/contracts", label: "Contracts" },
  { href: "/admin/ratings", label: "Player Ratings" },
];

export default function AdminTabs() {
  const path = usePathname() ?? "";
  return (
    <div className="flex gap-1 flex-wrap border-b border-slate-800 mb-6 overflow-x-auto">
      {TABS.map((t) => {
        const active = t.exact ? path === t.href : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href}
            className={`px-3.5 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${active ? "border-blue-500 text-white" : "border-transparent text-slate-400 hover:text-white hover:border-slate-600"}`}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
