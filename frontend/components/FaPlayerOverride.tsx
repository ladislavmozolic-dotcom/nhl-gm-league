"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Card } from "@/components/ui";
import { money } from "@/lib/finance";
import { searchPlayersForOverrideAction, setPlayerOverrideAction, type OverrideRow } from "@/app/admin/fa-tuning/actions";

export default function FaPlayerOverride({ initialQuery }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery ?? "");
  const [rows, setRows] = useState<OverrideRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  const search = (value: string) => {
    setQ(value);
    setMsg(null);
    start(async () => {
      const r = value.trim().length >= 2 ? await searchPlayersForOverrideAction(value) : [];
      setRows(r);
    });
  };

  // arrived from a "✏️ Edit" link elsewhere (e.g. Demand Watch) with a player
  // already named — run the search immediately and scroll this section into view.
  useEffect(() => {
    if (!initialQuery) return;
    search(initialQuery);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const save = (id: number, current: number | null) => start(async () => {
    const raw = drafts[id];
    const value = raw === undefined || raw.trim() === "" ? current : Math.round(Number(raw) * 1_000_000);
    const r = await setPlayerOverrideAction(id, value ?? null, notes[id]);
    if (!r.ok) { setMsg(r.error); return; }
    setRows((prev) => prev.map((p) => (p.id === id ? { ...p, faDemandOverride: value ?? null } : p)));
    setMsg("Saved.");
  });

  const clear = (id: number) => start(async () => {
    const r = await setPlayerOverrideAction(id, null, notes[id]);
    if (!r.ok) { setMsg(r.error); return; }
    setRows((prev) => prev.map((p) => (p.id === id ? { ...p, faDemandOverride: null } : p)));
    setDrafts((prev) => ({ ...prev, [id]: "" }));
    setMsg("Cleared — back to the computed value.");
  });

  return (
    <Card title="Player Demand Overrides" accent="text-amber-400">
      <div ref={sectionRef} />
      <p className="text-xs text-slate-500 mb-3">
        Hand-set one player's asking price — overrides everything the engine would otherwise compute for him
        (weights, elite ladder, age curve, all of it). Leave the note field to explain why, for your own audit trail below.
      </p>
      <input
        value={q} onChange={(e) => search(e.target.value)} placeholder="Search player by name…"
        className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm mb-3"
      />
      {msg && <p className="text-sm text-emerald-400 mb-2">{msg}</p>}
      {rows.length > 0 && (
        <div className="divide-y divide-slate-800/50">
          {rows.map((p) => (
            <div key={p.id} className="py-2.5 flex flex-wrap items-center gap-3 text-sm">
              <div className="min-w-[180px]">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-slate-500">{p.teamName ?? "—"} · {p.isGoalie ? "G" : p.position}</div>
              </div>
              <div className="text-xs text-slate-500 w-28">Current: {p.capHit ? money(p.capHit) : "—"}</div>
              <div className="text-xs w-32">
                {p.faDemandOverride != null
                  ? <span className="text-amber-400 font-semibold">Override: {money(p.faDemandOverride)}</span>
                  : <span className="text-slate-500">computed</span>}
              </div>
              <input
                type="number" step={0.05} placeholder="$M"
                defaultValue={p.faDemandOverride != null ? p.faDemandOverride / 1_000_000 : ""}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right tabular-nums"
              />
              <input
                placeholder="note (optional)"
                onChange={(e) => setNotes((prev) => ({ ...prev, [p.id]: e.target.value }))}
                className="flex-1 min-w-[140px] bg-slate-900 border border-slate-700 rounded px-2 py-1"
              />
              <button onClick={() => save(p.id, p.faDemandOverride)} disabled={pending}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold disabled:opacity-50">
                Save
              </button>
              {p.faDemandOverride != null && (
                <button onClick={() => clear(p.id)} disabled={pending}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-400">
                  Clear
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {q.trim().length >= 2 && rows.length === 0 && !pending && (
        <p className="text-sm text-slate-500">No player matches "{q}".</p>
      )}
    </Card>
  );
}
