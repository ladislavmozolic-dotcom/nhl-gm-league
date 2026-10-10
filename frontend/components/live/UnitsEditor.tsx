"use client";

import { naturalSlots, type SpecialUnit } from "@/lib/sim/lines-core";
import { placeInUnit } from "@/lib/sim/line-edit";
import type { RosterPlayer } from "./LinesEditor";

type Props = {
  title: string;
  tag: string; // short unit label, e.g. "PP", "PK", "4v3"
  /** slot kinds in order, e.g. PP = F F F D D */
  kinds: Array<"F" | "D">;
  units: SpecialUnit[];
  roster: RosterPlayer[];
  outIds: number[];
  disabled?: boolean;
  onChange: (units: SpecialUnit[]) => void;
};

const isD = (p: RosterPlayer) => { const n = naturalSlots(p.position, p.shoots); return n.has("LD") || n.has("RD"); };

/** Special-teams units (power play / penalty kill): pick who plays each slot. Forwards fill F slots, defensemen D slots. */
export default function UnitsEditor({ title, tag, kinds, units, roster, outIds, disabled, onChange }: Props) {
  const out = new Set(outIds);
  const byId = new Map(roster.map((p) => [p.id, p]));
  return (
    <div>
      <p className="text-xs font-semibold text-slate-200 mb-1.5">{title}</p>
      <div className="space-y-2">
        {units.map((u, ui) => (
          <div key={ui} className="grid items-end gap-2" style={{ gridTemplateColumns: `2.5rem repeat(${kinds.length}, minmax(0, 1fr))` }}>
            <span className="text-[11px] text-slate-500 pb-2">{tag}{ui + 1}</span>
            {kinds.map((kind, si) => {
              const value = u.players[si] ?? null;
              const pool = roster.filter((p) => isD(p) === (kind === "D") || p.id === value);
              const gone = value != null && out.has(value);
              return (
                <label key={si} className="block min-w-0">
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">{kind}</span>
                  <select disabled={disabled} value={value ?? ""}
                    onChange={(e) => onChange(units.map((x, j) => (j === ui ? { ...x, players: placeInUnit(x.players, si, e.target.value ? Number(e.target.value) : null) } : x)))}
                    className={`w-full bg-slate-900 border rounded-lg px-2 py-1.5 text-xs ${gone ? "border-red-500/70 text-red-300" : "border-slate-700"}`}>
                    {value == null && <option value="">— empty —</option>}
                    {pool.map((p) => <option key={p.id} value={p.id}>{out.has(p.id) ? "⛔ " : ""}{p.name} · {p.position} · {p.overall ?? "–"}</option>)}
                  </select>
                  {gone && <span className="text-[10px] text-red-300">out — the bench covers</span>}
                  {value != null && !byId.has(value) && <span className="text-[10px] text-amber-300">not on the active roster</span>}
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
