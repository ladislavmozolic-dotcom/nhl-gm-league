import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import { getTeamSession, canManageTeam } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/sim/settings";
import { teamDashboard } from "@/lib/detailed-finance-server";
import { teamAttendance } from "@/lib/attendance-server";
import { teamSponsor } from "@/lib/sponsorship-server";
import PricingControl from "@/components/PricingControl";
import SponsorPicker from "@/components/SponsorPicker";

export const dynamic = "force-dynamic";

const M = (n: number) => `${n < 0 ? "-" : ""}$${(Math.abs(n) / 1e6).toFixed(1)}M`;
const N = (n: number) => n.toLocaleString("en-US");

export default async function FinanceDashboardPage() {
  const settings = await loadSettings();
  const sessionId = await getTeamSession();
  const team = sessionId ? await prisma.team.findUnique({ where: { id: sessionId }, select: { id: true, slug: true } }) : null;
  const dash = team ? await teamDashboard(team.id) : null;
  const canManage = team ? await canManageTeam(team.id) : false;
  const [att, sponsor] = team && canManage ? await Promise.all([teamAttendance(team.id), teamSponsor(team.id)]) : [null, null];

  if (!dash) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        <PageHeader title="Finance Dashboard" subtitle="Detailed Finance" />
        <Card><p className="text-sm text-slate-400">Sign in as an NHL club to see its finance dashboard.</p></Card>
      </div>
    );
  }

  const tile = (label: string, value: string, sub?: string, accent?: string) => (
    <div className="rounded-lg bg-slate-800/40 border border-slate-700 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-lg font-black tabular-nums ${accent ?? ""}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
      <PageHeader title={`${dash.name} — Finances`} subtitle="Detailed Finance dashboard" />
      {settings.financeMode !== "detailed" && (
        <Card><p className="text-sm text-amber-400/80">Preview — the <b>Detailed Finance</b> system isn&apos;t active. Switch it on in engine settings.</p></Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tile("Cash", M(dash.cash))}
        {tile("Revenue", M(dash.revenue))}
        {tile("Expenses", M(dash.expenses))}
        {tile("Projected profit", M(dash.profit), undefined, dash.profit >= 0 ? "text-emerald-300" : "text-rose-300")}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card title="Revenue breakdown" accent="text-emerald-300">
          <div className="space-y-1.5">
            {dash.revenueLines.map((l) => (
              <div key={l.label} className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{l.label}</span>
                <span className="tabular-nums font-semibold">{M(l.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm border-t border-slate-800 pt-1.5 mt-1.5">
              <span className="font-semibold">Total revenue</span><span className="tabular-nums font-bold text-emerald-300">{M(dash.revenue)}</span>
            </div>
          </div>
        </Card>

        <Card title="Expenses breakdown" accent="text-rose-300">
          <div className="space-y-1.5">
            {dash.expenseLines.map((l) => (
              <div key={l.label} className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{l.label}</span>
                <span className="tabular-nums font-semibold">{M(l.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm border-t border-slate-800 pt-1.5 mt-1.5">
              <span className="font-semibold">Total expenses</span><span className="tabular-nums font-bold text-rose-300">{M(dash.expenses)}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Fan & business" accent="text-fuchsia-300">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tile("Fan Interest", `${dash.fanInterest}`, `${dash.fanDelta >= 0 ? "↑" : "↓"}${Math.abs(dash.fanDelta)}`)}
          {tile("Avg attendance", `${Math.round(dash.attendancePct * 100)}%`, `League #${dash.attendanceRank}`)}
          {tile("Season tickets", N(dash.sthSold), `/ ${N(dash.sthCap)}`)}
          {tile("Merch", `#${dash.merchRank}`, dash.topJersey ? `Top: ${dash.topJersey}` : undefined)}
        </div>
      </Card>

      {dash.reasons.length > 0 && (
        <Card title="Why are finances moving?" accent="text-sky-300">
          <ul className="text-sm text-slate-300 space-y-1">
            {dash.reasons.map((r, i) => <li key={i}>· {r}</li>)}
          </ul>
        </Card>
      )}

      {/* Team controls — set as your club */}
      {att && (
        <Card title="Ticket pricing" accent="text-sky-300">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr] gap-4 items-center">
            <div className="text-[13px] text-slate-400">Set what you charge — higher price earns more per seat but softens demand. Feeds attendance, season tickets and revenue.</div>
            <PricingControl att={att} />
          </div>
        </Card>
      )}
      {sponsor && (
        <Card title="Main sponsor" accent="text-emerald-300">
          <p className="text-[13px] text-slate-400 mb-3">Pick the deal that fits your ambitions — offer size scales with your brand strength (Fan Interest + Star Power).</p>
          <SponsorPicker sponsor={sponsor} />
        </Card>
      )}

      <div className="flex flex-wrap gap-2 text-xs pt-1">
        <span className="text-slate-500 py-1.5">League tables:</span>
        {[["Fan Interest", "/finance/fan-interest"], ["Season Tickets", "/finance/season-tickets"], ["Attendance", "/finance/attendance"], ["Merchandise", "/finance/merchandise"], ["Sponsorship", "/finance/sponsorship"]].map(([l, h]) => (
          <Link key={h} href={h} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">{l} →</Link>
        ))}
      </div>
    </div>
  );
}
