"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { togglePinThread } from "@/app/forum/actions";

export default function ForumPinToggle({
  threadId,
  isPinned,
}: {
  threadId: number;
  isPinned: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const handleToggle = () => {
    start(async () => {
      await togglePinThread(threadId);
      router.refresh();
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      title={isPinned ? "Odopnúť vlákno z vrchu fóra" : "Pripnúť vlákno na vrch fóra"}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
        isPinned
          ? "bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
          : "bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-700 hover:text-white"
      }`}
    >
      <span>{isPinned ? "📌 Pripnuté" : "📍 Pripnúť"}</span>
      {pending && <span className="animate-spin text-[10px]">⏳</span>}
    </button>
  );
}
