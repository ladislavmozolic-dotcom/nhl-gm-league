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

// Loose shape shared by MenuItem (top level) and MenuChild (nested) so the
// mobile accordion can recurse into either without caring which one it got.
type NavNode = { key?: string; label: string; href: string; mega?: boolean; children?: NavNode[] };

export default function MegaMenu({ gm, items, lang = "en" }: { gm?: { nickname: string; slug: string; admin?: boolean; pendingJoins?: number; unreadDm?: number; forumNew?: number } | null; items?: MenuItem[]; lang?: Lang }) {
  const menuItems = items ?? DEFAULT_MENU;
  const tr = (k: string) => t(lang, k);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [scrolled, setScrolled] = useState(false);
  // Mobile drawer — hover doesn't exist on touch, so nested items (e.g. League
  // → Finance → Salary Cap) need their own tap-to-expand accordion state
  // instead of reusing the desktop hover-flyout logic above.
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openPaths, setOpenPaths] = useState<Set<string>>(new Set());
  const closeMobile = () => { setMobileOpen(false); setOpenPaths(new Set()); };
  const togglePath = (path: string) => setOpenPaths((prev) => {
    const next = new Set(prev);
    if (next.has(path)) next.delete(path); else next.add(path);
    return next;
  });

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

  const TeamsMobileList = ({ pad }: { pad: number }) => (
    <div className="pb-1">
      <div className="text-[10px] uppercase tracking-widest text-blue-400 font-bold pt-1.5 pb-1" style={{ paddingLeft: pad }}>Eastern Conference</div>
      {eastern.map((tm) => (
        <Link key={tm.id} href={`/teams/${tm.slug}`} onClick={closeMobile} className="flex items-center gap-2 py-2 text-[13px] text-slate-300 hover:text-white" style={{ paddingLeft: pad }}>
          {tm.logoUrl && <img src={tm.logoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />}
          {tm.name}
        </Link>
      ))}
      <div className="text-[10px] uppercase tracking-widest text-red-400 font-bold pt-2 pb-1" style={{ paddingLeft: pad }}>Western Conference</div>
      {western.map((tm) => (
        <Link key={tm.id} href={`/teams/${tm.slug}`} onClick={closeMobile} className="flex items-center gap-2 py-2 text-[13px] text-slate-300 hover:text-white" style={{ paddingLeft: pad }}>
          {tm.logoUrl && <img src={tm.logoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />}
          {tm.name}
        </Link>
      ))}
    </div>
  );

  // One row per node, recursing into `children` (or the Teams mega-list) as an
  // indented accordion section — tap the chevron to expand, tap the label to
  // navigate (a "#" href, i.e. the desktop-only "Teams" trigger, toggles instead).
  const MobileNode = ({ node, path, depth }: { node: NavNode; path: string; depth: number }) => {
    const hasKids = (!!node.children && node.children.length > 0) || node.mega;
    const isOpen = openPaths.has(path);
    const pad = 12 + depth * 16;
    const toggleOnly = node.href === "#";
    return (
      <div className={depth === 0 ? "border-b border-slate-800/60" : ""}>
        <div className="flex items-center">
          {toggleOnly ? (
            <button type="button" onClick={() => togglePath(path)} className="flex-1 text-left py-2.5 text-[14px] text-slate-200" style={{ paddingLeft: pad }}>
              {node.label}
            </button>
          ) : (
            <Link href={node.href} onClick={closeMobile} className="flex-1 py-2.5 text-[14px] text-slate-200" style={{ paddingLeft: pad }}>
              {node.label}
            </Link>
          )}
          {hasKids && (
            <button type="button" onClick={() => togglePath(path)} aria-label="Toggle submenu" className="px-3.5 py-2.5 text-slate-500 hover:text-white">
              <span className={`inline-block transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
          )}
        </div>
        {hasKids && isOpen && (
          <div className="pb-1">
            {node.mega ? <TeamsMobileList pad={pad + 16} /> : node.children!.map((c) => (
              <MobileNode key={c.label} node={c} path={`${path}/${c.label}`} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav
      className={`sticky top-0 z-50 border-b border-slate-700/30 transition-all duration-300 ${
        scrolled
          ? "bg-[#0a1628]/95 backdrop-blur-xl shadow-lg shadow-black/30"
          : "bg-[#0a1628]/80 backdrop-blur-md"
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-4">
        <div className="flex items-center h-14 gap-1.5">
          {/* Mobile: hamburger toggle for the drawer below */}
          <button
            type="button"
            onClick={() => (mobileOpen ? closeMobile() : setMobileOpen(true))}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            className="md:hidden w-9 h-9 grid place-items-center rounded-md text-slate-300 hover:text-white hover:bg-slate-800/40 shrink-0"
          >
            {mobileOpen ? (
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>

          {/* Menu — desktop only; mobile gets the tap-to-expand drawer below */}
          <div className="hidden md:flex items-center gap-0.5 flex-wrap flex-1">
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

            {/* Forum — public discussion, visible to everyone; badge = new posts for a signed-in GM */}
            <Link href="/forum" className="relative px-2.5 py-1.5 text-[13px] font-semibold rounded-md text-slate-400 hover:text-white hover:bg-slate-800/40 whitespace-nowrap inline-flex items-center gap-1">
              🗣️ Forum
              {(gm?.forumNew ?? 0) > 0 && <span className="min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold grid place-items-center">{gm!.forumNew}</span>}
            </Link>

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

          {/* Mobile-only compact right side — always reachable without opening the drawer */}
          <div className="md:hidden flex items-center gap-1.5 ml-auto">
            <LangSwitcher lang={lang} />
            {gm ? (
              <Link href={`/teams/${gm.slug}`} className="relative w-8 h-8 rounded-full bg-blue-600 grid place-items-center text-[12px] font-black text-white shrink-0">
                {gm.nickname[0]?.toUpperCase()}
                {((gm.unreadDm ?? 0) > 0 || (gm.admin && (gm.pendingJoins ?? 0) > 0)) && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-600 border border-[#0a1628]" />
                )}
              </Link>
            ) : (
              <Link href="/login" className="px-2.5 py-1.5 text-[12px] font-semibold rounded-md text-slate-300 hover:text-white hover:bg-slate-800/40 whitespace-nowrap">{tr("ui.gmLogin")}</Link>
            )}
          </div>
        </div>

        {/* Mobile drawer — tap-to-expand accordion (hover has no touch equivalent) */}
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-700/40 -mx-4 px-0 max-h-[calc(100vh-3.5rem)] overflow-y-auto bg-[#0a1628]">
            {menuItems.map((item) => (
              <MobileNode key={item.key} node={item} path={item.key} depth={0} />
            ))}

            <div className="border-t border-slate-700/60 my-1" />
            <Link href="/forum" onClick={closeMobile} className="flex items-center gap-1.5 py-2.5 px-3 text-[14px] text-slate-200">
              🗣️ Forum
              {(gm?.forumNew ?? 0) > 0 && <span className="min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold grid place-items-center">{gm!.forumNew}</span>}
            </Link>
            {gm && (
              <Link href="/messages" onClick={closeMobile} className="flex items-center gap-1.5 py-2.5 px-3 text-[14px] text-slate-200">
                💬 Messages
                {(gm.unreadDm ?? 0) > 0 && <span className="min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold grid place-items-center">{gm.unreadDm}</span>}
              </Link>
            )}

            <div className="border-t border-slate-700/60 my-1" />
            {gm ? (
              <>
                <div className="px-3 py-2 flex items-center gap-2 text-slate-300">
                  <span className="w-7 h-7 rounded-full bg-blue-600 grid place-items-center text-[12px] font-black text-white shrink-0">{gm.nickname[0]?.toUpperCase()}</span>
                  <span className="text-[14px] font-semibold">{gm.nickname}</span>
                </div>
                <Link href={`/teams/${gm.slug}`} onClick={closeMobile} className="block py-2 px-3 pl-11 text-[13px] text-slate-300">{tr("ui.myTeam")}</Link>
                <Link href={`/teams/${gm.slug}/profile`} onClick={closeMobile} className="block py-2 px-3 pl-11 text-[13px] text-slate-300">{tr("ui.profile")}</Link>
                <Link href={`/teams/${gm.slug}/lines`} onClick={closeMobile} className="block py-2 px-3 pl-11 text-[13px] text-slate-300">{tr("ui.linesTactics")}</Link>
                {gm.admin && (
                  <MobileNode
                    path="__admin"
                    depth={0}
                    node={{
                      label: `⚙️ ${tr("ui.admin")}${(gm.pendingJoins ?? 0) > 0 ? ` (${gm.pendingJoins})` : ""}`,
                      href: "#",
                      children: [
                        { label: tr("ui.adminPanel"), href: "/admin" },
                        { label: "Žiadosti o vstup", href: "/admin/join-requests" },
                        { label: "League Calendar", href: "/calendar" },
                        { label: "ELC Rookies", href: "/admin/elc" },
                        { label: "Roster Update", href: "/admin/roster-update" },
                        { label: "Season Control", href: "/admin/season" },
                        { label: "Latest Signings", href: "/admin/signings" },
                        { label: "Simulation Engine", href: "/admin/simulation" },
                        { label: "Team Lines & Tactics", href: "/admin/team-lines" },
                      ],
                    }}
                  />
                )}
                <div className="border-t border-slate-700/60 my-1" />
                <Link href="/login" onClick={closeMobile} className="block py-2.5 px-3 text-[13px] text-slate-300">{tr("ui.switchTeam")}</Link>
                <Link href={`/teams/${gm.slug}/logout`} onClick={closeMobile} className="block py-2.5 px-3 text-[13px] text-red-400">{tr("ui.logout")}</Link>
              </>
            ) : (
              <Link href="/login" onClick={closeMobile} className="block py-2.5 px-3 text-[14px] font-semibold text-blue-300">{tr("ui.gmLogin")}</Link>
            )}

            <div className="border-t border-slate-700/60 my-1" />
            <div className="px-3 py-2.5 flex items-center justify-between gap-2">
              <span className="text-sm text-slate-300">{tr("ui.language")}</span>
              <LangSwitcher lang={lang} />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}