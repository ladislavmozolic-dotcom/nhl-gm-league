"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useT } from "@/components/LangProvider";

// English label → i18n key (labels stay English as stable React keys; only display translates)
const LABEL_KEY: Record<string, string> = {
  "Home": "team.home", "Roster": "team.roster", "Lines": "team.lines", "System": "team.system",
  "Schedule": "team.schedule", "Scores": "team.scores", "Statistics": "team.statistics", "NHL Team": "team.nhlTeam",
  "Roster Moves": "team.rosterMoves", "Contracts": "team.contracts", "Free Agents": "team.freeAgents",
  "Team Contracts": "team.teamContracts", "Salary Cap": "team.salaryCap", "Finance": "team.finance",
  "Overview (bank)": "team.overviewBank", "Dashboard & controls": "team.dashboardControls", "Trades": "team.trades",
  "Trade Block": "team.tradeBlock", "Prospects": "team.prospects", "Draft Picks": "team.draftPicks",
  "Rivals": "team.rivals", "Farm": "team.farm", "History": "team.history", "Team DNA": "team.dna",
  "Depth Chart": "team.depthChart", "Injuries": "team.injuries",
};

type Item = { label: string; href: string; gm?: boolean };
type Group = { label: string; items: Item[] };
type Entry = Item | Group;
const isGroup = (e: Entry): e is Group => "items" in e;

/**
 * Team-scoped secondary navigation. Grouped into dropdowns (Roster / Schedule /
 * Contracts / Trades / Prospects) so the bar stays compact; a few stand-alone
 * links (Home, Rivals, Farm, History) remain flat. Every link stays in the team
 * context. GM-only entries show a small "GM" tag and only render for the GM.
 */
export default function TeamSubNav({ slug, isGm, isAffiliate, farmSlug, parentSlug }: { slug: string; isGm: boolean; isAffiliate?: boolean; farmSlug?: string | null; parentSlug?: string | null }) {
  const pathname = usePathname() || "";
  const tr = useT();
  const L = (label: string) => (LABEL_KEY[label] ? tr(LABEL_KEY[label]) : label);
  const base = `/teams/${slug}`;
  // tap-to-toggle dropdowns (mobile has no hover); desktop still opens on hover.
  const [open, setOpen] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => setOpen(null), [pathname]); // close after navigating
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null); };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const entries: Entry[] = isAffiliate
    ? [
        { label: "Home", href: base },
        { label: "Roster", items: [
          { label: "Roster", href: `${base}/roster` },
          { label: "Depth Chart", href: `${base}/depth-chart` },
          { label: "Injuries", href: `${base}/injuries` },
          { label: "Lines", href: `${base}/lines`, gm: true },
          { label: "System", href: `${base}/tactics`, gm: true },
        ] },
        { label: "Schedule", href: `${base}/schedule` },
        { label: "Scores", href: `${base}/scores` },
        { label: "Statistics", href: `${base}/stats` },
        ...(parentSlug ? [{ label: "NHL Team", href: `/teams/${parentSlug}` }] : []),
      ]
    : [
        { label: "Home", href: base },
        { label: "Roster", items: [
          { label: "Roster", href: `${base}/roster` },
          { label: "Depth Chart", href: `${base}/depth-chart` },
          { label: "Injuries", href: `${base}/injuries` },
          { label: "Roster Moves", href: `${base}/rosters`, gm: true },
          { label: "Lines", href: `${base}/lines`, gm: true },
          { label: "System", href: `${base}/tactics`, gm: true },
        ] },
        { label: "Schedule", href: `${base}/schedule` },
        { label: "Scores", href: `${base}/scores` },
        { label: "Statistics", href: `${base}/stats` },
        { label: "Contracts", items: [
          { label: "Free Agents", href: `${base}/free-agents`, gm: true },
          { label: "Team Contracts", href: `${base}/contracts`, gm: true },
          { label: "Salary Cap", href: `${base}/salary` },
        ] },
        { label: "Finance", items: [
          { label: "Overview (bank)", href: `${base}/finance` },
          { label: "Dashboard & controls", href: "/finance/dashboard", gm: true },
        ] },
        { label: "Trades", items: [
          { label: "Trades", href: `${base}/trades` },
          { label: "Trade Block", href: `${base}/trade-block`, gm: true },
        ] },
        { label: "Prospects", items: [
          { label: "Prospects", href: `${base}/prospects` },
          { label: "Draft Picks", href: `${base}/draft-picks` },
        ] },
        { label: "Rivals", href: `${base}/rivals`, gm: true },
        { label: "Farm", href: farmSlug ? `/teams/${farmSlug}` : `${base}/farm` },
        { label: "History", href: `${base}/history` },
        { label: "Team DNA", href: `${base}/dna` },
      ];

  const isActive = (href: string) => {
    if (href.includes("#")) return false;
    if (href === base) return pathname === base;
    return pathname === href || pathname.startsWith(href + "/");
  };
  const visible = (it: Item) => !it.gm || isGm;

  const linkCls = (active: boolean) =>
    `shrink-0 px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${active ? "border-blue-500 text-white" : "border-transparent text-slate-400 hover:text-white hover:border-slate-600"}`;

  return (
    <nav ref={navRef} className="border-y border-slate-800 bg-slate-900/60 backdrop-blur -mx-4 px-4">
      <div className="flex flex-wrap items-center gap-1">
        {entries.map((e) => {
          if (!isGroup(e)) {
            if (!visible(e)) return null;
            const active = isActive(e.href);
            return (
              <Link key={e.label} href={e.href} className={linkCls(active)}>
                {L(e.label)}{e.gm && <span className="ml-1 text-[9px] text-slate-500 align-top">GM</span>}
              </Link>
            );
          }
          const items = e.items.filter(visible);
          if (items.length === 0) return null;
          const groupActive = items.some((it) => isActive(it.href));
          const isOpen = open === e.label;
          return (
            <div key={e.label} className="relative group">
              <button type="button" onClick={() => setOpen(isOpen ? null : e.label)} aria-expanded={isOpen}
                className={`${linkCls(groupActive)} inline-flex items-center gap-1`}>
                {L(e.label)}<span className={`text-[8px] text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
              </button>
              <div className={`absolute left-0 top-full z-40 ${isOpen ? "block" : "hidden md:group-hover:block md:group-focus-within:block"} min-w-[180px] rounded-lg border border-slate-700 bg-slate-900 shadow-xl py-1`}>
                {items.map((it) => {
                  const active = isActive(it.href);
                  return (
                    <Link key={it.label} href={it.href} onClick={() => setOpen(null)}
                      className={`block px-4 py-2.5 text-sm whitespace-nowrap ${active ? "text-blue-400 bg-slate-800/60" : "text-slate-300 hover:bg-slate-800/60 hover:text-white"}`}>
                      {L(it.label)}{it.gm && <span className="ml-1 text-[9px] text-slate-500 align-top">GM</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
