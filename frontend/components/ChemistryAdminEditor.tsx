"use client";

import { useState, useTransition } from "react";
import { setChemistryValue, clearChemistryValue } from "@/app/admin/chemistry/actions";
import type { ChemBond } from "@/lib/chemistry-admin-server";

function tone(v: number): string {
  return v >= 70 ? "text-emerald-400" : v >= 45 ? "text-amber-400" : "text-rose-400";
}

function BondRow({ teamId, slug, bond, base }: { teamId: number; slug: string; bond: { sig: string; label: string; value: number | null }; base: number }) {
  const current = bond.value ?? base;
  const [draft, setDraft] = useState(current);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const save = () => start(async () => {
    const r = await setChemistryValue(teamId, slug, bond.sig, draft);
    setMsg(r.ok ? "Saved ✓" : r.error);
  });
  const clear = () => start(async () => {
    const r = await clearChemistryValue(teamId, slug, bond.sig);
    if (r.ok) { setDraft(base); setMsg(`Cleared → base (${base})`); } else setMsg(r.error);
  });

  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-800/50 last:border-0 flex-wrap">
      <span className="flex-1 min-w-[220px] text-sm text-slate-300">{bond.label}</span>
      {bond.value == null && <span className="text-[10px] text-slate-600 italic">never played (base {base})</span>}
      <input
        type="number" min={0} max={100} value={draft}
        onChange={(e) => setDraft(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
        className={`w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-right tabular-nums font-bold ${tone(draft)}`}
      />
      <button onClick={save} disabled={pending} className="text-xs px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 font-semibold">
        {pending ? "…" : "Save"}
      </button>
      {bond.value != null && (
        <button onClick={clear} disabled={pending} className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-400">
          Clear
        </button>
      )}
      {msg && <span className="text-[11px] text-slate-500">{msg}</span>}
    </div>
  );
}

export default function ChemistryAdminEditor({ teamId, slug, base, forwardBonds, defenseBonds, stUnits }: {
  teamId: number; slug: string; base: number;
  forwardBonds: { line: number; bonds: ChemBond[] }[];
  defenseBonds: { pair: number; bonds: ChemBond[] }[];
  stUnits: { label: string; sig: string; value: number | null }[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Forward Lines</div>
        <div className="space-y-3">
          {forwardBonds.map((l) => (
            <div key={l.line} className="bg-slate-900/50 border border-slate-800 rounded-xl p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Line {l.line}</div>
              {l.bonds.length === 0 ? <p className="text-xs text-slate-600">Fewer than 2 players set.</p> :
                l.bonds.map((b) => <BondRow key={b.sig} teamId={teamId} slug={slug} bond={b} base={base} />)}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Defense Pairs</div>
        <div className="space-y-3">
          {defenseBonds.map((p) => (
            <div key={p.pair} className="bg-slate-900/50 border border-slate-800 rounded-xl p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Pair {p.pair}</div>
              {p.bonds.length === 0 ? <p className="text-xs text-slate-600">Fewer than 2 players set.</p> :
                p.bonds.map((b) => <BondRow key={b.sig} teamId={teamId} slug={slug} bond={b} base={base} />)}
            </div>
          ))}
        </div>
      </div>
      {stUnits.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Special Teams</div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3">
            {stUnits.map((u) => <BondRow key={u.sig} teamId={teamId} slug={slug} bond={u} base={base} />)}
          </div>
        </div>
      )}
    </div>
  );
}
