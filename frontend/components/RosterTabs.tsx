"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/LangProvider";

export default function RosterTabs({ slug, isGm = false }: { slug: string; isGm?: boolean }) {
  const pathname = usePathname() || "";
  const tr = useT();

  const tabs = [
    { label: tr("team.roster"), href: `/teams/${slug}/roster`, icon: "📋" },
    ...(isGm ? [{ label: tr("team.lines"), href: `/teams/${slug}/lines`, icon: "🏒" }] : []),
    { label: tr("team.depthChart"), href: `/teams/${slug}/depth-chart`, icon: "📊" },
    { label: tr("team.injuries"), href: `/teams/${slug}/injuries`, icon: "🩹" },
  ];

  return (
    <div className="flex items-center gap-1.5 p-1.5 bg-slate-900/60 border border-slate-800/80 rounded-2xl w-fit backdrop-blur-md shadow-md">
      {tabs.map((t) => {
        const active = pathname === t.href || (t.href.endsWith("/injuries") && pathname.startsWith(t.href));
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-3.5 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              active
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400/40"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <span className="text-xs">{t.icon}</span>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
