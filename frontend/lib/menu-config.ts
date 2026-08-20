// Web Editor — Module 2 (Menu & sections). The DEFAULT top-nav lives here as data with
// stable keys; admins store only OVERRIDES in SiteConfig.menu ({ order, hidden }) so a
// new menu item added in code still appears until an admin hides it. Custom pages
// (Module 4) are appended as extra items with key "page:<slug>".

export type MenuChild = { label: string; href: string; children?: MenuChild[] };
export type MenuItem = { key: string; label: string; href: string; mega?: boolean; children?: MenuChild[] };

export const DEFAULT_MENU: MenuItem[] = [
  { key: "home", label: "Home", href: "/" },
  { key: "scores", label: "Scores", href: "/scores" },
  { key: "standings", label: "Standings", href: "/standings" },
  { key: "schedule", label: "Schedule", href: "/schedule" },
  { key: "trades", label: "Trades", href: "/trades", children: [
    { label: "🔁 Trade Room", href: "/trades/build" },
    { label: "🧱 Trade Block", href: "/trade-block" },
    { label: "📝 Waiver Wire", href: "/waivers" },
    { label: "📋 Trade tracker", href: "/trades" },
    { label: "🧾 Transactions", href: "/transactions" },
  ] },
  { key: "teams", label: "Teams", href: "#", mega: true },
  { key: "stats", label: "Stats", href: "/stats", children: [
    { label: "🥇 Individual Leaders", href: "/stats/leaders" },
    { label: "📊 Advanced Stats", href: "/stats/advanced" },
    { label: "🛰️ EDGE Tracking", href: "/stats/edge" },
    { label: "👤 Player Stats", href: "/stats/players" },
    { label: "🥅 Goalie Stats", href: "/stats/goalies" },
    { label: "🛡️ Team Stats", href: "/stats/teams" },
    { label: "🏛️ Franchise Leaders", href: "/stats/franchise" },
    { label: "📈 Player Career Stats", href: "/stats/career" },
  ] },
  { key: "frenzy", label: "Free Agent Frenzy", href: "/free-agents", children: [
    { label: "🏒 Skaters", href: "/free-agents" },
    { label: "🥅 Goalies", href: "/free-agents?type=goalies" },
    { label: "📄 Offer Sheets", href: "/offer-sheets" },
    { label: "✍️ Signings", href: "/signings" },
  ] },
  { key: "players", label: "Players", href: "/players/injuries", children: [
    { label: "🏥 Injury Report", href: "/players/injuries" },
    { label: "🔥 Hot & Cold Players", href: "/players/hot-cold" },
    { label: "⭐ Three Stars", href: "/players/three-stars" },
    { label: "📑 Contracts", href: "/players/contracts" },
    { label: "👥 All Players", href: "/players/all" },
  ] },
  { key: "league", label: "League", href: "/league", children: [
    { label: "📖 Rules", href: "/rules" },
    { label: "💰 Finance", href: "/finance", children: [
      { label: "🏦 Finance (bank & income)", href: "/finance" },
      { label: "🧢 Salary Cap (Cap Central)", href: "/salary-cap" },
      { label: "📣 Fan Interest — league", href: "/finance/fan-interest" },
      { label: "🎟️ Season Tickets — league", href: "/finance/season-tickets" },
      { label: "🏟️ Attendance — league", href: "/finance/attendance" },
      { label: "🛍️ Merchandise — league", href: "/finance/merchandise" },
      { label: "🤝 Sponsorships — league", href: "/finance/sponsorship" },
    ] },
    { label: "🌟 Tonight's Best", href: "/league/digest" },
    { label: "🎯 Milestone Watch", href: "/league/milestones" },
    { label: "🏆 League Records", href: "/league/records" },
    { label: "🔍 Audit Log", href: "/league/audit" },
    { label: "👔 Team / GM", href: "/league" },
    { label: "🧑‍✈️ Captains", href: "/captains" },
    { label: "🎓 Coaches", href: "/coaches" },
    { label: "✍️ Signings", href: "/signings" },
  ] },
  { key: "draft", label: "Entry Draft", href: "/draft", children: [
    { label: "🎰 Draft Lottery", href: "/draft/lottery" },
    { label: "🎯 Draft Room", href: "/draft/room" },
    { label: "📅 Upcoming Draft", href: "/draft" },
    { label: "📜 Draft History", href: "/draft/history" },
  ] },
  { key: "history", label: "History", href: "/history", children: [
    { label: "🕰️ League History", href: "/history" },
    { label: "🏅 Hall of Fame", href: "/hall-of-fame" },
    { label: "🏵️ Awards", href: "/awards" },
    { label: "🗳️ Award Voting", href: "/awards/vote" },
  ] },
  { key: "tools", label: "Tools", href: "/tools/all-rosters", children: [
    { label: "🗂️ All Rosters", href: "/tools/all-rosters" },
    { label: "⚖️ Player Compare", href: "/tools/compare" },
    { label: "🧮 Cap Calculator", href: "/tools/cap-calculator" },
    { label: "🎚️ STHS Parameters (calculator)", href: "/tools/player-calculator" },
    { label: "🎛️ Edge Parameters (calculator)", href: "/tools/edge-calculator" },
    { label: "🔄 Player Data Refresh", href: "/tools/player-data" },
  ] },
  { key: "ahl", label: "AHL", href: "/ahl", children: [
    { label: "🏒 AHL Teams", href: "/ahl" },
    { label: "🏆 AHL Standings", href: "/standings?league=AHL" },
    { label: "📅 AHL Schedule", href: "/schedule?league=AHL" },
    { label: "🔢 AHL Scores", href: "/scores?league=AHL" },
    { label: "🥇 Individual Leaders", href: "/stats/leaders?league=AHL" },
    { label: "🛰️ EDGE Tracking", href: "/stats/edge?league=AHL" },
    { label: "👤 Player Stats", href: "/stats/players?league=AHL" },
    { label: "🥅 Goalie Stats", href: "/stats/goalies?league=AHL" },
    { label: "🛡️ Team Stats", href: "/stats/teams?league=AHL" },
    { label: "🏥 Injuries", href: "/players/injuries?league=AHL" },
  ] },
];

export type MenuOverrides = { order?: string[]; hidden?: string[] };

/** Merge admin overrides onto the default menu: saved order first (its keys in order),
 *  then any newer default items not yet in the saved order, minus hidden keys.
 *  `extra` = custom-page items (Module 4) to append. */
export function effectiveMenu(cfg: MenuOverrides | null | undefined, extra: MenuItem[] = []): MenuItem[] {
  const all = [...DEFAULT_MENU, ...extra];
  const byKey = new Map(all.map((m) => [m.key, m]));
  const order = cfg?.order ?? [];
  const hidden = new Set(cfg?.hidden ?? []);
  const seen = new Set<string>();
  const out: MenuItem[] = [];
  for (const k of order) { const m = byKey.get(k); if (m) { out.push(m); seen.add(k); } }
  for (const m of all) if (!seen.has(m.key)) out.push(m); // new items keep default position (appended)
  return out.filter((m) => !hidden.has(m.key));
}

/** The full ordered list WITH hidden flags — for the editor UI. */
export function menuForEditor(cfg: MenuOverrides | null | undefined, extra: MenuItem[] = []): { key: string; label: string; hidden: boolean; custom: boolean }[] {
  const all = [...DEFAULT_MENU, ...extra];
  const byKey = new Map(all.map((m) => [m.key, m]));
  const order = cfg?.order ?? [];
  const hidden = new Set(cfg?.hidden ?? []);
  const seen = new Set<string>();
  const ordered: MenuItem[] = [];
  for (const k of order) { const m = byKey.get(k); if (m) { ordered.push(m); seen.add(k); } }
  for (const m of all) if (!seen.has(m.key)) ordered.push(m);
  return ordered.map((m) => ({ key: m.key, label: m.label, hidden: hidden.has(m.key), custom: m.key.startsWith("page:") }));
}
