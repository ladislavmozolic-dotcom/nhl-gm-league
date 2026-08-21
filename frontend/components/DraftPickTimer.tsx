"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { autoPickIfExpiringAction, processDraftClockAction } from "@/app/draft/room/actions";

const AUTO_LEAD_MS = 10_000; // auto-pick fires in the final 10 seconds

/** Live countdown to a pick deadline (real wall-clock). Ticks every second. In the
 *  final 10s it asks the server to auto-draft the on-clock club's top queued player
 *  (GM's Draft Rankings); at zero it falls back to advancing/deferring the clock. */
export default function DraftPickTimer({ deadline }: { deadline: string }) {
  const [now, setNow] = useState<number | null>(null);
  const router = useRouter();
  const autoRef = useRef(false);
  const expiredRef = useRef(false);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // a new pick (new deadline) re-arms both one-shot guards
  useEffect(() => { autoRef.current = false; expiredRef.current = false; }, [deadline]);

  const target = new Date(deadline).getTime();
  const rem = now == null ? null : Math.max(0, target - now);
  const expired = rem != null && rem <= 0;
  const arming = rem != null && rem > 0 && rem <= AUTO_LEAD_MS;

  useEffect(() => {
    if (rem == null) return;
    if (rem <= AUTO_LEAD_MS && !autoRef.current) {
      autoRef.current = true;
      autoPickIfExpiringAction().then((r) => { if (r?.acted) router.refresh(); });
    }
    if (expired && !expiredRef.current) {
      expiredRef.current = true;
      // backstop: if auto-pick couldn't act (e.g. clock skew), advance/defer the clock
      processDraftClockAction().then((r) => { if (r?.advanced) router.refresh(); });
    }
  }, [rem, expired, router]);

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
      {expired ? <div className="text-[10px] text-red-400 mt-0.5">time expired</div>
        : arming ? <div className="text-[10px] text-amber-400 mt-0.5">auto-pick imminent…</div> : null}
    </div>
  );
}
