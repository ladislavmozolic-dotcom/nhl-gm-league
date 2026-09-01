import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import PlayerLink from "@/components/PlayerLink";
import PlayerAvatar from "@/components/playerAvatar";
import { money } from "@/lib/finance";
import { getAllActiveOffersAction } from "@/app/free-agents/actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pending", cls: "bg-slate-700/60 text-slate-300 border-slate-600/60" },
  COUNTERED: { label: "Countered", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  SHORTLISTED: { label: "Shortlisted", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  ACCEPTED: { label: "Accepted", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

const ovColor = (v: number | null) => v == null ? "text-slate-500" : v >= 80 ? "text-emerald-400" : v >= 70 ? "text-blue-400" : v >= 60 ? "text-amber-400" : "text-slate-400";

export default async function AllOffersPage() {
  const r = await getAllActiveOffersAction();

  return (
    <div className="space-y-6 py-2 max-w-4xl">
      <PageHeader
        title="All Active Offers"
        subtitle="Every free agent currently carrying at least one standing offer — commissioner / co-commissioner view."
        right={<Link href="/free-agents" className="text-sm text-slate-400 hover:text-blue-400">← Free Agent Frenzy</Link>}
      />

      {!r.ok ? (
        <Card><p className="text-sm text-rose-400">🔒 {r.error}</p></Card>
      ) : r.players.length === 0 ? (
        <Card><p className="text-sm text-slate-500 text-center py-6">Nobody has an active offer right now.</p></Card>
      ) : (
        <div className="space-y-4">
          {r.players.map((p) => {
            const top = p.offers[0];
            return (
              <div key={p.playerId} className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/40 border-b border-slate-800">
                  <PlayerAvatar src={p.photoUrl} alt={p.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <PlayerLink name={p.name} slug={p.slug} id={p.playerId} className="font-bold text-white text-[15px]" />
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span>{p.position}</span>
                      {p.overall != null && <span className={ovColor(p.overall)}>OV {p.overall}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">Top offer</div>
                    <div className="text-lg font-black text-emerald-400 leading-tight">{money(top.salary)}</div>
                  </div>
                </div>

                <div className="divide-y divide-slate-800/50">
                  {p.offers.map((o, i) => {
                    const st = STATUS[o.status] ?? { label: o.status, cls: "bg-slate-700/60 text-slate-300 border-slate-600/60" };
                    return (
                      <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${i === 0 ? "bg-emerald-500/[0.04]" : ""}`}>
                        {o.teamLogo ? (
                          <img src={o.teamLogo} alt="" className="w-6 h-6 object-contain shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-800 shrink-0" />
                        )}
                        <div className="w-12 shrink-0 font-bold text-slate-200 text-sm">{o.teamCode}</div>
                        <div className="flex-1 flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                          <span className="font-semibold text-slate-200 tabular-nums">{money(o.salary)}</span>
                          <span>× {o.years}yr</span>
                          {!p.isGoalie && <span className="text-slate-600">Line {o.line}{(o.pp || o.pk) && ` · ${[o.pp && "PP", o.pk && "PK"].filter(Boolean).join("/")}`}</span>}
                          <span className="text-slate-600">Round {o.round || "—"}</span>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0 ${st.cls}`}>{st.label}</span>
                        <span className="text-[10px] text-slate-600 shrink-0 hidden sm:inline">{new Date(o.updatedAt).toLocaleString("sk-SK", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-slate-500 px-1">Sorted by each player's highest offer, leading bid highlighted. Blind bidding still applies to a co-commissioner: the commissioner's own bids never show here.</p>
    </div>
  );
}
