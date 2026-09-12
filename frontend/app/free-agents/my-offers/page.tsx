import { PageHeader, Card, BackPill } from "@/components/ui";
import PlayerLink from "@/components/PlayerLink";
import PlayerAvatar from "@/components/playerAvatar";
import { money } from "@/lib/finance";
import { getMyActiveOffersAction } from "@/app/free-agents/actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pending", cls: "bg-slate-700/60 text-slate-300 border-slate-600/60" },
  COUNTERED: { label: "Countered", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  SHORTLISTED: { label: "Shortlisted", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  ACCEPTED: { label: "Accepted", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

const ovColor = (v: number | null) => v == null ? "text-slate-500" : v >= 80 ? "text-emerald-400" : v >= 70 ? "text-blue-400" : v >= 60 ? "text-amber-400" : "text-slate-400";

export default async function MyOffersPage() {
  const r = await getMyActiveOffersAction();

  return (
    <div className="space-y-6 py-2 max-w-4xl">
      <PageHeader
        title="My Active Offers"
        subtitle="Every standing offer your own club currently has out on a free agent."
        right={<BackPill href="/free-agents">Free Agent Frenzy</BackPill>}
      />

      {!r.ok ? (
        <Card><p className="text-sm text-rose-400">🔒 {r.error}</p></Card>
      ) : r.offers.length === 0 ? (
        <Card><p className="text-sm text-slate-500 text-center py-6">You don&apos;t have any active offers right now.</p></Card>
      ) : (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 divide-y divide-slate-800/50 overflow-hidden">
          {r.offers.map((o) => {
            const st = STATUS[o.status] ?? { label: o.status, cls: "bg-slate-700/60 text-slate-300 border-slate-600/60" };
            return (
              <div key={o.playerId} className="flex items-center gap-3 px-4 py-3 flex-wrap">
                <PlayerAvatar src={o.photoUrl} alt={o.name} size={36} />
                <div className="min-w-0 shrink-0">
                  <PlayerLink name={o.name} slug={o.slug} id={o.playerId} className="font-bold text-white text-sm" />
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <span>{o.position}</span>
                    {o.overall != null && <span className={ovColor(o.overall)}>OV {o.overall}</span>}
                  </div>
                </div>
                <div className="flex-1 flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                  <span className="font-semibold text-slate-200 tabular-nums">{money(o.salary)}</span>
                  <span>× {o.years}yr</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${o.twoWay ? "border-slate-700 text-slate-400" : "border-amber-600/60 text-amber-400"}`}>
                    {o.twoWay ? "2-way" : "1-way"}
                  </span>
                  {!o.isGoalie && <span className="text-slate-600">Line {o.line}{(o.pp || o.pk) && ` · ${[o.pp && "PP", o.pk && "PK"].filter(Boolean).join("/")}`}</span>}
                  <span className="text-slate-600">Round {o.round || "—"}</span>
                  {o.status === "COUNTERED" && o.counterSalary != null && (
                    <span className="text-amber-400">Countered at {money(o.counterSalary)} × {o.counterYears}yr</span>
                  )}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0 ${st.cls}`}>{st.label}</span>
                <span className="text-[10px] text-slate-600 shrink-0 hidden sm:inline">{new Date(o.updatedAt).toLocaleString("sk-SK", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-slate-500 px-1">Blind bidding still applies: this only ever shows your own club&apos;s offers, never a rival&apos;s.</p>
    </div>
  );
}
