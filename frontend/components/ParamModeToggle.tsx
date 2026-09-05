"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setParamModeAction } from "@/app/admin/simulation/actions";

type Mode = "sths" | "unhl" | "nextgen";

export default function ParamModeToggle({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const opts: { key: Mode; label: string; sub: string }[] = [
    { key: "unhl", label: "UNHL Parameters", sub: "The independently-tuned copy" },
    { key: "nextgen", label: "Next Gen Parameters", sub: "Computed fresh from real NHL performance" },
  ];

  const set = (c: Mode) => {
    const o = opts.find((x) => x.key === c)!;
    if (!confirm(`Switch the LIVE league to ${o.label}?\n\nThis overwrites every player's and goalie's ratings right now — what the simulation and every roster/player page show — for the whole league. It does not touch contracts, rosters, or anything else.`)) return;
    setMsg(null);
    start(async () => {
      const r = await setParamModeAction(c);
      if (r.ok) setMsg(`Done — ${r.skaters} skaters, ${r.goalies} goalies updated.${r.note ? ` ${r.note}` : ""}`);
      else setMsg(r.error);
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">📐</span>
        <div>
          <div className="text-sm font-semibold text-slate-100">Live parameter set</div>
          <div className="text-xs text-slate-500">Overwrites every player's ratings league-wide — what the sim and every page read. Switch whenever you decide; nothing runs on its own.</div>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {opts.map((o) => {
          const active = mode === o.key;
          return (
            <button key={o.key} onClick={() => set(o.key)} disabled={pending || active}
              className={`text-left rounded-xl border px-4 py-3 transition-colors ${active ? "border-blue-500 bg-blue-600/15" : "border-slate-800 bg-slate-900/40 hover:border-slate-600"} disabled:cursor-default`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${active ? "bg-blue-400" : "bg-slate-600"}`}></span>
                <span className="text-sm font-semibold text-slate-100">{o.label}</span>
                {active && <span className="ml-auto text-[10px] font-bold text-blue-300 uppercase tracking-wide">Live</span>}
              </div>
              <div className="text-xs text-slate-500 mt-1 pl-4.5">{o.sub}</div>
            </button>
          );
        })}
      </div>
      {pending && <p className="text-xs text-amber-300">Working — this touches every player, give it a moment…</p>}
      {msg && <p className="text-xs text-slate-300">{msg}</p>}
    </div>
  );
}
