"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { makePickAction } from "@/app/draft/room/actions";

export type QueueItem = { prospectId: number; rank: number; name: string; position: string; flag: string; tier: string | null; note: string | null };

const posColor: Record<string, string> = { C: "text-sky-400", LW: "text-emerald-400", RW: "text-emerald-400", D: "text-amber-400", G: "text-rose-400" };

/** The signed-in GM's own draft queue (available players only), shown in the room for
 *  quick picking. Top of this list is what the auto-pick takes if the clock runs out. */
export default function DraftQueuePanel({ queue, canPick }: { queue: QueueItem[]; canPick: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const pick = (id: number, name: string) => start(async () => {
    setMsg(null);
    const r = await makePickAction(id);
    setMsg(r.ok ? `✓ Drafted ${name}` : (r.error ?? "Failed."));
  });

  return (
    <div className="rounded-xl border border-blue-800/40 bg-blue-950/15">
      <div className="flex items-center justify-between px-3 py-2 border-b border-blue-800/30">
        <span className="text-sm font-bold text-blue-200">🎯 My Draft Queue</span>
        <Link href="/draft/rankings" className="text-[11px] text-slate-400 hover:text-blue-300">edit →</Link>
      </div>
      {msg && <div className={`mx-3 mt-2 text-xs px-2 py-1.5 rounded ${msg.startsWith("✓") ? "bg-emerald-950/40 text-emerald-300" : "bg-red-950/40 text-red-300"}`}>{msg}</div>}
      {queue.length === 0 ? (
        <p className="px-3 py-4 text-xs text-slate-500">No queued players available. Build your list in <Link href="/draft/rankings" className="text-blue-400 hover:underline">Draft Rankings</Link> — the top available player is auto-picked if your clock runs out.</p>
      ) : (
        <div className="divide-y divide-blue-900/30 max-h-[260px] overflow-y-auto">
          {queue.map((it, i) => (
            <div key={it.prospectId} className="flex items-center gap-2 px-3 py-1.5">
              <span className="w-5 text-center text-xs font-black text-blue-400 tabular-nums">{i + 1}</span>
              <span>{it.flag}</span>
              <span className="text-sm text-slate-100 truncate" title={it.note ?? undefined}>{it.name}</span>
              <span className={`text-xs font-semibold ${posColor[it.position] ?? "text-slate-400"}`}>{it.position}</span>
              {it.tier && <span className="text-[10px] font-bold px-1 rounded bg-amber-500/15 text-amber-300">{it.tier}</span>}
              {canPick && <button onClick={() => pick(it.prospectId, it.name)} disabled={pending} className="ml-auto px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold">Pick</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
