"use client";

import { useMemo, useState } from "react";
import { tacticalFitDefense, tacticalFitForwards, type TacticalFitPlayer } from "@/lib/sim/tactical-fit";
import { profileOf, summaryOf, chemFor, offSlotForward, offSlotDefense, type FitPlayer, type RatingPop } from "@/lib/sim/line-fit-calc";
import type { TeamTactics } from "@/lib/sim/tactics";
import { LineCard } from "@/components/LineBuilderView";
import type { BuiltLine } from "@/lib/line-builder-server";

type Pickable = FitPlayer & { teamCode: string | null };

const F_ROLES = ["LW", "C", "RW"];
const D_ROLES = ["LD", "RD"];
const F_SLOTS = ["1st Line", "2nd Line", "3rd Line", "4th Line"];
const D_SLOTS = ["1st Pair", "2nd Pair", "3rd Pair"];

function SlotPicker({ pool, value, onPick, onClear }: {
  pool: Pickable[]; value: Pickable | null; onPick: (p: Pickable) => void; onClear: () => void;
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
        <span className="font-semibold text-sm truncate">{value.name} <span className="text-slate-500 text-xs">{value.teamCode ?? ""}</span></span>
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
        <div className="absolute z-30 mt-1 w-72 max-h-64 overflow-y-auto bg-[#0f1d32] border border-slate-700 rounded-lg shadow-2xl">
          {matches.map((p) => (
            <button key={p.id} onMouseDown={() => { onPick(p); setQ(""); setOpen(false); }}
              className="w-full text-left px-2.5 py-1.5 text-sm hover:bg-slate-700/50 flex items-center justify-between gap-2">
              <span className="truncate">{p.name} <span className="text-slate-500 text-xs">{p.position}</span></span>
              <span className="text-slate-500 text-xs shrink-0">{p.teamCode ?? ""} · {p.overall}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const fitPlayer = (p: Pickable | null): TacticalFitPlayer | null => p == null ? null : { ...p.a, position: p.position, shoots: p.shoots };

export default function LineFitFinder({ players, chem, tactics, pops, hasTeam }: {
  players: Pickable[]; chem: Record<string, number>; tactics: TeamTactics; pops: { F: RatingPop; D: RatingPop }; hasTeam: boolean;
}) {
  const [kind, setKind] = useState<"F" | "D">("F");
  const [sel, setSel] = useState<(Pickable | null)[]>([null, null, null]);
  const [lineIndex, setLineIndex] = useState(0);
  const roles = kind === "F" ? F_ROLES : D_ROLES;
  const slotLabels = kind === "F" ? F_SLOTS : D_SLOTS;
  const slotsUsed = sel.slice(0, roles.length);

  const setSlot = (i: number, p: Pickable | null) => setSel((s) => { const n = [...s]; n[i] = p; return n; });
  const switchKind = (k: "F" | "D") => { setKind(k); setSel([null, null, null]); setLineIndex(0); };

  const line: BuiltLine = useMemo(() => {
    const present = slotsUsed.filter((p): p is Pickable => !!p);
    const slots = slotsUsed.map((p, idx) => ({
      role: roles[idx], id: p?.id ?? null, name: p?.name ?? null, slug: p?.slug ?? null, overall: p?.overall ?? null,
      offSlot: !!p && (kind === "F" ? offSlotForward(roles[idx], p.position) : offSlotDefense(idx as 0 | 1, p.shoots)),
    }));
    const profile = profileOf(present, kind, pops);
    const tacticalFit = kind === "F"
      ? tacticalFitForwards(slotsUsed.map(fitPlayer), tactics, undefined, lineIndex)
      : tacticalFitDefense(slotsUsed.map(fitPlayer), tactics, undefined, lineIndex);
    const { chemistry, gelled, pairs } = chemFor(chem, slots.map((s) => ({ role: s.role, id: s.id })), tacticalFit);
    return { kind, index: 0, slots, chemistry, gelled, pairs, tacticalFit, profile, summary: present.length >= 2 ? summaryOf(profile, kind) : "Pick at least two players to preview a fit." };
  }, [slotsUsed, kind, pops, tactics, chem, roles, lineIndex]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        Pick players for each slot — nobody has to be on your roster. Chemistry always shows as a projection for a combo with no shared history (which is every hypothetical combo); Tactical Fit is read against your own team&apos;s system.
        {!hasTeam && <span className="text-amber-400"> You&apos;re not signed in as a specific team, so Tactical Fit falls back to a balanced default system.</span>}
      </p>

      <div className="flex gap-2">
        {(["F", "D"] as const).map((k) => (
          <button key={k} onClick={() => switchKind(k)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${kind === k ? "bg-blue-600 text-white" : "border border-slate-700 text-slate-400 hover:bg-slate-800"}`}>
            {k === "F" ? "Forward Line" : "Defense Pair"}
          </button>
        ))}
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
          Depth-chart slot — affects Tactical Fit&apos;s archetype match (a checking trio scores better as a 4th line than a 1st, etc.)
        </div>
        <div className="flex gap-2 flex-wrap">
          {slotLabels.map((label, i) => (
            <button key={label} onClick={() => setLineIndex(i)}
              className={`px-2.5 py-1 rounded text-xs font-semibold ${lineIndex === i ? "bg-blue-600 text-white" : "border border-slate-700 text-slate-400 hover:bg-slate-800"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${roles.length}, minmax(0, 1fr))` }}>
        {roles.map((role, i) => (
          <div key={role}>
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">{role}</div>
            <SlotPicker pool={players} value={slotsUsed[i] ?? null} onPick={(p) => setSlot(i, p)} onClear={() => setSlot(i, null)} />
          </div>
        ))}
      </div>

      <div className="max-w-md">
        <LineCard line={line} />
      </div>
    </div>
  );
}
