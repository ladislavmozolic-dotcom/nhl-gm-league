"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Card } from "@/components/ui";
import { money } from "@/lib/finance";
import { searchPlayersForOverrideAction, setPlayerOverrideAction, type OverrideRow, type OverrideLadder } from "@/app/admin/fa-tuning/actions";

const TERMS = [1, 2, 3, 4] as const;
const EMPTY: OverrideLadder = { 1: null, 2: null, 3: null, 4: null };

export default function FaPlayerOverride({ initialQuery }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery ?? "");
  const [rows, setRows] = useState<OverrideRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Record<number, string>>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(true);
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

  const setDraft = (id: number, term: number, v: string) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [term]: v } }));

  // Accepts either a whole dollar figure ("7500000") or millions ("7.5") — anything
  // under 1,000 is read as millions (no real override is worth less than $1,000),
  // so both styles work without the field silently misreading one as the other.
  const dollarsFrom = (raw: string): number | null => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    const dollars = n < 1_000 ? n * 1_000_000 : n;
    return Math.round(dollars / 50_000) * 50_000;
  };

  const ladderFrom = (id: number, current: OverrideLadder): OverrideLadder => {
    const d = drafts[id];
    const out = { ...EMPTY };
    for (const t of TERMS) {
      const raw = d?.[t];
      out[t] = raw === undefined ? current[t] : raw.trim() === "" ? null : dollarsFrom(raw);
    }
    return out;
  };

  const save = (id: number, current: OverrideLadder) => start(async () => {
    const ladder = ladderFrom(id, current);
    const r = await setPlayerOverrideAction(id, ladder, notes[id]);
    if (!r.ok) { setMsgOk(false); setMsg(r.error); return; }
    setRows((prev) => prev.map((p) => (p.id === id ? { ...p, ladder } : p)));
    setMsgOk(true); setMsg("Saved.");
  });

  const clear = (id: number) => start(async () => {
    const r = await setPlayerOverrideAction(id, EMPTY, notes[id]);
    if (!r.ok) { setMsgOk(false); setMsg(r.error); return; }
    setRows((prev) => prev.map((p) => (p.id === id ? { ...p, ladder: EMPTY } : p)));
    setDrafts((prev) => ({ ...prev, [id]: {} }));
    setMsgOk(true); setMsg("Cleared — back to the computed ladder.");
  });

  return (
    <Card title="Player Demand Overrides" accent="text-amber-400">
      <div ref={sectionRef} />
      <p className="text-xs text-slate-500 mb-3">
        Hand-set one player's 1-4yr asking ladder — any term you leave blank stays the engine's computed value.
        Type a full dollar figure (7500000) or millions (7.5) — either works. The 1yr rung also becomes his
        Free Agent Frenzy headline ask, so this steers real negotiations too, not just the Demand Watch preview.
        Leave the note field to explain why, for your own audit trail below.
      </p>
      <input
        value={q} onChange={(e) => search(e.target.value)} placeholder="Search player by name…"
        className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm mb-3"
      />
      {msg && <p className={`text-sm mb-2 ${msgOk ? "text-emerald-400" : "text-rose-400"}`}>{msg}</p>}
      {rows.length > 0 && (
        <div className="divide-y divide-slate-800/50">
          {rows.map((p) => {
            const hasOverride = TERMS.some((t) => p.ladder[t] != null);
            return (
              <div key={p.id} className="py-3 flex flex-wrap items-center gap-3 text-sm">
                <div className="min-w-[180px]">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.teamName ?? "—"} · {p.isGoalie ? "G" : p.position}</div>
                </div>
                <div className="text-xs text-slate-500 w-24">Current: {p.capHit ? money(p.capHit) : "—"}</div>
                <div className="flex items-center gap-2">
                  {TERMS.map((t) => (
                    <label key={t} className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] text-slate-500">{t}yr $</span>
                      <input
                        type="number" step={50000} placeholder="7500000 or 7.5"
                        defaultValue={p.ladder[t] ?? ""}
                        onChange={(e) => setDraft(p.id, t, e.target.value)}
                        className="w-24 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-right tabular-nums text-xs"
                      />
                    </label>
                  ))}
                </div>
                {hasOverride && <span className="text-[10px] font-bold text-amber-400 uppercase">override active</span>}
                <input
                  placeholder="note (optional)"
                  onChange={(e) => setNotes((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  className="flex-1 min-w-[120px] bg-slate-900 border border-slate-700 rounded px-2 py-1"
                />
                <button onClick={() => save(p.id, p.ladder)} disabled={pending}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold disabled:opacity-50">
                  Save
                </button>
                {hasOverride && (
                  <button onClick={() => clear(p.id)} disabled={pending}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-400">
                    Clear
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {q.trim().length >= 2 && rows.length === 0 && !pending && (
        <p className="text-sm text-slate-500">No player matches "{q}".</p>
      )}
    </Card>
  );
}
