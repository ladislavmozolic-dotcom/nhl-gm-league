"use client";

import { useState, useTransition } from "react";
import { searchProfilePlayers, savePlayerProfile, type FoundProfilePlayer } from "@/app/admin/profile/actions";

const inputCls = "bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500";

function Row({ p }: { p: FoundProfilePlayer }) {
  const [birthDate, setBirthDate] = useState(p.birthDate ?? "");
  const [birthPlace, setBirthPlace] = useState(p.birthPlace ?? "");
  const [nationality, setNationality] = useState(p.nationality ?? "");
  const [height, setHeight] = useState(p.height ?? "");
  const [weight, setWeight] = useState(p.weight != null ? String(p.weight) : "");
  const [number, setNumber] = useState(p.number != null ? String(p.number) : "");
  const [shoots, setShoots] = useState(p.shoots ?? "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const touch = () => setSaved(false);
  const save = () => start(async () => {
    await savePlayerProfile(p.id, {
      birthDate: birthDate || null,
      birthPlace: birthPlace || null,
      nationality: nationality || null,
      height: height || null,
      weight: weight.trim() ? Number(weight) : null,
      number: number.trim() ? Number(number) : null,
      shoots: shoots || null,
    });
    setSaved(true);
  });

  return (
    <div className="py-3 border-b border-slate-800/60 space-y-2">
      <div>
        <div className="text-sm font-semibold text-slate-100">{p.name}</div>
        <div className="text-[11px] text-slate-500">{p.teamName ?? "—"}</div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-0.5">
          <span className="block text-[10px] text-slate-500">Date of Birth</span>
          <input type="date" value={birthDate} onChange={(e) => { setBirthDate(e.target.value); touch(); }} className={inputCls} />
        </label>
        <label className="space-y-0.5">
          <span className="block text-[10px] text-slate-500">Birthplace</span>
          <input value={birthPlace} onChange={(e) => { setBirthPlace(e.target.value); touch(); }} placeholder="Toronto, ON" className={`${inputCls} w-36`} />
        </label>
        <label className="space-y-0.5">
          <span className="block text-[10px] text-slate-500">Nationality</span>
          <input value={nationality} onChange={(e) => { setNationality(e.target.value.toUpperCase()); touch(); }} maxLength={3} placeholder="CAN" className={`${inputCls} w-16 uppercase`} />
        </label>
        <label className="space-y-0.5">
          <span className="block text-[10px] text-slate-500">Height</span>
          <input value={height} onChange={(e) => { setHeight(e.target.value); touch(); }} placeholder="185 cm" className={`${inputCls} w-20`} />
        </label>
        <label className="space-y-0.5">
          <span className="block text-[10px] text-slate-500">Weight (kg)</span>
          <input type="number" value={weight} onChange={(e) => { setWeight(e.target.value); touch(); }} className={`${inputCls} w-20`} />
        </label>
        <label className="space-y-0.5">
          <span className="block text-[10px] text-slate-500">#</span>
          <input type="number" value={number} onChange={(e) => { setNumber(e.target.value); touch(); }} className={`${inputCls} w-14`} />
        </label>
        <div className="space-y-0.5">
          <span className="block text-[10px] text-slate-500">{p.isGoalie ? "Catches" : "Shoots"}</span>
          <div className="flex gap-1">
            {["L", "R"].map((s) => (
              <button key={s} onClick={() => { setShoots(shoots === s ? "" : s); touch(); }}
                className={`px-2 py-1 rounded border text-xs ${shoots === s ? "bg-amber-600 border-amber-500 text-white" : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <button onClick={save} disabled={pending}
          className="ml-auto px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs font-semibold disabled:opacity-50 self-end">
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-green-400 text-xs self-end pb-1.5">✓</span>}
      </div>
    </div>
  );
}

export default function ProfileEditor() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<FoundProfilePlayer[]>([]);
  const [pending, start] = useTransition();

  const run = (query: string) => {
    setQ(query);
    if (query.trim().length < 2) { setRows([]); return; }
    start(async () => setRows(await searchProfilePlayers(query)));
  };

  return (
    <div className="space-y-4">
      <input
        value={q}
        onChange={(e) => run(e.target.value)}
        placeholder="Search a player by name…"
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
      />
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-4">
        {pending && <p className="py-4 text-sm text-slate-500">Searching…</p>}
        {!pending && q.trim().length >= 2 && rows.length === 0 && <p className="py-4 text-sm text-slate-500">No players found.</p>}
        {rows.map((p) => <Row key={p.id} p={p} />)}
      </div>
      <p className="text-[11px] text-slate-500">
        Age is recalculated automatically from Date of Birth overnight — no need to edit it separately.
      </p>
    </div>
  );
}
