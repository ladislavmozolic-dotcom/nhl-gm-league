"use client";

import { useEffect, useRef, useState } from "react";

/** Poll a JSON endpoint on an interval; keeps the last good value and a small clock-skew offset against the server. */
export function usePoll<T>(url: string | null, everyMs: number): { data: T | null; error: boolean; skewMs: number } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [skewMs, setSkew] = useState(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    if (!url) return;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      try {
        const t0 = Date.now();
        const r = await fetch(url, { cache: "no-store" });
        const j = await r.json();
        if (!alive.current) return;
        if (typeof j?.now === "number") setSkew(j.now - (t0 + Date.now()) / 2);
        setData(j as T); setError(!r.ok && r.status !== 404);
      } catch { if (alive.current) setError(true); }
      if (alive.current) timer = setTimeout(run, everyMs);
    };
    run();
    return () => { alive.current = false; clearTimeout(timer); };
  }, [url, everyMs]);
  return { data, error, skewMs };
}

/** Wall-clock "now" aligned to the server, re-rendered a couple of times a second (for countdowns). */
export function useServerNow(skewMs: number, everyMs = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now + skewMs;
}
