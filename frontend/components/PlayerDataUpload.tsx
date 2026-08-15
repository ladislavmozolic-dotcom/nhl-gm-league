"use client";

import { useState, useTransition } from "react";
import { refreshPlayerStatsAction, refreshFromHockeyReferenceAction, refreshCurrentSeasonNhlAction } from "@/app/tools/player-data/actions";

type Res = Awaited<ReturnType<typeof refreshPlayerStatsAction>>;

export default function PlayerDataUpload() {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<Res | null>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => setRes(await refreshPlayerStatsAction(fd)));
  };
  const live = (which: "last" | "current" = "last") => start(async () =>
    setRes(which === "current" ? await refreshCurrentSeasonNhlAction() : await refreshFromHockeyReferenceAction("last")));

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
        <p className="text-sm text-slate-300 mb-2">Pull the whole league&apos;s stats <b>live</b> from hockey-reference (one request — no file).</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => live("last")} disabled={pending}
            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-sm font-semibold">
            {pending ? "Refreshing…" : "⟳ Last season (2025-26)"}
          </button>
          <button onClick={() => live("current")} disabled={pending}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-sm font-semibold"
            title="NHL.com API — goals/assists/+-/hits/blocks/TK/GV/SH-TOI. Powers the Player Calculator projection once the 2026-27 season starts.">
            {pending ? "…" : "⟳ Current season (NHL.com)"}
          </button>
        </div>
      </div>
      <div className="text-xs text-slate-500 text-center">— or upload the calculator workbook —</div>
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="file" name="file" accept=".xlsx" required
        className="block text-sm text-slate-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:text-sm file:font-semibold hover:file:bg-blue-500" />
      <button type="submit" disabled={pending}
        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-semibold">
        {pending ? "Importing…" : "Import last-season stats"}
      </button>
      {res && (
        res.ok ? (
          <div className="text-sm text-green-300">
            ✓ Matched <b>{res.matched}</b> / {res.total} players.
            {res.unmatchedCount > 0 && (
              <details className="mt-1 text-slate-400">
                <summary className="cursor-pointer text-amber-300/80">{res.unmatchedCount} unmatched (name mismatch)</summary>
                <p className="mt-1 text-xs">{res.unmatched.join(", ")}{res.unmatchedCount > res.unmatched.length ? " …" : ""}</p>
              </details>
            )}
          </div>
        ) : <div className="text-sm text-red-300">{res.error}</div>
      )}
    </form>
    </div>
  );
}
