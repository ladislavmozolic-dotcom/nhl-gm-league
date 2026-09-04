"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setParamModeAction } from "@/app/admin/simulation/actions";

export default function ParamModeToggle({ mode }: { mode: "sths" | "edge" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (c: "sths" | "edge") => start(async () => { await setParamModeAction(c); router.refresh(); });

  const opts: { key: "sths" | "edge"; label: string; sub: string }[] = [
    { key: "sths", label: "Parameters", sub: "Classic stats → ratings calculator" },
    { key: "edge", label: "Next Gen Parameters", sub: "Tracking-data (Next Gen) calculator" },
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">📐</span>
        <div>
          <div className="text-sm font-semibold text-slate-100">Active parameter system</div>
          <div className="text-xs text-slate-500">Only the active calculator appears under <span className="text-slate-300">Tools</span>. Switch any time.</div>
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
                {active && <span className="ml-auto text-[10px] font-bold text-blue-300 uppercase tracking-wide">Active</span>}
              </div>
              <div className="text-xs text-slate-500 mt-1 pl-4.5">{o.sub}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
