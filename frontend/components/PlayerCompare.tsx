"use client";

import { useMemo, useState } from "react";

export type ComparePlayer = Record<string, number | string | null> & {
  id: number; name: string; position: string | null; teamCode: string | null;
  age: number | null; overall: number | null; contractText: string | null; condition: number | null; goalie: boolean;
};

const SKATER_ATTRS: Array<[string, string]> = [
  ["ck", "Checking"], ["fg", "Fighting"], ["di", "Discipline"], ["sk", "Skating"], ["st", "Strength"],
  ["en", "Endurance"], ["du", "Durability"], ["ph", "Puck Handling"], ["fo", "Faceoffs"], ["pa", "Passing"],
  ["sc", "Scoring"], ["df", "Defense"], ["ps", "Penalty Shot / Breakaway"], ["ex", "Experience"], ["ld", "Leadership"], ["mo", "Morale"],
];
const GOALIE_ATTRS: Array<[string, string]> = [
  ["sk", "Skating"], ["du", "Durability"], ["en", "Endurance"], ["sz", "Size"], ["ag", "Agility"],
  ["rb", "Rebound"], ["sc", "Style Control"], ["hs", "Hand Speed"], ["rt", "Reaction Time"], ["ph", "Puck Handling"],
  ["ps", "Positioning"], ["ex", "Experience"], ["ld", "Leadership"], ["mo", "Morale"],
];

function SlotPicker({ pool, value, onPick, onClear }: {
  pool: ComparePlayer[]; value: ComparePlayer | null; onPick: (p: ComparePlayer) => void; onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    if (!q.trim()) return [];
    const s = q.toLowerCase();
    return pool.filter((p) => p.name.toLowerCase().includes(s)).slice(0, 8);
  }, [q, pool]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 bg-slate-800/60 rounded px-2 py-1.5">
        <span className="font-semibold text-sm truncate">{value.name}</span>
        <button onClick={onClear} className="text-slate-400 hover:text-red-400 text-sm shrink-0">✕</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder="Search player…"
        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm" />
      {open && matches.length > 0 && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto bg-[#0f1d32] border border-slate-700 rounded-lg shadow-2xl">
          {matches.map((p) => (
            <button key={p.id} onMouseDown={() => { onPick(p); setQ(""); setOpen(false); }}
              className="w-full text-left px-2.5 py-1.5 text-sm hover:bg-slate-700/50 flex items-center justify-between gap-2">
              <span className="truncate">{p.name} <span className="text-slate-500 text-xs">{p.position ?? ""}</span></span>
              <span className="text-slate-500 text-xs shrink-0">{p.teamCode} · {p.overall}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlayerCompare({ skaters, goalies, initialId, hideAttrs = false }: { skaters: ComparePlayer[]; goalies: ComparePlayer[]; initialId?: number | null; hideAttrs?: boolean }) {
  const initial = initialId != null ? [...skaters, ...goalies].find((p) => p.id === initialId) ?? null : null;
  const [mode, setMode] = useState<"skaters" | "goalies">(initial?.goalie ? "goalies" : "skaters");
  const [sel, setSel] = useState<(ComparePlayer | null)[]>([initial, null, null, null, null]);
  const pool = mode === "skaters" ? skaters : goalies;
  const attrs = mode === "skaters" ? SKATER_ATTRS : GOALIE_ATTRS;
  const chosen = sel.map((s) => (s && s.goalie === (mode === "goalies") ? s : null));
  const active = chosen.filter(Boolean) as ComparePlayer[];

  const setSlot = (i: number, p: ComparePlayer | null) => setSel((s) => { const n = [...s]; n[i] = p; return n; });
  const switchMode = (m: "skaters" | "goalies") => { setMode(m); setSel([null, null, null, null, null]); };

  const bestOf = (key: string) => {
    const vals = active.map((p) => Number(p[key])).filter((v) => !isNaN(v));
    return vals.length ? Math.max(...vals) : null;
  };

  const Row = ({ label, k, highlight = true, fmt }: { label: string; k: string; highlight?: boolean; fmt?: (v: number | string | null) => string }) => {
    const best = highlight ? bestOf(k) : null;
    return (
      <tr className="border-b border-slate-800/60">
        <td className="px-3 py-1.5 text-slate-400 text-sm sticky left-0 bg-slate-900/60 whitespace-nowrap">{label}</td>
        {sel.map((p, i) => {
          const raw = p ? p[k] : null;
          const num = Number(raw);
          const isBest = highlight && best != null && !isNaN(num) && num === best && active.length > 1;
          return (
            <td key={i} className={`px-3 py-1.5 text-center text-sm tabular-nums ${p ? "" : "text-slate-700"} ${isBest ? "text-green-400 font-bold" : "text-slate-200"}`}>
              {p ? (fmt ? fmt(raw) : raw ?? "—") : "—"}
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4">
      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-2xl font-bold mr-3">Player Compare</h1>
        {(["skaters", "goalies"] as const).map((m) => (
          <button key={m} onClick={() => switchMode(m)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold capitalize ${mode === m ? "bg-blue-600 text-white" : "border border-slate-700 text-slate-400 hover:bg-slate-800"}`}>{m}</button>
        ))}
      </div>
      <p className="text-slate-400 text-sm mb-4">Search up to five {mode} and compare them attribute by attribute. Best value per row is highlighted.</p>

      <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 720 }}>
          <thead>
            <tr className="border-b border-slate-800 bg-slate-800/30">
              <th className="px-3 py-2 text-left text-xs text-slate-500 sticky left-0 bg-slate-800/40 min-w-[130px]">Attribute</th>
              {sel.map((_, i) => (
                <th key={i} className="px-2 py-2 min-w-[150px]">
                  <SlotPicker pool={pool} value={chosen[i]} onPick={(p) => setSlot(i, p)} onClear={() => setSlot(i, null)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label="Overall" k="overall" />
            <Row label="Position" k="position" highlight={false} />
            <Row label="Team" k="teamCode" highlight={false} />
            <Row label="Age" k="age" highlight={false} />
            <Row label="Condition" k="condition" />
            {hideAttrs ? (
              <tr className="border-b border-slate-800 bg-slate-800/20">
                <td colSpan={6} className="px-3 py-2 text-xs text-slate-500">🔒 Sign in as a GM to see full player attributes.</td>
              </tr>
            ) : (
              <>
                <tr className="border-b border-slate-800 bg-slate-800/20"><td colSpan={6} className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-500">Attributes</td></tr>
                {attrs.map(([k, label]) => <Row key={k} label={label} k={k} />)}
              </>
            )}
            <Row label="Contract" k="contractText" highlight={false} />
          </tbody>
        </table>
      </div>
    </div>
  );
}
