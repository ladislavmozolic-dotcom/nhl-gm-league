"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { DEFAULT_MENU, type MenuItem } from "@/lib/menu-config";
import { t, type Lang } from "@/lib/i18n";
import LangSwitcher from "@/components/LangSwitcher";

interface Team {
  id: number;
  name: string;
  slug: string;
  code: string | null;
  logoUrl: string | null;
  conference: string | null;
  division: string | null;
}

export default function MegaMenu({ gm, items, lang = "en" }: { gm?: { nickname: string; slug: string; admin?: boolean; pendingJoins?: number; unreadDm?: number } | null; items?: MenuItem[]; lang?: Lang }) {
  const menuItems = items ?? DEFAULT_MENU;
  const tr = (k: string) => t(lang, k);
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

  const nhlTeams = teams.filter((tm) => tm.id <= 33);
  const eastern = nhlTeams.filter((tm) =>
    tm.conference?.includes("Eastern")
  );
  const western = nhlTeams.filter((tm) =>
    tm.conference?.includes("Western")
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
                key={item.key}
                className="relative"
                onMouseEnter={() => setActiveMenu(item.key)}
                onMouseLeave={() => setActiveMenu(null)}
              >
                {item.mega ? (
                  <button
                    className={`px-2.5 py-1.5 text-[13px] font-semibold rounded-md transition-all ${
                      activeMenu === item.key
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
                      activeMenu === item.key
                        ? "text-white bg-slate-700/60"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                    }`}
                  >
                    {item.label}
                  </Link>
                )}

                {item.children && activeMenu === item.key && (
                  <div className="absolute top-full left-0 mt-0.5 w-52 bg-[#0f1d32] border border-slate-700/40 rounded-lg shadow-2xl shadow-black/50 py-1.5 z-50">
                    {item.children.map((child) =>
                      child.children && child.children.length ? (
                        <div key={child.label} className="relative group/sub">
                          <Link
                            href={child.href}
                            className="flex items-center justify-between px-4 py-2 text-[13px] text-slate-300 hover:text-white hover:bg-slate-700/40 transition-colors"
                          >
                            {child.label}
                            <span className="text-[9px] text-slate-500 group-hover/sub:text-white">▸</span>
                          </Link>
                          <div className="absolute left-full top-0 -ml-0.5 pl-1 w-60 hidden group-hover/sub:block z-50">
                            <div className="bg-[#0f1d32] border border-slate-700/40 rounded-lg shadow-2xl shadow-black/50 py-1.5">
                              {child.children.map((sub) => (
                                <Link
                                  key={sub.label}
                                  href={sub.href}
                                  className="block px-4 py-2 text-[13px] text-slate-300 hover:text-white hover:bg-slate-700/40 transition-colors"
                                >
                                  {sub.label}
                                </Link>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <Link
                          key={child.label}
                          href={child.href}
                          className="block px-4 py-2 text-[13px] text-slate-300 hover:text-white hover:bg-slate-700/40 transition-colors"
                        >
                          {child.label}
                        </Link>
                      )
                    )}
                  </div>
                )}

                {item.mega && activeMenu === item.key && (
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

            {/* Forum — public discussion, visible to everyone */}
            <Link href="/forum" className="px-2.5 py-1.5 text-[13px] font-semibold rounded-md text-slate-400 hover:text-white hover:bg-slate-800/40 whitespace-nowrap">🗣️ Forum</Link>

            {/* Messages — top-nav so a signed-in GM sees new-message badge right away */}
            {gm && (
              <Link href="/messages" className="relative px-2.5 py-1.5 text-[13px] font-semibold rounded-md text-slate-400 hover:text-white hover:bg-slate-800/40 whitespace-nowrap flex items-center gap-1">
                💬 Messages
                {(gm.unreadDm ?? 0) > 0 && <span className="min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold grid place-items-center">{gm.unreadDm}</span>}
              </Link>
            )}

            {/* GM login / signed-in profile (with logout) */}
            <div className="relative ml-1" onMouseEnter={() => setActiveMenu("__gm")} onMouseLeave={() => setActiveMenu(null)}>
              {gm ? (
                <>
                  <button className="relative px-2.5 py-1.5 text-[13px] font-semibold rounded-md text-blue-300 hover:bg-slate-800/40 flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-full bg-blue-600 grid place-items-center text-[11px] font-black text-white">{gm.nickname[0]?.toUpperCase()}</span>
                    {gm.nickname}
                    <span className="text-[9px] text-slate-500">▾</span>
                    {gm.admin && (gm.pendingJoins ?? 0) > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold grid place-items-center" title={`${gm.pendingJoins} nových žiadostí o vstup`}>{gm.pendingJoins}</span>
                    )}
                  </button>
                  {activeMenu === "__gm" && (
                    <div className="absolute right-0 top-full pt-1 z-50">
                    <div className="w-52 bg-[#0e1e35] border border-slate-700 rounded-lg shadow-xl shadow-black/40 py-1">
                      <div className="px-3 py-1 text-[10px] text-slate-500 uppercase tracking-wide">{tr("ui.signedIn")}</div>
                      <a href={`/teams/${gm.slug}`} className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">{tr("ui.myTeam")}</a>
                      <a href={`/teams/${gm.slug}/profile`} className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">{tr("ui.profile")}</a>
                      <a href={`/teams/${gm.slug}/lines`} className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">{tr("ui.linesTactics")}</a>
                      {gm.admin && (
                        <>
                          <div className="my-1 border-t border-slate-700/60" />
                          <div className="px-3 py-1 text-[10px] text-amber-500/80 uppercase tracking-wide">{tr("ui.admin")}</div>
                          <a href="/admin" className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">{tr("ui.adminPanel")}</a>
                          <a href="/admin/join-requests" className="flex items-center justify-between px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">
                            <span>Žiadosti o vstup</span>
                            {(gm.pendingJoins ?? 0) > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold grid place-items-center">{gm.pendingJoins}</span>}
                          </a>
                          <a href="/calendar" className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">League Calendar</a>
                          <a href="/admin/elc" className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">ELC Rookies</a>
                          <a href="/admin/roster-update" className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">Roster Update</a>
                          <a href="/admin/season" className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">Season Control</a>
                          <a href="/admin/signings" className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">Latest Signings</a>
                          <a href="/admin/simulation" className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">Simulation Engine</a>
                          <a href="/admin/team-lines" className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">Team Lines &amp; Tactics</a>
                        </>
                      )}
                      <div className="my-1 border-t border-slate-700/60" />
                      <div className="px-3 py-1.5 flex items-center justify-between gap-2">
                        <span className="text-sm text-slate-300">{tr("ui.language")}</span>
                        <LangSwitcher lang={lang} />
                      </div>
                      <div className="my-1 border-t border-slate-700/60" />
                      <a href="/login" className="block px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">{tr("ui.switchTeam")}</a>
                      <a href={`/teams/${gm.slug}/logout`} className="block px-3 py-1.5 text-sm text-red-400 hover:bg-slate-800">{tr("ui.logout")}</a>
                    </div>
                    </div>
                  )}
                </>
              ) : (
                <span className="flex items-center gap-1.5">
                  <LangSwitcher lang={lang} />
                  <Link href="/login" className="px-2.5 py-1.5 text-[13px] font-semibold rounded-md text-slate-400 hover:text-white hover:bg-slate-800/40 inline-block">{tr("ui.gmLogin")}</Link>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}