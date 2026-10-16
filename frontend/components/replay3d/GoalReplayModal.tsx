"use client";

// Full-screen 3D goal replay over the game page, with ◀ ▶ to step through every
// goal of the game. Imported via next/dynamic so three.js only loads on demand.

import { useEffect, useMemo, useState } from "react";
import Replay3DPlayer, { type ReplayHud } from "./Replay3DPlayer";
import { goalClip, type GoalReplayData } from "@/lib/replay3d/goal-replay";
import { teamKit } from "@/lib/replay3d/team-colors";

type Team = { teamId: number; name: string; code?: string | null; logoUrl: string | null };
export type ReplayGoal = { data: GoalReplayData; homeScoreAfter: number; awayScoreAfter: number; scorerName: string; assistNames: string[]; label: string };

export default function GoalReplayModal({ gameId, home, away, goals, start, onClose, occupancy }: {
  gameId: number; home: Team; away: Team; goals: ReplayGoal[]; start: number; onClose: () => void; occupancy?: number | null;
}) {
  const [i, setI] = useState(start);
  const g = goals[i];
  const homeKit = useMemo(() => teamKit(home.code, home.name, true), [home.code, home.name]);
  const awayKit = useMemo(() => teamKit(away.code, away.name, false), [away.code, away.name]);
  const clip = useMemo(() => goalClip(g.data, home.teamId, gameId), [g, home.teamId, gameId]);
  const side = g.data.teamId === home.teamId ? "home" : "away";
  const hud: ReplayHud = useMemo(() => ({
    away: { code: away.code ?? away.name.slice(0, 3).toUpperCase(), score: g.awayScoreAfter },
    home: { code: home.code ?? home.name.slice(0, 3).toUpperCase(), score: g.homeScoreAfter },
    clock: g.label,
    title: `${g.scorerName}${g.data.strength === "PP" ? " · PP" : g.data.strength === "SH" ? " · SH" : ""}${g.data.emptyNet ? " · EN" : ""}`,
    subtitle: g.assistNames.length ? `Asistencie: ${g.assistNames.join(", ")}` : "bez asistencie",
    tag: "REPLAY",
  }), [g, home, away]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => Math.min(goals.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [goals.length, onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-label="3D replay gólu">
      <div className="w-full max-w-[1180px] bg-[#0b1120] border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-400">3D replay · gól {i + 1} / {goals.length}</p>
            <p className="text-sm sm:text-base font-black text-white truncate">{g.label} — {g.scorerName} ({side === "home" ? home.code ?? home.name : away.code ?? away.name})</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button disabled={i === 0} onClick={() => setI(i - 1)} className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold disabled:opacity-30">◀</button>
            <button disabled={i === goals.length - 1} onClick={() => setI(i + 1)} className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold disabled:opacity-30">▶</button>
            <button onClick={onClose} className="ml-1 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold hover:bg-red-600 hover:border-red-500" aria-label="Zavrieť">✕</button>
          </div>
        </div>
        <Replay3DPlayer clip={clip} homeKit={homeKit} awayKit={awayKit} homeLogoUrl={home.logoUrl} focusId={`${side}-${g.data.scorerId}`} hud={hud} occupancy={occupancy} homeName={home.name} />
        <p className="mt-2 text-[10px] text-slate-500 leading-snug">
          Rekonštrukcia z údajov simulácie (sektor a typ strely, dorážka/zakladačka/tečovanie, brejk, asistencie a hráči na ľade). Pohyb hráčov je dopočítaný, výsledok zápasu neovplyvňuje.
        </p>
      </div>
    </div>
  );
}
