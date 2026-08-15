"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

interface Game {
  id: number;
  homeTeam: { name: string; code: string | null };
  awayTeam: { name: string; code: string | null };
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  period: string | null;
  timeRemaining: string | null;
  date: string;
}

export default function GameTicker() {
  const [games, setGames] = useState<Game[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/games/today")
      .then((r) => r.json())
      .then(setGames);
  }, []);

  useEffect(() => {
    if (isPaused || !scrollRef.current || games.length === 0) return;
    const el = scrollRef.current;
    let pos = 0;
    const animate = () => {
      pos += 0.5;
      if (pos >= el.scrollWidth / 2) pos = 0;
      el.scrollLeft = pos;
      requestAnimationFrame(animate);
    };
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, [isPaused, games]);

  if (games.length === 0) return null;

  const displayGames = [...games, ...games];

  return (
    <div
      className="bg-[#0a1628] border-b border-slate-700/50 overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        ref={scrollRef}
        className="flex items-center gap-6 px-4 py-2 whitespace-nowrap overflow-x-hidden"
      >
        {displayGames.map((game, i) => (
          <Link
            key={`${game.id}-${i}`}
            href={`/games/${game.id}`}
            className="flex items-center gap-3 text-sm hover:bg-slate-800/50 px-3 py-1 rounded transition-colors"
          >
            <span className="text-slate-300 font-medium">
              {game.awayTeam.code}
            </span>
            <span className="text-white font-bold">
              {game.awayScore ?? "-"}
            </span>
            <span className="text-slate-500">@</span>
            <span className="text-white font-bold">
              {game.homeScore ?? "-"}
            </span>
            <span className="text-slate-300 font-medium">
              {game.homeTeam.code}
            </span>
            {game.status === "live" && (
              <span className="text-red-400 text-xs font-bold animate-pulse">
                LIVE {game.period} {game.timeRemaining}
              </span>
            )}
            {game.status === "finished" && (
              <span className="text-slate-400 text-xs">FINAL</span>
            )}
            {game.status === "scheduled" && (
              <span className="text-slate-400 text-xs">
                {new Date(game.date).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}