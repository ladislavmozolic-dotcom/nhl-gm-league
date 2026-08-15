"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Team-scoped secondary navigation (like the per-team menu on profinhl.cz).
 * Shown on every /teams/[slug]/* page via the team layout. Every link stays
 * inside the team context — schedule shows only this team's games, stats only
 * this team's players, etc.
 */
export default function TeamSubNav({ slug, isGm, isAffiliate, farmSlug, parentSlug }: { slug: string; isGm: boolean; isAffiliate?: boolean; farmSlug?: string | null; parentSlug?: string | null }) {
  const pathname = usePathname() || "";
  const base = `/teams/${slug}`;

  // AHL affiliate teams get a slimmer, league-appropriate menu (+ a link back to the NHL club).
  const items: { label: string; href: string; match?: string; gm?: boolean }[] = isAffiliate
    ? [
        { label: "Home", href: base },
        { label: "Roster", href: `${base}/roster` },
        { label: "Schedule", href: `${base}/schedule` },
        { label: "Scores", href: `${base}/scores` },
        { label: "Standings", href: `${base}/standings` },
        { label: "Statistics", href: `${base}/stats` },
        ...(parentSlug ? [{ label: "NHL Team", href: `/teams/${parentSlug}` }] : []),
      ]
    : [
        { label: "Home", href: base },
        { label: "Roster", href: `${base}/roster` },
        { label: "Schedule", href: `${base}/schedule` },
        { label: "Scores", href: `${base}/scores` },
        { label: "Standings", href: `${base}/standings` },
        { label: "Statistics", href: `${base}/stats` },
        { label: "Lines", href: `${base}/lines`, gm: true },
        { label: "Rivals", href: `${base}/rivals`, gm: true },
        { label: "Prospects", href: `${base}/prospects` },
        { label: "Draft Picks", href: `${base}/draft-picks` },
        { label: "Salary", href: `${base}/salary` },
        { label: "Injuries", href: `${base}/injuries` },
        { label: "Trades", href: `${base}/trades` },
        // "Farm" jumps straight to the AHL affiliate's own hub (its slim menu), not a nested view
        { label: "Farm", href: farmSlug ? `/teams/${farmSlug}` : `${base}/farm` },
        { label: "History", href: `${base}/history` },
      ];

  const isActive = (href: string) => {
    // anchor links (#prospects, #farm…) live on the Home page — never highlight them as a route
    if (href.includes("#")) return false;
    if (href === base) return pathname === base;
    // /finance/[slug] (Salary) or nested team routes
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <nav className="border-y border-slate-800 bg-slate-900/60 backdrop-blur -mx-4 px-4">
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        {items.map((it) => {
          const active = isActive(it.href);
          return (
            <Link
              key={it.label}
              href={it.href}
              className={`shrink-0 px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? "border-blue-500 text-white"
                  : "border-transparent text-slate-400 hover:text-white hover:border-slate-600"
              }`}
            >
              {it.label}
              {it.gm && <span className="ml-1 text-[9px] text-slate-500 align-top">GM</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
