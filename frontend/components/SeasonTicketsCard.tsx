import { Card } from "@/components/ui";
import InfoTip from "@/components/InfoTip";
import type { TeamSeasonTickets } from "@/lib/season-tickets-server";

const N = (n: number) => n.toLocaleString("en-US");

/** A club's preseason season-ticket campaign — sold vs cap, change on last season,
 *  renewal rate, new holders, waiting list, and the factors behind it. */
export default function SeasonTicketsCard({ st }: { st: TeamSeasonTickets }) {
  const pct = Math.round((st.sold / st.sthCap) * 100);
  const up = st.changePct >= 0;
  return (
    <Card title="Season Tickets" accent="text-emerald-300">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black tabular-nums">{N(st.sold)}</span>
            <span className="text-slate-500">/ {N(st.sthCap)} sold</span>
            <InfoTip text="Season tickets sold in the preseason campaign, out of the club's season-ticket cap (a share of arena capacity). Driven by Fan Interest, last season's result, star moves and pricing." />
          </div>
          <div className="mt-1 h-2 w-48 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-emerald-500/70" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-[12px] text-slate-500">
            Previous: {N(st.prevSold)} · <span className={up ? "text-emerald-400" : "text-rose-400"}>{up ? "+" : ""}{st.changePct.toFixed(1)}%</span>
          </div>
        </div>
        <div className="text-sm text-right">
          <div className="text-slate-400">Renewal rate <span className="font-bold text-slate-200">{Math.round(st.renewalRate * 100)}%</span></div>
          <div className="text-[12px] text-slate-500">Renewed {N(st.renewed)} of {N(st.prevHolders)}</div>
          <div className="text-[12px] text-slate-500">New holders {N(st.newHolders)}</div>
          {st.waitingList > 0 && <div className="mt-1 text-[12px] text-amber-300">Waiting list: {N(st.waitingList)}</div>}
        </div>
      </div>

      {(st.positives.length > 0 || st.negatives.length > 0) && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {st.positives.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-emerald-400/80 mb-1">Positive factors</div>
              <ul className="text-[13px] text-slate-300 space-y-0.5">{st.positives.map((r, i) => <li key={i}>+ {r}</li>)}</ul>
            </div>
          )}
          {st.negatives.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-rose-400/80 mb-1">Negative factors</div>
              <ul className="text-[13px] text-slate-300 space-y-0.5">{st.negatives.map((r, i) => <li key={i}>− {r}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
