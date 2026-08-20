import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getLang } from "@/lib/lang-server";
import { t as tt } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type Item = { href: string; title: string; descKey: string };
type Group = { titleKey: string; items: Item[] };

const GROUPS: Group[] = [
  {
    titleKey: "admin.grpSeason",
    items: [
      { href: "/admin/dashboard", title: "⭐ Commissioner Dashboard", descKey: "admin.dashboard.d" },
      { href: "/admin/season", title: "Season Control", descKey: "admin.season.d" },
      { href: "/admin/simulation", title: "Simulation Engine", descKey: "admin.simulation.d" },
      { href: "/admin/calibration", title: "Calibration Lab", descKey: "admin.calibration.d" },
      { href: "/admin/sim-guide", title: "How the Sim Works", descKey: "admin.simGuide.d" },
      { href: "/admin/lines", title: "Line Submissions", descKey: "admin.lines.d" },
    ],
  },
  {
    titleKey: "admin.grpRosters",
    items: [
      { href: "/admin/rosters", title: "Roster Source", descKey: "admin.rosters.d" },
      { href: "/admin/team-lines", title: "Team Lines & Tactics", descKey: "admin.teamLines.d" },
      { href: "/admin/contracts", title: "Contracts", descKey: "admin.contracts.d" },
      { href: "/admin/trades", title: "Completed Trades", descKey: "admin.trades.d" },
      { href: "/admin/signings", title: "Latest Signings", descKey: "admin.signings.d" },
      { href: "/admin/positions", title: "Player Positions", descKey: "admin.positions.d" },
      { href: "/admin/ratings", title: "Player Ratings", descKey: "admin.ratings.d" },
      { href: "/admin/conditions", title: "Trade Conditions", descKey: "admin.conditions.d" },
    ],
  },
  {
    titleKey: "admin.grpFinance",
    items: [
      { href: "/admin/finance", title: "Team Popularity", descKey: "admin.finance.d" },
      { href: "/draft/lottery", title: "Draft Lottery", descKey: "admin.lottery.d" },
      { href: "/admin/real-drafts", title: "Real Draft Import", descKey: "admin.realDrafts.d" },
    ],
  },
  {
    titleKey: "admin.grpContent",
    items: [
      { href: "/admin/site-editor", title: "🎨 Web Editor", descKey: "admin.siteEditor.d" },
      { href: "/admin/announcements", title: "Commissioner Announcements", descKey: "admin.announcements.d" },
      { href: "/admin/awards", title: "Award Voting", descKey: "admin.awards.d" },
    ],
  },
];

export default async function AdminPage() {
  const lang = await getLang();
  const T = (k: string) => tt(lang, k);
  return (
    <div className="mx-auto max-w-6xl px-4 py-2 space-y-8">
      <PageHeader title="Admin Panel" subtitle={T("admin.subtitle")} />
      {GROUPS.map((g) => (
        <section key={g.titleKey} className="space-y-3">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{T(g.titleKey)}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {g.items.map((c) => (
              <Link key={c.href} href={c.href}
                className="group block bg-slate-900/70 border border-slate-800 rounded-xl p-4 hover:border-blue-500/60 hover:bg-slate-900 transition-colors">
                <div className="font-semibold text-sm mb-1 group-hover:text-white">{c.title}</div>
                <div className="text-[12px] text-slate-400 leading-snug">{T(c.descKey)}</div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
