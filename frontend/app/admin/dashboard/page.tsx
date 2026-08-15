import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { commishToday, type TeamFlag } from "@/lib/commissioner-server";
import SimulateDayButton from "@/components/SimulateDayButton";

export const dynamic = "force-dynamic";

function Tile({ n, label, tone, href }: { n: number; label: string; tone: string; href?: string }) {
  const inner = (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-center h-full">
      <div className={`text-3xl font-black ${tone}`}>{n}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400 mt-1 leading-tight">{label}</div>
    </div>
  );
  return href ? <Link href={href} className="block hover:opacity-90">{inner}</Link> : inner;
}

function FlagList({ title, flags, tone }: { title: string; flags: TeamFlag[]; tone: string }) {
  if (flags.length === 0) return null;
  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
      <div className={`text-xs font-bold uppercase tracking-wide ${tone} mb-2`}>{title} ({flags.length})</div>
      <div className="flex flex-wrap gap-2">
        {flags.map((f) => (
          <Link key={f.teamId} href={f.slug ? `/teams/${f.slug}` : "#"} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800/60 px-2.5 py-1 text-xs hover:bg-slate-800">
            <span className="font-semibold">{f.code}</span><span className="text-slate-500">{f.detail}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function CommissionerDashboard() {
  if (!(await isAdmin())) redirect("/login");
  const t = await commishToday();
  const nextDate = new Date(t.nextDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const check = (ok: boolean, label: string, warn: string) => (
    <div className="flex items-center gap-2 text-sm">
      <span>{ok ? "✅" : "⚠️"}</span>
      <span className={ok ? "text-slate-300" : "text-amber-400"}>{ok ? label : warn}</span>
    </div>
  );

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Commissioner Dashboard" subtitle={`Next day — ${nextDate} · ${t.phase}`} right={<Link href="/admin" className="text-sm text-slate-400 hover:text-blue-400">All admin tools →</Link>} />

      {/* Today */}
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Today</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Tile n={t.gamesReady} label="Games ready" tone="text-blue-400" />
          <Tile n={t.missingLines.length} label="Teams missing lines" tone={t.missingLines.length ? "text-amber-400" : "text-slate-300"} />
          <Tile n={t.shortLineups.length} label="Short / illegal lineups" tone={t.shortLineups.length ? "text-red-400" : "text-slate-300"} />
          <Tile n={t.pendingTrades} label="Pending trades" tone={t.pendingTrades ? "text-purple-400" : "text-slate-300"} href="/trades" />
          <Tile n={t.injuredActive} label="Injured on roster" tone={t.injuredActive ? "text-red-300" : "text-slate-300"} href="/players/injuries" />
        </div>
      </div>

      {/* Simulate Day + pre-flight checks */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
          <div className="space-y-1.5">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Pre-flight — the engine checks before it plays</div>
            {check(t.missingLines.length === 0, "Lines set for every team", `${t.missingLines.length} team(s) without lines — the sim uses position-aware auto lines`)}
            {check(t.capOffenders.length === 0, "Every team cap-compliant", `${t.capOffenders.length} team(s) over the cap`)}
            {check(t.shortLineups.length === 0, "Rosters legal (12F / 6D / 2G)", `${t.shortLineups.length} team(s) short — auto call-ups will fill them`)}
            {check(true, "Goalies assigned (starter picked by fatigue)", "")}
          </div>
          <div className="md:text-right">
            <SimulateDayButton gamesReady={t.gamesReady} />
          </div>
        </div>
      </div>

      {/* Things to look at */}
      {(t.missingLines.length > 0 || t.shortLineups.length > 0 || t.capOffenders.length > 0) && (
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-slate-400">Needs attention</div>
          <FlagList title="⚠ Short / illegal lineups" flags={t.shortLineups} tone="text-red-400" />
          <FlagList title="Missing lines" flags={t.missingLines} tone="text-amber-400" />
          <FlagList title="Over the cap" flags={t.capOffenders} tone="text-red-400" />
        </div>
      )}

      {t.matchups.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Tomorrow&apos;s slate</div>
          <div className="flex flex-wrap gap-2">
            {t.matchups.map((m, i) => <span key={i} className="rounded-lg bg-slate-800/50 px-3 py-1.5 text-sm text-slate-300">{m.away} @ {m.home}</span>)}
            {t.gamesReady > t.matchups.length && <span className="rounded-lg px-3 py-1.5 text-sm text-slate-500">+{t.gamesReady - t.matchups.length} more</span>}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/league/audit" className="text-slate-400 hover:text-blue-400">🔒 Audit Log →</Link>
        <Link href="/admin/season" className="text-slate-400 hover:text-blue-400">Season Control →</Link>
        <Link href="/admin/simulation" className="text-slate-400 hover:text-blue-400">Engine settings →</Link>
      </div>
    </div>
  );
}
