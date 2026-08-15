"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { makeOffBoardPickAction } from "@/app/draft/room/actions";

const POS = ["C", "LW", "RW", "D", "G"];

export default function OffBoardPickForm({ pick }: { pick: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [position, setPosition] = useState("C");
  const [epLink, setEpLink] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const submit = () => start(async () => {
    setErr(null);
    const r = await makeOffBoardPickAction({ name, birthDate, position, epLink });
    if (!r.ok) { setErr(r.error ?? "Failed."); setConfirm(false); return; }
    setName(""); setBirthDate(""); setEpLink(""); setPosition("C"); setConfirm(false); setOpen(false);
    router.refresh();
  });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-xl border border-dashed border-slate-700 hover:border-amber-500/60 text-slate-400 hover:text-amber-300 text-sm py-2.5">
        + Draft a player not on the board
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-amber-200">Off-board pick · #{pick}</div>
        <button onClick={() => { setOpen(false); setConfirm(false); setErr(null); }} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
      </div>
      <div className="text-[11px] text-slate-500">Player must be ≤ 23 on draft day. He&apos;s added to prospects and flagged for the admin to verify.</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name"
        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none" />
      <div className="flex gap-2">
        <label className="flex-1 text-[11px] text-slate-500">Birth date
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)}
            className="mt-0.5 w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:border-amber-500 focus:outline-none" />
        </label>
        <label className="text-[11px] text-slate-500">Pos
          <select value={position} onChange={(e) => setPosition(e.target.value)}
            className="mt-0.5 block rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:border-amber-500 focus:outline-none">
            {POS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      </div>
      <input value={epLink} onChange={(e) => setEpLink(e.target.value)} placeholder="EliteProspects link (https://…)"
        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none" />
      {err && <div className="text-xs text-rose-400">{err}</div>}
      {!confirm ? (
        <button onClick={() => setConfirm(true)} disabled={pending || !name.trim() || !birthDate}
          className="w-full rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-sm py-2">Draft off-board player</button>
      ) : (
        <div className="flex gap-2">
          <button onClick={submit} disabled={pending} className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-sm py-2">{pending ? "Drafting…" : `Confirm: draft ${name}`}</button>
          <button onClick={() => setConfirm(false)} disabled={pending} className="rounded-lg border border-slate-700 text-slate-300 text-sm px-3">No</button>
        </div>
      )}
    </div>
  );
}
