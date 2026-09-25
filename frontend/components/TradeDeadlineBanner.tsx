"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { deadlineFeedAction, type DeadlineFeed } from "@/app/actions/trade-deadline-feed";

const COUNTDOWN_DAYS = 14;
const FREEZE_NOTICE_HOURS = 48;

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const pad = (n: number) => String(n).padStart(2, "0");
const time = (iso: string) => new Date(iso).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bratislava" });

/** Site-wide trade-deadline strip: countdown in the final 14 days, a red 🚨 live
 *  breaking-trades ticker on deadline day (polls every 30 s), then a short
 *  "trade freeze" notice. Renders nothing when no deadline is set. */
export default function TradeDeadlineBanner({ initial, variant = "strip" }: { initial: DeadlineFeed; variant?: "strip" | "feed" }) {
  const [feed, setFeed] = useState(initial);
  // null until mounted — the countdown is wall-clock, so rendering it on the
  // server would always mismatch on hydration
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!feed.isDeadlineDay) return;
    const t = setInterval(() => { deadlineFeedAction().then(setFeed).catch(() => {}); }, 30_000);
    return () => clearInterval(t);
  }, [feed.isDeadlineDay]);

  if (!feed.deadline || now == null) return null;
  const dl = new Date(feed.deadline).getTime();
  const left = dl - now;
  const p = parts(left);

  if (variant === "feed") {
    if (!feed.isDeadlineDay) return null;
    return (
      <section className="rounded-xl border border-red-800/60 bg-red-950/30 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-red-900/50">
          <span className="font-black tracking-wide text-red-300">🚨 DEADLINE DAY LIVE</span>
          <span className="text-xs text-red-200/80 tabular-nums">{left > 0 ? `closes in ${pad(p.h)}:${pad(p.m)}:${pad(p.s)}` : "deadline passed — trade freeze"}</span>
        </div>
        <div className="divide-y divide-red-900/30">
          {feed.trades.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">No deals yet today — the phones are ringing…</p>}
          {feed.trades.map((t, i) => (
            <div key={t.id} className="flex gap-3 px-4 py-2.5 text-sm">
              <span className="text-xs text-red-300/80 tabular-nums pt-0.5 w-11 shrink-0">{time(t.at)}</span>
              <span className={i === 0 ? "text-white font-semibold" : "text-slate-200"}>{t.message}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (left > 0 && feed.isDeadlineDay) {
    return (
      <div className="bg-red-700 text-white text-sm overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-4 py-1.5 flex items-center gap-3">
          <span className="font-black whitespace-nowrap animate-pulse">🚨 TRADE DEADLINE DAY</span>
          <span className="tabular-nums whitespace-nowrap font-bold">{pad(p.h)}:{pad(p.m)}:{pad(p.s)}</span>
          <div className="flex-1 min-w-0 overflow-hidden">
            {feed.trades.length ? (
              <div className="whitespace-nowrap truncate"><span className="font-bold mr-2">BREAKING:</span>{feed.trades.map((t) => `${time(t.at)} ${t.message}`).join("   •   ")}</div>
            ) : <span className="text-red-100/80">No deals yet — every trade lands here live.</span>}
          </div>
          <Link href="/trades" className="whitespace-nowrap underline text-xs">Trade Tracker →</Link>
        </div>
      </div>
    );
  }
  if (left > 0 && left <= COUNTDOWN_DAYS * 86400000) {
    return (
      <div className="bg-amber-900/60 border-b border-amber-700/50 text-amber-100 text-sm">
        <div className="max-w-[1400px] mx-auto px-4 py-1.5 flex items-center gap-3">
          <span className="font-bold whitespace-nowrap">⏰ Trade deadline in</span>
          <span className="tabular-nums font-bold">{p.d > 0 ? `${p.d} d ` : ""}{pad(p.h)}:{pad(p.m)}:{pad(p.s)}</span>
          <span className="text-amber-200/70 text-xs hidden sm:inline">{new Date(dl).toLocaleString("sk-SK", { timeZone: "Europe/Bratislava", dateStyle: "medium", timeStyle: "short" })}</span>
          <Link href="/trades/build" className="ml-auto whitespace-nowrap underline text-xs">Trade Room →</Link>
        </div>
      </div>
    );
  }
  if (left <= 0 && -left <= FREEZE_NOTICE_HOURS * 3600000) {
    return (
      <div className="bg-slate-800 border-b border-slate-700 text-slate-200 text-sm">
        <div className="max-w-[1400px] mx-auto px-4 py-1.5 flex items-center gap-3">
          <span className="font-bold">🔒 Trade deadline passed</span>
          <span className="text-slate-400 text-xs">Trading reopens once a club&apos;s season is over (NHL rule).{feed.trades.length ? ` ${feed.trades.length} deal(s) made on deadline day.` : ""}</span>
        </div>
      </div>
    );
  }
  return null;
}
