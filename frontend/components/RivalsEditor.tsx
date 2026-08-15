"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { saveRivals } from "@/app/teams/[slug]/rivals/actions";

type T = { id: number; name: string; code: string | null; logoUrl: string | null; division: string | null };

export default function RivalsEditor({ teamId, teams, initial }: { teamId: number; teams: T[]; initial: number[] }) {
  const [sel, setSel] = useState<Set<number>>(new Set(initial));
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const toggle = (id: number) => {
    setSaved(false);
    setSel((cur) => { const n = new Set(cur); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const save = () => start(async () => { await saveRivals(teamId, [...sel]); setSaved(true); });

  const byDiv = new Map<string, T[]>();
  for (const t of teams) { const d = t.division ?? "Other"; if (!byDiv.has(d)) byDiv.set(d, []); byDiv.get(d)!.push(t); }

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-400">
        Pick your rivals. Games against a rival run hot — far more fights, net-front scrums, misconducts and
        chippy penalties. Rivalries are mutual, so the other club feels it too.
      </p>

      {[...byDiv.entries()].map(([div, ts]) => (
        <div key={div}>
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">{div}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ts.map((t) => {
              const on = sel.has(t.id);
              return (
                <button key={t.id} onClick={() => toggle(t.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${on
                    ? "bg-red-600/20 border-red-500/50 text-white"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600"}`}>
                  {t.logoUrl && <Image src={t.logoUrl} alt="" width={22} height={22} className="object-contain shrink-0" />}
                  <span className="text-sm truncate">{t.name}</span>
                  {on && <span className="ml-auto text-red-400 text-xs">🔥</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="sticky bottom-0 bg-slate-950/90 border-t border-slate-800 backdrop-blur py-3 flex items-center gap-3">
        <button onClick={save} disabled={pending}
          className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 font-semibold text-sm disabled:opacity-50">
          {pending ? "Saving…" : `Save rivals (${sel.size})`}
        </button>
        {saved && <span className="text-green-400 text-sm">✓ Saved</span>}
      </div>
    </div>
  );
}
