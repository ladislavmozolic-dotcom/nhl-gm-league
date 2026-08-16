"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { chooseSponsorAction, type TeamSponsor } from "@/lib/sponsorship-server";
import { sponsorMax } from "@/lib/sponsorship";

const M = (n: number) => `$${(n / 1e6).toFixed(1)}M`;

export default function SponsorPicker({ sponsor }: { sponsor: TeamSponsor }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const activeAav = sponsor.deal?.aav ?? null;

  const choose = (i: number) => start(async () => {
    setMsg(null);
    const r = await chooseSponsorAction(sponsor.teamId, i);
    if (!r.ok) { setMsg(r.error ?? "Failed."); return; }
    router.refresh();
  });

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {sponsor.offers.map((o, i) => {
          const active = activeAav != null && o.aav === activeAav && o.years === sponsor.deal?.years;
          return (
            <div key={i} className={`rounded-lg border p-3 ${active ? "border-emerald-500/60 bg-emerald-500/10" : "border-slate-700 bg-slate-800/40"}`}>
              <div className="text-sm font-bold">{o.label}</div>
              <div className="mt-1 text-2xl font-black tabular-nums">{M(o.aav)}<span className="text-sm font-normal text-slate-500">/yr</span></div>
              <div className="text-[12px] text-slate-500">{o.years} {o.years === 1 ? "year" : "years"}</div>
              <ul className="mt-2 text-[12px] text-slate-300 space-y-0.5 min-h-[42px]">
                {o.bonuses.length === 0 ? <li className="text-slate-500">No bonuses</li> : o.bonuses.map((b, j) => <li key={j}>+ {M(b.amount)} — {b.when}</li>)}
              </ul>
              <div className="text-[11px] text-slate-500 mt-1">Max value {M(sponsorMax(o))}</div>
              <button onClick={() => choose(i)} disabled={pending || active}
                className={`mt-2 w-full py-1.5 rounded-lg text-sm font-semibold disabled:opacity-60 ${active ? "bg-emerald-700/40 text-emerald-300" : "bg-blue-600 hover:bg-blue-500 text-white"}`}>
                {active ? "✓ Signed" : "Sign"}
              </button>
            </div>
          );
        })}
      </div>
      {msg && <div className="mt-2 text-xs text-rose-300">{msg}</div>}
    </div>
  );
}
