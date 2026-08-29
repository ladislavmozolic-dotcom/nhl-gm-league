"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSimEngineAction } from "@/app/admin/simulation/actions";

export default function SimEngineToggle({ engine }: { engine: "current" | "nextgen" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (c: "current" | "nextgen") => start(async () => { await setSimEngineAction(c); router.refresh(); });

  const opts: { key: "current" | "nextgen"; label: string; sub: string }[] = [
    { key: "current", label: "Current (v1)", sub: "Stable, calibrated engine" },
    { key: "nextgen", label: "Next-Gen (v2)", sub: "Same sim math — richer play-by-play (real hits/blocks/takeaways)" },
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">🧪</span>
        <div>
          <div className="text-sm font-semibold text-slate-100">League sim engine</div>
          <div className="text-xs text-slate-500">Switches the whole league. Reversible at any time — flipping back restores exact current behaviour.</div>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {opts.map((o) => {
          const active = engine === o.key;
          return (
            <button key={o.key} onClick={() => set(o.key)} disabled={pending || active}
              className={`text-left rounded-xl border px-4 py-3 transition-colors ${active ? "border-blue-500 bg-blue-600/15" : "border-slate-800 bg-slate-900/40 hover:border-slate-600"} disabled:cursor-default`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${active ? "bg-blue-400" : "bg-slate-600"}`}></span>
                <span className="text-sm font-semibold text-slate-100">{o.label}</span>
                {active && <span className="ml-auto text-[10px] font-bold text-blue-300 uppercase tracking-wide">Active</span>}
              </div>
              <div className="text-xs text-slate-500 mt-1 pl-4.5">{o.sub}</div>
            </button>
          );
        })}
      </div>
      {engine === "nextgen" && (
        <div className="text-xs text-sky-400/90">Next-gen is active: identical results (same seed → same score, same box score) — only the play-by-play narrates real hits, blocks and takeaways instead of flavour text. More next-gen upgrades land here over time.</div>
      )}
    </div>
  );
}
