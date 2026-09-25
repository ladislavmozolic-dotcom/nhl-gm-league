import Link from "next/link";
import { type Phase } from "@/lib/phase";

/** Phase switcher shared by Scores / Standings / Stats. Pre-season & Regular swap
 *  the season the page reads; Playoffs links to the bracket / playoff views.
 *  Pre-season is NHL-only. */
export default function PhaseTabs({ active, league, basePath, playoffsHref = "/playoffs", showPlayoffs = true, keep = "" }: {
  active: Phase; league: "NHL" | "AHL"; basePath: string; playoffsHref?: string; showPlayoffs?: boolean; keep?: string; // keep = extra query to carry over, e.g. "view=goalies"
}) {
  const lg = league === "AHL" ? "league=AHL" : "";
  const q = (extra: string) => { const parts = [extra, keep, lg].filter(Boolean); return parts.length ? `?${parts.join("&")}` : ""; };
  const tabs: { key: Phase; label: string; href: string }[] = [
    { key: "pre" as Phase, label: "Pre-season", href: `${basePath}${q("phase=pre")}` },
    // explicit phase=regular — otherwise the page follows the league clock, which is pre-season during pre-season
    { key: "regular", label: "Regular Season", href: `${basePath}${q("phase=regular")}` },
    ...(showPlayoffs ? [{ key: "playoffs" as Phase, label: "Playoffs", href: `${playoffsHref}${league === "AHL" ? "?league=AHL" : ""}` }] : []),
  ];
  return (
    <div className="flex gap-2 flex-wrap">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${active === t.key ? "bg-blue-600 text-white" : "border border-slate-700 text-slate-400 hover:bg-slate-800"}`}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}
