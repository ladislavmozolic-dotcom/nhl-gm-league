"use client";

import { useState, useTransition } from "react";
import { searchPlayers, savePlayerPosition, type FoundPlayer } from "@/app/admin/positions/actions";

const POSITIONS = ["C", "LW", "RW", "D", "G"];

function parsePos(pos: string | null): string[] {
  return (pos ?? "").toUpperCase().split("/").map((s) => s.trim()).filter(Boolean);
}

function Row({ p }: { p: FoundPlayer }) {
  const [sel, setSel] = useState<string[]>(parsePos(p.position));
  const [shoots, setShoots] = useState<string>(p.shoots ?? "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const toggle = (pos: string) => {
    setSaved(false);
    setSel((cur) => cur.includes(pos) ? cur.filter((x) => x !== pos) : [...cur, pos]);
  };
  const save = () => start(async () => {
    // keep a canonical order
    const ordered = POSITIONS.filter((x) => sel.includes(x));
    await savePlayerPosition(p.id, ordered.join("/"), shoots || null);
    setSaved(true);
  });

  const isD = sel.includes("D") && !sel.some((x) => ["C", "LW", "RW"].includes(x));

  return (
    <div className="flex flex-wrap items-center gap-3 py-2.5 border-b border-slate-800/60">
      <div className="w-52 min-w-52">
        <div className="text-sm font-semibold text-slate-100">{p.name}</div>
        <div className="text-[11px] text-slate-500">{p.teamName ?? "—"}</div>
      </div>
      <div className="flex gap-1">
        {POSITIONS.map((pos) => (
          <button key={pos} onClick={() => toggle(pos)}
            className={`px-2.5 py-1 rounded text-xs font-bold border ${sel.includes(pos)
              ? "bg-blue-600 border-blue-500 text-white"
              : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"}`}>
            {pos}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 text-xs">
        <span className="text-slate-500">Shoots</span>
        {["L", "R"].map((s) => (
          <button key={s} onClick={() => { setShoots(shoots === s ? "" : s); setSaved(false); }}
            className={`px-2 py-1 rounded border ${shoots === s ? "bg-amber-600 border-amber-500 text-white" : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"}`}>
            {s}
          </button>
        ))}
      </div>
      {isD && shoots && (
        <span className="text-[11px] text-slate-500">natural {shoots === "R" ? "right" : "left"} side</span>
      )}
      <button onClick={save} disabled={pending}
        className="ml-auto px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs font-semibold disabled:opacity-50">
        {pending ? "Saving…" : "Save"}
      </button>
      {saved && <span className="text-green-400 text-xs">✓</span>}
    </div>
  );
}

export default function PositionEditor() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<FoundPlayer[]>([]);
  const [pending, start] = useTransition();

  const run = (query: string) => {
    setQ(query);
    if (query.trim().length < 2) { setRows([]); return; }
    start(async () => setRows(await searchPlayers(query)));
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
        A defenseman&apos;s natural side comes from <b>Shoots</b> (L-shot = left side). Playing him on his off-side
        keeps him at &quot;D&quot; but makes him a touch weaker and his pair gels slower. A forward with two
        positions (e.g. C + RW) is a universal — no penalty on either.
      </p>
    </div>
  );
}
