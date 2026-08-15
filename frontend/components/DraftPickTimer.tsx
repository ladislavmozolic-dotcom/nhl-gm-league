"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { processDraftClockAction } from "@/app/draft/room/actions";

/** Live countdown to a pick deadline (real wall-clock). Ticks every second, and
 *  when it hits zero it asks the server to advance the clock (defer the miss). */
export default function DraftPickTimer({ deadline }: { deadline: string }) {
  const [now, setNow] = useState<number | null>(null);
  const router = useRouter();
  const firedRef = useRef(false);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const target = new Date(deadline).getTime();
  const rem = now == null ? null : Math.max(0, target - now);
  const expired = rem != null && rem <= 0;

  useEffect(() => {
    if (expired && !firedRef.current) {
      firedRef.current = true;
      processDraftClockAction().then((r) => { if (r?.advanced) router.refresh(); });
    }
  }, [expired, router]);
  const urgent = rem != null && rem > 0 && rem <= 120_000; // < 2 min

  const label = (() => {
    if (rem == null) return "--:--";
    const m = Math.floor(rem / 60000), s = Math.floor((rem % 60000) / 1000);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  })();

  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-widest text-amber-400/70">Time left</div>
      <div className={`text-2xl font-black tabular-nums leading-none ${expired ? "text-red-500" : urgent ? "text-red-400 animate-pulse" : "text-white"}`}>
        {expired ? "0:00" : label}
      </div>
      {expired && <div className="text-[10px] text-red-400 mt-0.5">time expired</div>}
    </div>
  );
}
