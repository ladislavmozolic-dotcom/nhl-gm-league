"use client";

import { useEffect, useState } from "react";

const ZONES = [
  { id: "Europe/Bratislava", label: "Bratislava" },
  { id: "Europe/Prague", label: "Prague" },
  { id: "Europe/London", label: "London" },
  { id: "UTC", label: "UTC" },
  { id: "America/New_York", label: "New York" },
];

// The sim runs daily at 20:30:01 Bratislava time.
function nextSimUtcMs(now: Date): number {
  // wall-clock in Bratislava
  const brat = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Bratislava" }));
  const target = new Date(brat);
  target.setHours(20, 30, 1, 0);
  if (target.getTime() <= brat.getTime()) target.setDate(target.getDate() + 1);
  // difference is frame-independent
  return now.getTime() + (target.getTime() - brat.getTime());
}

/** `frenzyAt` = a pending one-shot Free Agent Frenzy auto-open moment (ISO, real
 *  UTC instant) — when it's set and still in the future, the card counts down to
 *  THAT instead of the daily 20:30 sim trigger, and relabels itself accordingly.
 *  Once it fires (the moment passes — the cron clears it server-side within
 *  ~5 minutes, but the client also just stops treating a past instant as pending),
 *  the card reverts to the normal daily-sim countdown on its own. */
export default function NextSimCountdown({ frenzyAt }: { frenzyAt?: string | null }) {
  const [now, setNow] = useState<Date | null>(null);
  const [zone, setZone] = useState("Europe/Bratislava");
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  if (!now) return <div className="text-3xl font-black text-white tabular-nums">--:--:--</div>;
  const frenzyMs = frenzyAt ? new Date(frenzyAt).getTime() : null;
  const frenzyPending = frenzyMs != null && frenzyMs > now.getTime();
  const targetMs = frenzyPending ? frenzyMs! : nextSimUtcMs(now);
  const rem = Math.max(0, targetMs - now.getTime());
  const h = Math.floor(rem / 3.6e6), m = Math.floor((rem % 3.6e6) / 6e4), s = Math.floor((rem % 6e4) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const targetLabel = new Date(targetMs).toLocaleString("en-GB", { timeZone: zone, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div>
      {frenzyPending && <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wide mb-1">Free Agent Frenzy open in</p>}
      <p className="text-3xl font-black text-white tabular-nums leading-none">{pad(h)}:{pad(m)}:{pad(s)}</p>
      <div className="flex items-center justify-between gap-2 mt-2">
        <p className="text-xs text-slate-400">{frenzyPending ? "Opens" : "Sim"} at {targetLabel}</p>
        <select value={zone} onChange={(e) => setZone(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-slate-300">
          {ZONES.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
        </select>
      </div>
    </div>
  );
}
