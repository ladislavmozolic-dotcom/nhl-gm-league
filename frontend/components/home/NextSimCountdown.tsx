"use client";

import { useEffect, useState } from "react";
import { nextSimUtcMs, simUtcMsForDate, frenzyRoundCloseUtcMs } from "@/lib/sim-clock";

const ZONES = [
  { id: "Europe/Bratislava", label: "Bratislava" },
  { id: "Europe/Prague", label: "Prague" },
  { id: "Europe/London", label: "London" },
  { id: "UTC", label: "UTC" },
  { id: "America/New_York", label: "New York" },
];
const ZONE_KEY = "unhl-time-zone";

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
export default function NextSimCountdown({ frenzyAt, frenzyOpen, frenzyRound, frenzyDay, frenzyRoundStartedAt, frenzyStage = "BIDDING", nextGameDate }: {
  frenzyAt?: string | null; frenzyOpen?: boolean; frenzyRound?: number; frenzyDay?: number; frenzyRoundStartedAt?: string | null;
  frenzyStage?: "BIDDING" | "IMPROVEMENT" | "CONTINUOUS"; nextGameDate?: string | null;
}) {
  const [now, setNow] = useState<Date | null>(null);
  const [zone, setZone] = useState("Europe/Bratislava");
  useEffect(() => {
    setNow(new Date());
    const stored = window.localStorage.getItem(ZONE_KEY);
    if (stored && ZONES.some((z) => z.id === stored)) setZone(stored);
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!now) return <div className="text-3xl font-black text-slate-100 tabular-nums">--:--:--</div>;
  const frenzyMs = frenzyAt ? new Date(frenzyAt).getTime() : null;
  const frenzyPending = frenzyMs != null && frenzyMs > now.getTime();
  const roundOpen = !frenzyPending && frenzyOpen && frenzyRound != null && frenzyDay != null;
  const roundCloseMs = roundOpen ? frenzyRoundCloseUtcMs(now, frenzyRound!, frenzyDay!, frenzyRoundStartedAt, frenzyStage === "IMPROVEMENT" ? "IMPROVEMENT" : "BIDDING") : null;
  // The daily trigger fires every real day even when nothing's scheduled (a no-op
  // that night) — anchor "next game sim" to the next SCHEDULED game's own date
  // when we know it, so an off day doesn't get mislabeled as tonight's sim.
  const simMs = nextGameDate ? simUtcMsForDate(nextGameDate) : nextSimUtcMs(now);
  // A round's own deadline can be days out while the next game sim (tomorrow
  // night, say) is much sooner — show whichever is actually coming up next.
  const roundActive = roundOpen && roundCloseMs! <= simMs;
  const targetMs = frenzyPending ? frenzyMs! : roundActive ? roundCloseMs! : simMs;
  const rem = Math.max(0, targetMs - now.getTime());
  const d = Math.floor(rem / 86_400_000);
  const h = Math.floor((rem % 86_400_000) / 3.6e6), m = Math.floor((rem % 3.6e6) / 6e4), s = Math.floor((rem % 6e4) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const targetLabel = new Date(targetMs).toLocaleString("en-GB", { timeZone: zone, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        {frenzyPending ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Frenzy Open in
          </span>
        ) : roundActive ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            R{frenzyRound} · {frenzyStage === "IMPROVEMENT" ? "Decision in" : "Deadline"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            Next Game Sim
          </span>
        )}
        <select
          value={zone}
          onChange={(e) => { setZone(e.target.value); window.localStorage.setItem(ZONE_KEY, e.target.value); }}
          className="bg-slate-900 border border-slate-700/70 hover:border-slate-600 rounded-md px-1.5 py-0.5 text-[10px] text-slate-300 font-medium cursor-pointer transition-colors focus:outline-none"
        >
          {ZONES.map((z) => <option key={z.id} value={z.id} className="bg-slate-900 text-slate-200">{z.label}</option>)}
        </select>
      </div>

      <div className="flex items-baseline gap-1 my-1">
        <p className="text-3xl font-black font-mono text-white tracking-tight tabular-nums">
          {d > 0 && <span className="text-xl text-slate-300 font-bold mr-1.5">{d}d</span>}
          {pad(h)}<span className="text-sky-400/70 animate-pulse">:</span>{pad(m)}<span className="text-sky-400/70 animate-pulse">:</span>{pad(s)}
        </p>
      </div>

      <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5 mt-1">
        <span>⏰</span>
        <span>{frenzyPending ? "Opens" : roundActive ? "Deadline" : "Simulation"} at <strong className="text-slate-200 font-semibold">{targetLabel}</strong></span>
      </p>
    </div>
  );
}
