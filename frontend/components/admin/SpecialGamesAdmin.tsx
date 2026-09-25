"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyRealSpecialGamesAction, setSpecialGameAction } from "@/app/admin/special-games/actions";
import { EVENT_KINDS, type EventKind } from "@/lib/special-games-shared";

export function ApplyRealButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button disabled={pending} onClick={() => start(async () => {
        const r = await applyRealSpecialGamesAction();
        setMsg(r.ok ? `Tagged ${r.tagged} games${r.missing.length ? ` · not in schedule: ${r.missing.join(", ")}` : ""}` : r.error);
        router.refresh();
      })} className="rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 px-4 py-2 text-sm font-bold text-white">
        {pending ? "Applying…" : "Load the real NHL 2026-27 events"}
      </button>
      {msg && <span className="text-xs text-slate-400">{msg}</span>}
    </div>
  );
}

export function SpecialGameForm({ initial }: { initial?: { gameId: number; kind: EventKind | null; title: string; venue: string; capacity: number | null } }) {
  const [gameId, setGameId] = useState(initial?.gameId ? String(initial.gameId) : "");
  const [kind, setKind] = useState<EventKind | "">(initial?.kind ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const [cap, setCap] = useState(initial?.capacity ? String(initial.capacity) : "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  const inp = "rounded bg-slate-800 border border-slate-700 px-2 py-1 text-sm";
  const save = (clear = false) => start(async () => {
    const id = Number(gameId);
    if (!id) { setMsg("Game ID?"); return; }
    const r = await setSpecialGameAction(id, clear || !kind ? null : kind, title, venue, cap ? Number(cap) : null);
    setMsg(r.ok ? (clear ? "Cleared" : "Saved") : r.error);
    router.refresh();
  });
  return (
    <div className="flex flex-wrap items-end gap-2 text-xs">
      {!initial && <label className="flex flex-col gap-1 text-slate-400">Game ID<input className={`${inp} w-24`} value={gameId} onChange={(e) => setGameId(e.target.value)} /></label>}
      <label className="flex flex-col gap-1 text-slate-400">Type
        <select className={inp} value={kind} onChange={(e) => setKind(e.target.value as EventKind | "")}>
          <option value="">—</option>
          {EVENT_KINDS.map((k) => <option key={k.key} value={k.key}>{k.icon} {k.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-slate-400">Title<input className={`${inp} w-64`} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="flex flex-col gap-1 text-slate-400">Venue<input className={`${inp} w-56`} value={venue} onChange={(e) => setVenue(e.target.value)} /></label>
      <label className="flex flex-col gap-1 text-slate-400">Crowd<input className={`${inp} w-24`} value={cap} onChange={(e) => setCap(e.target.value.replace(/\D/g, ""))} /></label>
      <button disabled={pending} onClick={() => save()} className="rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 font-bold text-white">Save</button>
      {initial && <button disabled={pending} onClick={() => save(true)} className="rounded bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-slate-200">Remove</button>}
      {msg && <span className="text-slate-400">{msg}</span>}
    </div>
  );
}
