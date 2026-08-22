"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/LangProvider";

/** Secondary tabs that live UNDER Roster — Depth Chart is nested here rather than
 *  cluttering the team's top menu. */
export default function RosterTabs({ slug, isGm = false }: { slug: string; isGm?: boolean }) {
  const pathname = usePathname() || "";
  const tr = useT();
  const tabs = [
    { label: tr("team.roster"), href: `/teams/${slug}/roster` },
    ...(isGm ? [{ label: tr("team.lines"), href: `/teams/${slug}/lines` }] : []),
    { label: tr("team.depthChart"), href: `/teams/${slug}/depth-chart` },
    { label: tr("team.injuries"), href: `/teams/${slug}/injuries` },
  ];
  return (
    <div className="flex items-center gap-2">
      {tabs.map((t) => {
        const active = pathname === t.href || (t.href.endsWith("/injuries") && pathname.startsWith(t.href));
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
