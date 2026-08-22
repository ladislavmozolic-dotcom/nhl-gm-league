"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFaSignLockAction } from "@/app/free-agents/actions";

/** Commissioner-only control to lock/unlock UFA signings. Ordinary GMs see only a
 *  small "locked" notice (and nothing when signings are open). */
export default function FaSignLockToggle({ locked, comish }: { locked: boolean; comish: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toggle = () => start(async () => { await setFaSignLockAction(!locked); router.refresh(); });

  if (!comish) {
    if (!locked) return null;
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
        🔒 UFA podpisy sú momentálne <b>zamknuté</b> komisárom.
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm ${locked ? "border-amber-500/40 bg-amber-500/10" : "border-emerald-500/40 bg-emerald-500/10"}`}>
      <span className={locked ? "text-amber-200" : "text-emerald-200"}>
        {locked ? "🔒 UFA podpisy sú ZAMKNUTÉ pre GM-ov." : "🔓 UFA podpisy sú ODOMKNUTÉ — GM-ovia môžu podpisovať."}
        <span className="text-slate-500 ml-1.5 text-xs">(túto lištu vidí len komisár)</span>
      </span>
      <button onClick={toggle} disabled={pending}
        className={`shrink-0 px-3.5 py-1.5 rounded-lg font-semibold text-white text-sm disabled:opacity-50 ${locked ? "bg-emerald-600 hover:bg-emerald-500" : "bg-amber-600 hover:bg-amber-500"}`}>
        {pending ? "…" : locked ? "🔓 Odblokovať podpisy" : "🔒 Zamknúť podpisy"}
      </button>
    </div>
  );
}
