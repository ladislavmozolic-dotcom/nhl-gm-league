"use client";

import { useState, useTransition } from "react";
import { toggleReaction } from "@/app/forum/actions";

const PALETTE = ["👍", "😂", "🔥", "🏒", "💯", "🤔", "👀", "❤️"];

type R = { emoji: string; count: number; mine: boolean };

export default function ForumReactions({ postId, initial, canReact }: { postId: number; initial: R[]; canReact: boolean }) {
  const [reacts, setReacts] = useState<R[]>(initial);
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

  const toggle = (emoji: string) => {
    if (!canReact) return;
    // optimistic
    setReacts((prev) => {
      const ex = prev.find((r) => r.emoji === emoji);
      if (ex) {
        const count = ex.count + (ex.mine ? -1 : 1);
        const mine = !ex.mine;
        const next = prev.map((r) => (r.emoji === emoji ? { ...r, count, mine } : r)).filter((r) => r.count > 0);
        return next;
      }
      return [...prev, { emoji, count: 1, mine: true }];
    });
    setOpen(false);
    start(async () => { try { await toggleReaction(postId, emoji); } catch { /* optimistic UI already applied — a stale-deploy failure here isn't worth surfacing */ } });
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
      {reacts.map((r) => (
        <button key={r.emoji} onClick={() => toggle(r.emoji)} disabled={!canReact}
          className={`px-1.5 py-0.5 rounded-full text-xs border ${r.mine ? "bg-blue-600/20 border-blue-500/50 text-blue-200" : "bg-slate-800/60 border-slate-700 text-slate-300"} ${canReact ? "hover:border-slate-500" : "cursor-default"}`}>
          {r.emoji} {r.count}
        </button>
      ))}
      {canReact && (
        <div className="relative">
          <button onClick={() => setOpen((o) => !o)} className="px-1.5 py-0.5 rounded-full text-xs bg-slate-800/60 border border-slate-700 text-slate-500 hover:text-slate-300">＋</button>
          {open && (
            <div className="absolute z-10 mt-1 bg-[#0e1e35] border border-slate-700 rounded-xl p-1.5 flex gap-1 shadow-xl">
              {PALETTE.map((e) => <button key={e} onClick={() => toggle(e)} className="text-lg hover:bg-slate-800 rounded p-0.5">{e}</button>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
