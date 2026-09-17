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
      {frenzyPending && <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wide mb-1">Free Agent Frenzy open in</p>}
      {roundActive && <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wide mb-1">Frenzy Round {frenzyRound} · {frenzyStage === "IMPROVEMENT" ? "decision in" : "offers close in"}</p>}
      {!frenzyPending && !roundActive && <p className="text-[11px] font-semibold text-blue-400 uppercase tracking-wide mb-1">Next Game Sim</p>}
      <p className="text-3xl font-black text-slate-100 tabular-nums leading-none">{d > 0 && `${d}d `}{pad(h)}:{pad(m)}:{pad(s)}</p>
      <div className="flex items-center justify-between gap-2 mt-2">
        <p className="text-xs text-slate-400">{frenzyPending ? "Opens" : roundActive ? "Closes" : "Sim"} at {targetLabel}</p>
        <select value={zone} onChange={(e) => { setZone(e.target.value); window.localStorage.setItem(ZONE_KEY, e.target.value); }}
          className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-slate-300">
          {ZONES.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
        </select>
      </div>
    </div>
  );
}
