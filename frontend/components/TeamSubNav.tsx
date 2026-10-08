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
  "Finance & Contracts": "team.financeContracts", "Arena & Tickets": "team.arenaTickets",
  "Overview (bank)": "team.overviewBank", "Dashboard & controls": "team.dashboardControls", "Trades": "team.trades",
  "Trade Tracker": "team.tradeTracker", "Transactions": "team.transactions",
  "Trade Block": "team.tradeBlock", "Prospects": "team.prospects", "Draft Picks": "team.draftPicks",
  "Rivals": "team.rivals", "Farm": "team.farm", "History": "team.history", "Retired Numbers": "team.retiredNumbers", "Team DNA": "team.dna",
  "Depth Chart": "team.depthChart", "Injuries": "team.injuries",
};

// Keep the team navigation as easy to scan as the main-menu dropdowns. These
// are deliberately visual helpers only; labels remain the accessible nav names.
const MENU_ICON: Record<string, string> = {
  "Home": "🏠", "Roster": "👥", "Depth Chart": "📋", "Injuries": "🩹", "Roster Moves": "🔁", "Lines": "🏒", "System": "⚙️",
  "Schedule": "📅", "Scores": "🏁", "Statistics": "📊", "NHL Team": "🏆",
  "Finance & Contracts": "💰", "Salary Cap": "🧮", "Team Contracts": "📝", "Free Agents": "✍️", "Arena & Tickets": "🏟️", "Dashboard & controls": "🎛️",
  "Trades": "🔄", "Trade Tracker": "📨", "Transactions": "📜", "Trade Block": "🧱",
  "Draft Picks": "🎯", "Prospects": "🌟", "Rivals": "⚔️", "Farm": "🚜", "History": "🏛️", "Retired Numbers": "🔢", "Team DNA": "🧬",
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
  const Icon = ({ label }: { label: string }) => MENU_ICON[label] ? <span aria-hidden className="w-5 text-center text-base leading-none">{MENU_ICON[label]}</span> : null;
  const base = `/teams/${slug}`;
  const [open, setOpen] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const handleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(null);
    // only drop focus that sits inside this nav — blurring whatever is focused anywhere
    // made every click into an input/select elsewhere on a team page lose focus at once
    const active = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
    if (active && navRef.current?.contains(active)) active.blur();
  };

  const handleMouseEnter = (label: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(label);
  };

  const handleMouseLeave = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setOpen(null);
    }, 150);
  };

  useEffect(() => {
    handleClose();
  }, [pathname]); // close after navigating

  // Next.js scrolls a navigation to the top of the segment that changed — here the page body, i.e. just
  // BELOW this team menu — so on a phone the team home opened already scrolled past the hero. The team
  // home always starts at the very top of the page.
  useEffect(() => {
    if (pathname !== base) return;
    const top = () => window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    top(); // after Next's own segment scroll (it runs during commit, before effects)
    const id = requestAnimationFrame(top); // and once more in case it lands a frame later
    return () => cancelAnimationFrame(id);
  }, [pathname, base]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const entries: Entry[] = isAffiliate
    ? [
        { label: "Home", href: base },
        { label: "Roster", items: [
          { label: "Roster", href: `${base}/roster` },
          { label: "Depth Chart", href: `${base}/depth-chart` },
          { label: "Injuries", href: `${base}/injuries` },
          // Roster moves for an AHL club actually live on its NHL parent's /rosters
          // page (RosterMover shows both org sides at once) — deep-link there rather
          // than duplicating that page/data-fetch for the affiliate's own slug. The
          // `?from=farm` flag lets that page send "Lines"/"Back" back to the farm
          // side instead of stranding the GM on the NHL team.
          ...(parentSlug ? [{ label: "Roster Moves", href: `/teams/${parentSlug}/rosters?from=farm`, gm: true }] : []),
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
        { label: "Finance & Contracts", items: [
          { label: "Salary Cap", href: `${base}/salary` },
          { label: "Team Contracts", href: `${base}/contracts`, gm: true },
          { label: "Free Agents", href: `${base}/free-agents`, gm: true },
          { label: "Arena & Tickets", href: `${base}/finance` },
          { label: "Dashboard & controls", href: "/finance/dashboard", gm: true },
        ] },
        { label: "Trades", items: [
          { label: "Trade Tracker", href: `${base}/trades` },
          { label: "Transactions", href: `${base}/transactions` },
          { label: "Trade Block", href: `${base}/trade-block`, gm: true },
        ] },
        { label: "Draft Picks", href: `${base}/draft-picks` },
        { label: "Prospects", href: `${base}/prospects` },
        { label: "Rivals", href: `${base}/rivals`, gm: true },
        { label: "Farm", href: farmSlug ? `/teams/${farmSlug}` : `${base}/farm` },
        { label: "History", href: `${base}/history` },
        { label: "Retired Numbers", href: `${base}/retired-numbers` },
        { label: "Team DNA", href: `${base}/dna` },
      ];

  const isActive = (href: string) => {
    if (href.includes("#")) return false;
    const path = href.split("?")[0];
    if (path === base) return pathname === base;
    return pathname === path || pathname.startsWith(path + "/");
  };
  const visible = (it: Item) => !it.gm || isGm;

  const linkCls = (active: boolean) =>
    `shrink-0 px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${active ? "border-blue-500 text-white" : "border-transparent text-slate-400 hover:text-white hover:border-slate-600"}`;

  return (
    <nav ref={navRef} className="relative z-30 border-y border-slate-800 bg-slate-900/60 backdrop-blur -mx-4 px-4">
      <div className="flex flex-wrap items-center gap-1">
        {entries.map((e) => {
          if (!isGroup(e)) {
            if (!visible(e)) return null;
            const active = isActive(e.href);
            return (
              <Link key={e.label} href={e.href} className={linkCls(active)}>
                <span>{L(e.label)}</span>{e.gm && <span className="ml-1 text-[9px] text-slate-500 align-top">GM</span>}
              </Link>
            );
          }
          const items = e.items.filter(visible);
          if (items.length === 0) return null;
          const groupActive = items.some((it) => isActive(it.href));
          const isOpen = open === e.label;
          return (
            <div
              key={e.label}
              className="relative"
              onMouseEnter={() => handleMouseEnter(e.label)}
              onMouseLeave={handleMouseLeave}
            >
              <button
                type="button"
                onClick={() => {
                  if (isOpen) {
                    handleClose();
                  } else {
                    handleMouseEnter(e.label);
                  }
                }}
                aria-expanded={isOpen}
                className={`${linkCls(groupActive)} inline-flex items-center gap-1`}
              >
                {L(e.label)}
                <span className={`text-[8px] text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                  ▼
                </span>
              </button>
              <div
                className={`absolute left-0 top-full z-40 ${
                  isOpen ? "block" : "hidden"
                } min-w-[180px] rounded-lg border border-slate-700 bg-slate-900 shadow-xl py-1`}
              >
                {items.map((it) => {
                  const active = isActive(it.href);
                  return (
                    <Link
                      key={it.label}
                      href={it.href}
                      onClick={handleClose}
                      className={`block px-4 py-2.5 text-sm whitespace-nowrap ${
                        active
                          ? "text-blue-400 bg-slate-800/60"
                          : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2"><Icon label={it.label} />{L(it.label)}</span>
                      {it.gm && (
                        <span className="ml-1 text-[9px] text-slate-500 align-top">GM</span>
                      )}
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
