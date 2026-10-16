"use client";

// Full-screen 3D goal replay over the game page, with ◀ ▶ to step through every
// goal of the game. Imported via next/dynamic so three.js only loads on demand.

import { useEffect, useMemo, useState } from "react";
import Replay3DPlayer, { type ReplayHud } from "./Replay3DPlayer";
import { goalClip, computeGoalTelemetry, type GoalReplayData } from "@/lib/replay3d/goal-replay";
import { teamKit } from "@/lib/replay3d/team-colors";
import { BODY_CREDIT } from "./skinned-body";

type Team = { teamId: number; name: string; code?: string | null; slug?: string | null; logoUrl: string | null };
export type ReplayGoal = {
  data: GoalReplayData;
  homeScoreAfter: number;
  awayScoreAfter: number;
  scorerName: string;
  assistNames: string[];
  label: string;
  scorerSeasonGoal?: number;
};

export default function GoalReplayModal({ gameId, home, away, goals, start, onClose, occupancy }: {
  gameId: number; home: Team; away: Team; goals: ReplayGoal[]; start: number; onClose: () => void; occupancy?: number | null;
}) {
  const [i, setI] = useState(start);
  const g = goals[i];
  const homeKit = useMemo(() => teamKit(home, true), [home]);
  const awayKit = useMemo(() => teamKit(away, false), [away]);
  const clip = useMemo(() => goalClip(g.data, home.teamId, gameId), [g, home.teamId, gameId]);
  const side = g.data.teamId === home.teamId ? "home" : "away";
  const scoringTeam = side === "home" ? home : away;
  const oppTeam = side === "home" ? away : home;

  const telemetry = useMemo(
    () => computeGoalTelemetry(g.data, gameId + g.data.period * 1000 + g.data.seconds),
    [g.data, gameId]
  );

  const scorerPlayer = useMemo(
    () => g.data.forSkaters.find((p) => p.id === g.data.scorerId),
    [g.data.forSkaters, g.data.scorerId]
  );

  const assistPlayers = useMemo(
    () =>
      g.data.assistIds.map((id, idx) => {
        const p = g.data.forSkaters.find((sk) => sk.id === id);
        return {
          name: g.assistNames[idx] ?? p?.name ?? "",
          number: p?.number ?? null,
        };
      }),
    [g.data.assistIds, g.data.forSkaters, g.assistNames]
  );

  const hud: ReplayHud = useMemo(
    () => ({
      away: { code: away.code ?? away.name.slice(0, 3).toUpperCase(), score: g.awayScoreAfter },
      home: { code: home.code ?? home.name.slice(0, 3).toUpperCase(), score: g.homeScoreAfter },
      clock: g.label,
      title: `${g.scorerName}${g.data.strength === "PP" ? " · PP" : g.data.strength === "SH" ? " · SH" : ""}${g.data.emptyNet ? " · EN" : ""}`,
      subtitle: g.assistNames.length ? `Asistencie: ${g.assistNames.join(", ")}` : "bez asistencie",
      tag: "NHL REPLAY",
      telemetry,
      scorer: {
        name: g.scorerName,
        number: scorerPlayer?.number ?? null,
        seasonGoals: g.scorerSeasonGoal ?? null,
        teamCode: scoringTeam.code ?? scoringTeam.name.slice(0, 3).toUpperCase(),
        teamColor: side === "home" ? homeKit.jersey : awayKit.jersey,
      },
      assists: assistPlayers,
      strength: g.data.strength,
      emptyNet: g.data.emptyNet,
      scoringSide: side,
    }),
    [g, home, away, side, scoringTeam, homeKit, awayKit, telemetry, scorerPlayer, assistPlayers]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => Math.min(goals.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [goals.length, onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="3D replay gólu"
    >
      <div
        className="w-full max-w-[1220px] bg-[#070b13] border border-slate-800/90 rounded-2xl p-3 sm:p-4 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-2.5 pb-2 border-b border-slate-800/80">
          <div className="min-w-0 flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-600/20 border border-red-500/40 text-[10px] font-black uppercase tracking-wider text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              NHL Broadcast Replay
            </span>
            <span className="text-xs font-mono font-bold text-slate-400">
              Gól {i + 1} z {goals.length}
            </span>
            <span className="hidden sm:inline text-xs font-black text-slate-300">·</span>
            <p className="text-sm font-black text-white truncate hidden sm:block">
              {g.label} — {g.scorerName} ({scoringTeam.code ?? scoringTeam.name})
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              disabled={i === 0}
              onClick={() => setI(i - 1)}
              className="px-3 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-200 text-xs font-bold hover:bg-slate-700 transition disabled:opacity-25"
              title="Predchádzajúci gól (Šípka doľava)"
            >
              ◀ Predošlý
            </button>
            <button
              disabled={i === goals.length - 1}
              onClick={() => setI(i + 1)}
              className="px-3 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-200 text-xs font-bold hover:bg-slate-700 transition disabled:opacity-25"
              title="Ďalší gól (Šípka doprava)"
            >
              Ďalší ▶
            </button>
            <button
              onClick={onClose}
              className="ml-1 px-3 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-300 text-xs font-bold hover:bg-red-600 hover:border-red-500 hover:text-white transition"
              aria-label="Zavrieť (Esc)"
              title="Zavrieť (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        <Replay3DPlayer
          clip={clip}
          homeKit={homeKit}
          awayKit={awayKit}
          homeLogoUrl={home.logoUrl}
          awayLogoUrl={away.logoUrl}
          focusId={`${side}-${g.data.scorerId}`}
          hud={hud}
          occupancy={occupancy}
          homeName={home.name}
        />

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
          <p className="leading-snug">
            3D rekonštrukcia zo zápasových dát simulácie (NHL Edge telemetria, typ a sektor strely, dorážky/tečovania, asistencie a hráči na ľade).
            <span className="block text-slate-600">{BODY_CREDIT}</span>
          </p>
          <div className="flex items-center gap-3 text-slate-400 font-mono">
            <span>[Medzerník] Pauza/Play</span>
            <span>[◀ / ▶] Krokovanie</span>
            <span>[F] Celá obrazovka</span>
          </div>
        </div>
      </div>
    </div>
  );
}
