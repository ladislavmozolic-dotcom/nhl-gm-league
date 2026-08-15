"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { verifyOffBoardPickAction } from "@/app/draft/room/actions";

export type OffBoardPick = { id: number; pick: number; name: string; position: string; birthDate: string | null; epLink: string | null; teamCode: string; verified: boolean };

export default function OffBoardVerifyPanel({ picks }: { picks: OffBoardPick[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const verify = (id: number) => start(async () => { await verifyOffBoardPickAction(id); router.refresh(); });
  if (picks.length === 0) return null;
  const pendingCount = picks.filter((p) => !p.verified).length;

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 overflow-hidden">
      <div className="px-3 py-2 border-b border-amber-500/20 text-sm font-semibold text-amber-200">
        Off-board picks · verify eligibility {pendingCount > 0 && <span className="ml-1 text-xs text-amber-400">({pendingCount} pending)</span>}
      </div>
      <div className="divide-y divide-slate-800/70">
        {picks.map((p) => (
          <div key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className="w-8 text-right text-xs text-slate-500 tabular-nums">#{p.pick}</span>
            <span className="font-medium text-slate-100">{p.name}</span>
            <span className="text-xs text-slate-500">{p.position} · {p.teamCode}{p.birthDate ? ` · b. ${p.birthDate}` : ""}</span>
            {p.epLink && <a href={p.epLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 underline">EP ↗</a>}
            <div className="ml-auto">
              {p.verified ? (
                <span className="text-xs text-emerald-400 font-medium">✓ verified</span>
              ) : (
                <button onClick={() => verify(p.id)} disabled={pending} className="text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-2.5 py-1 font-medium">Verify</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
