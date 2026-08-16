"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTicketPricingAction } from "@/lib/attendance-server";
import InfoTip from "@/components/InfoTip";
import type { TeamAttendance } from "@/lib/attendance-server";
import type { TicketPricing } from "@/lib/attendance";

const TIERS: TicketPricing[] = ["LOW", "STANDARD", "PREMIUM"];

/** GM control to set the club's ticket pricing, with a live attendance/revenue
 *  projection for each tier. */
export default function PricingControl({ att }: { att: TeamAttendance }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pricing, setPricing] = useState<TicketPricing>(att.pricing);
  const [msg, setMsg] = useState<string | null>(null);

  const set = (tier: TicketPricing) => start(async () => {
    setMsg(null);
    const r = await setTicketPricingAction(att.teamId, tier);
    if (!r.ok) { setMsg(r.error ?? "Failed."); return; }
    setPricing(tier);
    router.refresh();
  });

  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Ticket pricing
        <InfoTip text="Higher pricing earns more per seat but softens demand; lower pricing fills the building but earns less per head. The outcome depends on how hot the club is — a contender can charge Premium and still sell out. Price sensitivity below shows how much a hike would cost you." />
      </div>
      <div className="flex gap-1">
        {TIERS.map((t) => {
          const proj = att.projection.find((p) => p.pricing === t)!;
          const active = pricing === t;
          return (
            <button key={t} onClick={() => set(t)} disabled={pending}
              className={`flex-1 py-2 px-2 rounded-lg text-sm font-semibold border disabled:opacity-50 ${active ? "bg-blue-600 text-white border-blue-500" : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"}`}>
              <div>{proj.label}</div>
              <div className="text-[11px] font-normal opacity-80 mt-0.5">{Math.round(proj.pct * 100)}% · {proj.revenue} rev</div>
            </button>
          );
        })}
      </div>
      <div className="mt-2 text-[12px] text-slate-400">Fan price sensitivity: <b className={att.sensitivity === "High" ? "text-rose-300" : att.sensitivity === "Low" ? "text-emerald-300" : "text-amber-300"}>{att.sensitivity}</b></div>
      {msg && <div className="mt-1 text-xs text-rose-300">{msg}</div>}
    </div>
  );
}
