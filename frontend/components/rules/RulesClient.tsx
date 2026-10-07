"use client";

import React, { useState, useMemo, useEffect } from "react";

export type RuleGroup = {
  h?: string;
  points: (string | string[])[];
};

export type RuleSection = {
  id: string;
  title: string;
  intro?: string;
  groups: RuleGroup[];
};

const SECTION_ICONS: Record<string, string> = {
  season: "📅",
  rosters: "👥",
  con: "🩹",
  goalies: "🥅",
  stats: "📊",
  cap: "💰",
  fa: "🌟",
  rfa: "✍️",
  contracts: "📜",
  trades: "🔁",
  draft: "🎟️",
  allstar: "⭐",
  waivers: "📋",
  world: "🌍",
  ratings: "⚡",
  tactics: "🧠",
  predictor: "🏆",
};

const CATEGORIES = [
  { id: "all", label: "Všetky kapitoly", icon: "📚" },
  { id: "gameplay", label: "Zápasy & Sezóna", icon: "🏒", sectionIds: ["season", "con", "goalies", "stats", "tactics"] },
  { id: "roster", label: "Súpisky & Hráči", icon: "👥", sectionIds: ["rosters", "waivers", "ratings", "world"] },
  { id: "finance", label: "Financie & Zmluvy", icon: "💰", sectionIds: ["cap", "fa", "rfa", "contracts"] },
  { id: "market", label: "Trh & Draft", icon: "🔄", sectionIds: ["trades", "draft", "allstar"] },
  { id: "predictor", label: "Tipovačka", icon: "🏆", sectionIds: ["predictor"] },
];

export default function RulesClient({
  sections,
  title,
  subtitle,
  note,
}: {
  sections: RuleSection[];
  title: string;
  subtitle: string;
  note: string;
}) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [activeSectionId, setActiveSectionId] = useState<string>(sections[0]?.id || "");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() =>
    sections.reduce((acc, s) => ({ ...acc, [s.id]: true }), {})
  );

  // Active section tracking on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const buffer = 160;

      for (let i = sections.length - 1; i >= 0; i--) {
        const sec = sections[i];
        const el = document.getElementById(sec.id);
        if (el && el.offsetTop - buffer <= scrollY) {
          setActiveSectionId(sec.id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [sections]);

  // Filter sections by tab & search query
  const filteredSections = useMemo(() => {
    let result = sections;

    // Filter by category tab
    if (activeTab !== "all") {
      const cat = CATEGORIES.find((c) => c.id === activeTab);
      if (cat?.sectionIds) {
        result = result.filter((s) => cat.sectionIds.includes(s.id));
      }
    }

    // Filter by search query
    const q = search.trim().toLowerCase();
    if (!q) return result;

    return result
      .map((sec) => {
        const titleMatch = sec.title.toLowerCase().includes(q);
        const introMatch = sec.intro?.toLowerCase().includes(q);

        const filteredGroups = sec.groups
          .map((g) => {
            const hMatch = g.h?.toLowerCase().includes(q);
            const filteredPoints = g.points.filter((p) => {
              if (Array.isArray(p)) {
                return p.some((item) => item.toLowerCase().includes(q));
              }
              return p.toLowerCase().includes(q);
            });

            if (hMatch || filteredPoints.length > 0) {
              return { ...g, points: filteredPoints.length > 0 ? filteredPoints : g.points };
            }
            return null;
          })
          .filter(Boolean) as RuleGroup[];

        if (titleMatch || introMatch || filteredGroups.length > 0) {
          return {
            ...sec,
            groups: filteredGroups.length > 0 ? filteredGroups : sec.groups,
          };
        }
        return null;
      })
      .filter(Boolean) as RuleSection[];
  }, [sections, activeTab, search]);

  const toggleAll = (expand: boolean) => {
    setExpandedSections(sections.reduce((acc, s) => ({ ...acc, [s.id]: expand }), {}));
  };

  const copyAnchor = (id: string) => {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="w-full space-y-6 py-2">
      {/* Hero Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 p-6 sm:p-8 shadow-2xl">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-bold uppercase tracking-wider">
              <span>📖</span>
              <span>Oficiálny manuál a kódex UNHL</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {title}
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {subtitle}
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-4 py-3 text-center min-w-[90px]">
              <div className="text-2xl font-black text-white tabular-nums leading-none">
                {sections.length}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-1 font-semibold">
                Kapitol
              </div>
            </div>
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-4 py-3 text-center min-w-[90px]">
              <div className="text-2xl font-black text-emerald-400 tabular-nums leading-none">
                84
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-1 font-semibold">
                Zápasov
              </div>
            </div>
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-4 py-3 text-center min-w-[90px]">
              <div className="text-2xl font-black text-blue-400 tabular-nums leading-none">
                23
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-1 font-semibold">
                Hráčov max
              </div>
            </div>
          </div>
        </div>

        {/* Live Search Box */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="relative max-w-xl">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 text-base pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hľadať v pravidlách (napr. buyout, platový strop, waiver, zranenie, QO, výmena)..."
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-10 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-white"
                title="Vymazať filter"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category Tabs & Expand Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setActiveTab(c.id);
                setSearch("");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTab === c.id
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/40"
                  : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <span>{c.icon}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            onClick={() => toggleAll(true)}
            className="text-[11px] font-semibold px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Rozbaliť všetko
          </button>
          <button
            onClick={() => toggleAll(false)}
            className="text-[11px] font-semibold px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Zbaliť všetko
          </button>
        </div>
      </div>

      {/* Main 2-Column Documentation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Sticky Sidebar: Table of Contents */}
        <aside className="hidden lg:block lg:col-span-1 sticky top-20 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl max-h-[calc(100vh-6rem)] overflow-y-auto">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <span>📑</span>
              <span>Obsah pravidiel</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {filteredSections.length}/{sections.length}
            </span>
          </div>

          <nav className="space-y-1">
            {sections.map((s) => {
              const isActive = activeSectionId === s.id;
              const isShown = filteredSections.some((f) => f.id === s.id);
              const icon = SECTION_ICONS[s.id] || "📌";

              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-900/30 font-bold translate-x-1"
                      : isShown
                      ? "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                      : "text-slate-600 opacity-50 hover:opacity-80"
                  }`}
                >
                  <span className="text-sm shrink-0">{icon}</span>
                  <span className="truncate">{s.title}</span>
                </a>
              );
            })}
          </nav>

          <div className="pt-4 mt-4 border-t border-slate-800/80">
            <button
              onClick={scrollToTop}
              className="w-full py-2 rounded-xl text-xs font-semibold bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-1.5"
            >
              <span>⬆️</span>
              <span>Návrat na začiatok</span>
            </button>
          </div>
        </aside>

        {/* Right Main Area: Filtered Rule Sections */}
        <div className="lg:col-span-3 space-y-6">
          {filteredSections.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center space-y-3">
              <div className="text-4xl">🔍</div>
              <h2 className="text-lg font-bold text-slate-200">
                Žiadne pravidlá nezodpovedajú vyhľadávaniu
              </h2>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Skúste upraviť hľadaný výraz alebo kliknite na &quot;Všetky kapitoly&quot; v kategóriách vyššie.
              </p>
              <button
                onClick={() => {
                  setSearch("");
                  setActiveTab("all");
                }}
                className="mt-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Resetovať filtre
              </button>
            </div>
          ) : (
            filteredSections.map((s, sIndex) => {
              const isExpanded = expandedSections[s.id] ?? true;
              const icon = SECTION_ICONS[s.id] || "📌";

              return (
                <section
                  key={s.id}
                  id={s.id}
                  className="scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden transition-all hover:border-slate-700/80"
                >
                  {/* Section Header Banner */}
                  <div className="bg-gradient-to-r from-slate-900 via-slate-800/60 to-slate-900 p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 grid place-items-center text-xl shrink-0 shadow-inner">
                        {icon}
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base sm:text-lg font-black text-white tracking-tight truncate flex items-center gap-2">
                          <span>{s.title}</span>
                        </h2>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Copy link button */}
                      <button
                        onClick={() => copyAnchor(s.id)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/60 transition-colors flex items-center gap-1"
                        title="Skopírovať odkaz na túto kapitolu"
                      >
                        <span>{copiedId === s.id ? "✓" : "🔗"}</span>
                        <span className="hidden sm:inline">
                          {copiedId === s.id ? "Skopírované" : "Odkaz"}
                        </span>
                      </button>

                      {/* Expand / Collapse toggle */}
                      <button
                        onClick={() =>
                          setExpandedSections((prev) => ({
                            ...prev,
                            [s.id]: !isExpanded,
                          }))
                        }
                        className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 grid place-items-center text-sm transition-colors cursor-pointer"
                        title={isExpanded ? "Zbaliť kapitolu" : "Rozbaliť kapitolu"}
                      >
                        {isExpanded ? "−" : "+"}
                      </button>
                    </div>
                  </div>

                  {/* Section Content */}
                  {isExpanded && (
                    <div className="p-5 sm:p-6 space-y-5">
                      {s.intro && (
                        <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/20 text-blue-200/90 text-sm leading-relaxed flex items-start gap-3">
                          <span className="text-base shrink-0 mt-0.5">💡</span>
                          <span>{s.intro}</span>
                        </div>
                      )}

                      <div className="space-y-5 divide-y divide-slate-800/60">
                        {s.groups.map((g, gi) => (
                          <div key={gi} className={gi > 0 ? "pt-5" : ""}>
                            {g.h && (
                              <div className="flex items-center gap-2 mb-3">
                                <span className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-400">
                                  {g.h}
                                </h3>
                              </div>
                            )}

                            <div className="space-y-2.5">
                              {g.points.map((p, pi) => {
                                if (Array.isArray(p)) {
                                  return (
                                    <div
                                      key={pi}
                                      className="ml-4 pl-3.5 border-l-2 border-slate-700/80 space-y-2 py-1"
                                    >
                                      {p.map((subItem, si) => (
                                        <div
                                          key={si}
                                          className="text-xs sm:text-sm text-slate-300 leading-relaxed flex items-start gap-2"
                                        >
                                          <span className="text-slate-500 text-xs shrink-0 mt-1">
                                            ▪
                                          </span>
                                          <span>{formatRuleText(subItem, search)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                }

                                return (
                                  <div
                                    key={pi}
                                    className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/70 hover:border-slate-700 transition-colors text-xs sm:text-sm text-slate-200 leading-relaxed flex items-start gap-3 shadow-sm"
                                  >
                                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold grid place-items-center shrink-0 mt-0.5">
                                      {pi + 1}
                                    </span>
                                    <span className="flex-1">
                                      {formatRuleText(p, search)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Note */}
      <div className="pt-4 text-center">
        <p className="text-xs text-slate-500 max-w-xl mx-auto leading-relaxed">
          {note}
        </p>
      </div>
    </div>
  );
}

/**
 * Highlights search matches and key terms (numbers, dollar amounts, clauses)
 */
function formatRuleText(text: string, searchQuery?: string): React.ReactNode {
  if (!text) return text;

  // If there's an active search query, highlight it
  if (searchQuery && searchQuery.trim().length > 1) {
    const q = searchQuery.trim();
    const regex = new RegExp(`(${escapeRegex(q)})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark
          key={i}
          className="bg-amber-400/30 text-amber-200 px-1 py-0.2 rounded font-bold border border-amber-400/50"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  }

  return text;
}

function escapeRegex(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
