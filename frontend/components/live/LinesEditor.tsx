"use client";

import { naturalSlots, type ForwardLine, type DefensePair } from "@/lib/sim/lines-core";
import { placePlayer, placedIds, type Slot } from "@/lib/sim/line-edit";

export type RosterPlayer = { id: number; name: string; position: string; shoots: string | null; overall: number | null; scratched: boolean };

type Props = {
  forwards: ForwardLine[];
  defense: DefensePair[];
  roster: RosterPlayer[];
  outIds: number[];            // players who left this game (injured / ejected) — still selectable, but flagged
  disabled?: boolean;
  onChange: (forwards: ForwardLine[], defense: DefensePair[]) => void;
};

const F_SLOTS: Array<["lw" | "c" | "rw", string]> = [["lw", "LW"], ["c", "C"], ["rw", "RW"]];
const D_SLOTS: Array<["ld" | "rd", string]> = [["ld", "LD"], ["rd", "RD"]];

type SelectProps = {
  slot: Slot; value: number | null; label: string; roster: RosterPlayer[]; byId: Map<number, RosterPlayer>;
  out: Set<number>; placed: Set<number>; disabled?: boolean; onPick: (slot: Slot, id: number | null) => void;
};

function SlotSelect({ slot, value, label, roster, byId, out, placed, disabled, onPick }: SelectProps) {
  const wantD = slot.kind === "D";
  const isD = (p: RosterPlayer) => { const n = naturalSlots(p.position, p.shoots); return n.has("LD") || n.has("RD"); };
  const pool = roster.filter((p) => isD(p) === wantD || p.id === value);
  const cur = value != null ? byId.get(value) : undefined;
  const off = cur ? !naturalSlots(cur.position, cur.shoots).has(label) : false;
  const gone = value != null && out.has(value);
  return (
    <label className="block min-w-0">
      <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      <select disabled={disabled} value={value ?? ""} onChange={(e) => onPick(slot, e.target.value ? Number(e.target.value) : null)}
        className={`w-full bg-slate-900 border rounded-lg px-2 py-1.5 text-xs ${gone ? "border-red-500/70 text-red-300" : off ? "border-amber-500/70" : "border-slate-700"}`}>
        {value == null && <option value="">— empty —</option>}
        {pool.map((p) => (
          <option key={p.id} value={p.id}>
            {out.has(p.id) ? "⛔ " : placed.has(p.id) ? "" : "◦ "}{p.name} · {p.position} · {p.overall ?? "–"}{p.scratched ? " (scratch)" : ""}{out.has(p.id) ? " — out" : ""}
          </option>
        ))}
      </select>
      {gone ? <span className="text-[10px] text-red-300">out of the game — the bench covers</span> : off ? <span className="text-[10px] text-amber-300">off-position — a skill penalty applies</span> : null}
    </label>
  );
}

export default function LinesEditor({ forwards, defense, roster, outIds, disabled, onChange }: Props) {
  const byId = new Map(roster.map((p) => [p.id, p]));
  const out = new Set(outIds);
  const placed = new Set<number>(placedIds(forwards, defense));
  const onPick = (slot: Slot, id: number | null) => { const r = placePlayer(forwards, defense, slot, id); onChange(r.forwards, r.defense); };
  const common = { roster, byId, out, placed, disabled, onPick };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-slate-200 mb-1.5">Forwards</p>
        <div className="space-y-2">
          {forwards.map((l, i) => (
            <div key={i} className="grid grid-cols-[2.5rem_1fr_1fr_1fr] items-end gap-2">
              <span className="text-[11px] text-slate-500 pb-2">L{i + 1}</span>
              {F_SLOTS.map(([pos, label]) => <SlotSelect key={pos} {...common} slot={{ kind: "F", line: i, pos }} value={l[pos]} label={label} />)}
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-200 mb-1.5">Defense</p>
        <div className="space-y-2">
          {defense.map((p, i) => (
            <div key={i} className="grid grid-cols-[2.5rem_1fr_1fr] items-end gap-2">
              <span className="text-[11px] text-slate-500 pb-2">D{i + 1}</span>
              {D_SLOTS.map(([pos, label]) => <SlotSelect key={pos} {...common} slot={{ kind: "D", line: i, pos }} value={p[pos]} label={label} />)}
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-slate-500">Pick a player already in the lineup and the two trade places. ◦ marks a healthy player who isn&apos;t dressed tonight — he can come in, and the player he replaces sits.</p>
    </div>
  );
}
