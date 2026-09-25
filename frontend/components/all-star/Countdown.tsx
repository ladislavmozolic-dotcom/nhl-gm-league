"use client";

import { useEffect, useState } from "react";

/** Live d/h/m/s countdown to `to` (ISO). Renders nothing until mounted (wall-clock). */
export default function Countdown({ to, done = "now" }: { to: string; done?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (now == null) return null;
  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return <span>{done}</span>;
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return <span className="tabular-nums">{d > 0 ? `${d}d ` : ""}{p(h)}:{p(m)}:{p(sec)}</span>;
}
