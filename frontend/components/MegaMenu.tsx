"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

interface Team {
  id: number;
  name: string;
  slug: string;
  code: string | null;
  logoUrl: string | null;
  conference: string | null;
  division: string | null;
}

type MenuItem = { label: string; href: string; mega?: boolean; children?: { label: string; href: string }[] };

const menuItems: MenuItem[] = [
  { label: "Home", href: "/" },
  { label: "Scores", href: "/scores" },
  { label: "Standings", href: "/standings" },
  { label: "Schedule", href: "/schedule" },
  {
    label: "Trades",
    href: "/trades",
    children: [
      { label: "Trade Room", href: "/trades/build" },
      { label: "Trade Block", href: "/trade-block" },
      { label: "Waiver Wire", href: "/waivers" },
      { label: "Trade tracker", href: "/trades" },
      { label: "Transactions", href: "/transactions" },
    ],
  },
  { label: "Teams", href: "#", mega: true },
  {
    label: "Finance",
    href: "/finance",
    children: [
      { label: "Finance (bank & income)", href: "/finance" },
      { label: "Salary Cap (Cap Central)", href: "/salary-cap" },
    ],
  },
  {
    label: "Stats",
    href: "/stats",
    children: [
      { label: "Individual Leaders", href: "/stats/leaders" },
      { label: "Advanced Stats", href: "/stats/advanced" },
      { label: "EDGE Tracking", href: "/stats/edge" },
      { label: "Player Stats", href: "/stats/players" },
      { label: "Goalie Stats", href: "/stats/goalies" },
      { label: "Team Stats", href: "/stats/teams" },
      { label: "Franchise Leaders", href: "/stats/franchise" },
      { label: "Player Career Stats", href: "/stats/career" },
    ],
  },
  {
    label: "Free Agent Frenzy",
    href: "/free-agents",
    children: [
      { label: "Skaters", href: "/free-agents" },
      { label: "Goalies", href: "/free-agents?type=goalies" },
      { label: "Offer Sheets", href: "/offer-sheets" },
      { label: "Signings", href: "/signings" },
    ],
  },
  {
    label: "Players",
    href: "/players/injuries",
    children: [
      { label: "Injury Report", href: "/players/injuries" },
      { label: "Hot & Cold Players", href: "/players/hot-cold" },
      { label: "Three Stars", href: "/players/three-stars" },
      { label: "Contracts", href: "/players/contracts" },
      { label: "All Players", href: "/players/all" },
    ],
  },
  {
    label: "League",
    href: "/league",
    children: [
      { label: "Tonight's Best", href: "/league/digest" },
      { label: "League Records", href: "/league/records" },
      { label: "Audit Log", href: "/league/audit" },
      { label: "Team / GM", href: "/league" },
      { label: "Captains", href: "/captains" },
      { label: "Coaches", href: "/coaches" },
      { label: "Signings", href: "/signings" },
      { label: "Rules", href: "/rules" },
    ],
  },
  {
    label: "Entry Draft",
    href: "/draft",
    children: [
      { label: "Draft Lottery", href: "/draft/lottery" },
      { label: "Draft Room", href: "/draft/room" },
      { label: "Upcoming Draft", href: "/draft" },
      { label: "Draft History", href: "/draft/history" },
    ],
  },
  {
    label: "History",
    href: "/history",
    children: [
      { label: "League History", href: "/history" },
      { label: "Hall of Fame", href: "/hall-of-fame" },
      { label: "Awards", href: "/awards" },
      { label: "Award Voting", href: "/awards/vote" },
    ],
  },
  {
    label: "Tools",
    href: "/tools/all-rosters",
    children: [
      { label: "All Rosters", href: "/tools/all-rosters" },
      { label: "Player Compare", href: "/tools/compare" },
      { label: "Cap Calculator", href: "/tools/cap-calculator" },
      { label: "Player Calculator", href: "/tools/player-calculator" },
      { label: "Player Data Refresh", href: "/tools/player-data" },
    ],
  },
  {
    label: "AHL",
    href: "/ahl",
    children: [
      { label: "AHL Teams", href: "/ahl" },
      { label: "AHL Standings", href: "/standings?league=AHL" },
      { label: "AHL Schedule", href: "/schedule?league=AHL" },
      { label: "AHL Scores", href: "/scores?league=AHL" },
      { label: "Individual Leaders", href: "/stats/leaders?league=AHL" },
      { label: "EDGE Tracking", href: "/stats/edge?league=AHL" },
      { label: "Player Stats", href: "/stats/players?league=AHL" },
      { label: "Goalie Stats", href: "/stats/goalies?league=AHL" },
      { label: "Team Stats", href: "/stats/teams?league=AHL" },
      { label: "Injuries", href: "/players/injuries?league=AHL" },
    ],
  },
];

export default function MegaMenu({ gm }: { gm?: { nickname: string; slug: string; admin?: boolean } | null }) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then(setTeams);

    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const nhlTeams = teams.filter((t) => t.id <= 33);
  const eastern = nhlTeams.filter((t) =>
    t.conference?.includes("Eastern")
  );
  const western = nhlTeams.filter((t) =>
    t.conference?.includes("Western")
  );

  return (
    <nav
      className={`sticky top-0 z-50 border-b border-slate-700/30 transition-all duration-300 ${
        scrolled
          ? "bg-[#0a1628]/95 backdrop-blur-xl shadow-lg shadow-black/30"
          : "bg-[#0a1628]/80 backdrop-blur-md"
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-4">
        <div className="flex items-center h-14">
          {/* Menu */}
          <div className="flex items-center gap-0.5 flex-wrap">
            {menuItems.map((item) => (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => setActiveMenu(item.label)}
                onMouseLeave={() => setActiveMenu(null)}
              >
                {item.mega ? (
                  <button
                    className={`px-2.5 py-1.5 text-[13px] font-semibold rounded-md transition-all ${
                      activeMenu === item.label
                        ? "text-white bg-slate-700/60"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                    }`}
                  >
                    {item.label}
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    className={`px-2.5 py-1.5 text-[13px] font-semibold rounded-md transition-all whitespace-nowrap ${
                      activeMenu === item.label
                        ? "text-white bg-slate-700/60"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                    }`}
                  >
                    {item.label}
                  </Link>
                )}

                {item.children && activeMenu === item.label && (
                  <div className="absolute top-full left-0 mt-0.5 w-52 bg-[#0f1d32] border border-slate-700/40 rounded-lg shadow-2xl shadow-black/50 overflow-hidden py-1.5 z-50">
                    {item.children.map((child) => (
                      <Link
                        key={child.label}
                        href={child.href}
                        className="block px-4 py-2 text-[13px] text-slate-300 hover:text-white hover:bg-slate-700/40 transition-colors"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}

                {item.mega && activeMenu === item.label && (
                  <div className="absolute top-full left-0 mt-0.5 w-[600px] max-w-[calc(100vw-2rem)] bg-[#0f1d32] border border-slate-700/40 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50">
                  <div className="p-5">
                    <div className="grid grid-cols-2 gap-8">
                      {/* Eastern */}
                      <div>
                        <h3 className="text-blue-400 font-bold text-[11px] uppercase tracking-widest mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full" />
                          Eastern Conference
                        </h3>
                        <div className="grid grid-cols-2 gap-1">
                          {eastern.map((team) => (
                            <Link
                              key={team.id}
                              href={`/teams/${team.slug}`}
                              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-700/40 transition-colors"
                            >
                              {team.logoUrl && (
                                <Image
                                  src={team.logoUrl}
                                  alt={team.code ?? ""}
                                  width={18}
                                  height={18}
                                  className="object-contain shrink-0"
                                />
                              )}
                              <span className="text-[12px] text-slate-300 hover:text-white truncate">
                                {team.name}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>

                      {/* Western */}
                      <div>
                        <h3 className="text-red-400 font-bold text-[11px] uppercase tracking-widest mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 bg-red-500 rounded-full" />
                          Western Conference
                        </h3>
                        <div className="grid grid-cols-2 gap-1">
                          {western.map((team) => (
                            <Link
                              key={team.id}
                              href={`/teams/${team.slug}`}
                              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-700/40 transition-colors"
                            >
                              {team.logoUrl && (
                                <Image
                                  src={team.logoUrl}
                                  alt={team.code ?? ""}
                                  width={18}
                                  height={18}
                                  className="object-contain shrink-0"
                                />
                              )}
                              <span className="text-[12px] text-slate-300 hover:text-white truncate">
                                {team.name}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                )}
              </div>
            ))}

            {/* GM login / signed-in profile (with logout) */}
            <div className="relative ml-1" onMouseEnter={() => setActiveMenu("__gm")} onMouseLeave={() => setActiveMenu(null)}>
              {gm ? (
                <>
                  <button className="px-2.5 py-1.5 text-[13px] font-semibold rounded-md text-blue-300 hover:bg-slate-800/40 flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-full bg-blue-600 grid place-items-center text-[11px] font-black text-white">{gm.nickname[0]?.toUpperCase()}</span>
                    {gm.nickname}
                    <span className="text-[9px] text-slate-500">▾</span>
                  </button>
                  {activeMenu === "__gm" && (
                    <div className="absolute right-0 top-full mt-1 w-52 bg-[#0e1e35] border border-slate-700 rounded-lg shadow-xl shadow-black/40 py-1 z-50">
                      <div className="px-3 py-1 text-[10px] text-slate-500 uppercase tracking-wide">Signed in</div>
                      <a href={`/teams/${gm.slug}`} className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">My team</a>
                      <a href={`/teams/${gm.slug}/profile`} className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">Profile</a>
                      <a href={`/teams/${gm.slug}/lines`} className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">Lines &amp; tactics</a>
                      {gm.admin && (
                        <>
                          <div className="my-1 border-t border-slate-700/60" />
                          <div className="px-3 py-1 text-[10px] text-amber-500/80 uppercase tracking-wide">Admin</div>
                          <a href="/admin" className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">Admin Panel</a>
                          <a href="/calendar" className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">League Calendar</a>
                          <a href="/admin/elc" className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">ELC Rookies</a>
                          <a href="/admin/roster-update" className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">Roster Update</a>
                          <a href="/admin/season" className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">Season Control</a>
                          <a href="/admin/simulation" className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">Simulation Engine</a>
                          <a href="/admin/team-lines" className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">Team Lines &amp; Tactics</a>
                        </>
                      )}
                      <div className="my-1 border-t border-slate-700/60" />
                      <a href="/login" className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">Switch team</a>
                      <a href={`/teams/${gm.slug}/logout`} className="block px-3 py-1.5 text-sm text-red-400 hover:bg-slate-800">Log out</a>
                    </div>
                  )}
                </>
              ) : (
                <Link href="/login" className="px-2.5 py-1.5 text-[13px] font-semibold rounded-md text-slate-400 hover:text-white hover:bg-slate-800/40 inline-block">GM Login</Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}