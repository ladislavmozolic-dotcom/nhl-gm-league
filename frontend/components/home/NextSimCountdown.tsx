"use client";

import { useEffect, useState } from "react";
import { nextSimUtcMs, frenzyRoundCloseUtcMs } from "@/lib/sim-clock";

const ZONES = [
  { id: "Europe/Bratislava", label: "Bratislava" },
  { id: "Europe/Prague", label: "Prague" },
  { id: "Europe/London", label: "London" },
  { id: "UTC", label: "UTC" },
  { id: "America/New_York", label: "New York" },
];

/** `frenzyAt` = a pending one-shot Free Agent Frenzy auto-open moment (ISO, real
 *  UTC instant) — when it's set and still in the future, the card counts down to
 *  THAT instead of the daily 20:30 sim trigger, and relabels itself accordingly.
 *  Once it fires (the moment passes — the cron clears it server-side within
 *  ~5 minutes, but the client also just stops treating a past instant as pending),
 *  the card reverts to the normal daily-sim countdown on its own.
 *
 *  `frenzyOpen`/`frenzyRound`/`frenzyDay` = the market is currently open — takes
 *  priority over the plain daily-sim countdown (but not over a still-pending
 *  `frenzyAt`) and counts down to when the CURRENT round closes instead. */
export default function NextSimCountdown({ frenzyAt, frenzyOpen, frenzyRound, frenzyDay, frenzyRoundStartedAt }: {
  frenzyAt?: string | null; frenzyOpen?: boolean; frenzyRound?: number; frenzyDay?: number; frenzyRoundStartedAt?: string | null;
}) {
  const [now, setNow] = useState<Date | null>(null);
  const [zone, setZone] = useState("Europe/Bratislava");
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  if (!now) return <div className="text-3xl font-black text-white tabular-nums">--:--:--</div>;
  const frenzyMs = frenzyAt ? new Date(frenzyAt).getTime() : null;
  const frenzyPending = frenzyMs != null && frenzyMs > now.getTime();
  const roundActive = !frenzyPending && frenzyOpen && frenzyRound != null && frenzyDay != null;
  const targetMs = frenzyPending ? frenzyMs! : roundActive ? frenzyRoundCloseUtcMs(now, frenzyRound!, frenzyDay!, frenzyRoundStartedAt) : nextSimUtcMs(now);
  const rem = Math.max(0, targetMs - now.getTime());
  const d = Math.floor(rem / 86_400_000);
  const h = Math.floor((rem % 86_400_000) / 3.6e6), m = Math.floor((rem % 3.6e6) / 6e4), s = Math.floor((rem % 6e4) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const targetLabel = new Date(targetMs).toLocaleString("en-GB", { timeZone: zone, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div>
      {frenzyPending && <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wide mb-1">Free Agent Frenzy open in</p>}
      {roundActive && <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wide mb-1">Frenzy Round {frenzyRound} closes in</p>}
      <p className="text-3xl font-black text-white tabular-nums leading-none">{d > 0 && `${d}d `}{pad(h)}:{pad(m)}:{pad(s)}</p>
      <div className="flex items-center justify-between gap-2 mt-2">
        <p className="text-xs text-slate-400">{frenzyPending ? "Opens" : roundActive ? "Closes" : "Sim"} at {targetLabel}</p>
        <select value={zone} onChange={(e) => setZone(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-slate-300">
          {ZONES.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
        </select>
      </div>
    </div>
  );
}
