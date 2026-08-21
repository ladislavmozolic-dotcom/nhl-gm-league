"use client";

import { useState, useTransition, useRef } from "react";
import { addToBoardAction, removeFromBoardAction, updateNoteAction, saveQueueOrderAction, searchProspectsAction, type SearchHit } from "@/app/draft/rankings/actions";
import type { BoardRow } from "@/lib/draft-rankings-server";

const posColor: Record<string, string> = { C: "text-sky-400", LW: "text-emerald-400", RW: "text-emerald-400", D: "text-amber-400", G: "text-rose-400" };

function Note({ row, onSave, disabled }: { row: BoardRow; onSave: (note: string, tier: string) => void; disabled: boolean }) {
  const [note, setNote] = useState(row.note ?? "");
  const [tier, setTier] = useState(row.tier ?? "");
  const dirty = note !== (row.note ?? "") || tier !== (row.tier ?? "");
  return (
    <div className="flex items-start gap-2 mt-1">
      <input value={tier} onChange={(e) => setTier(e.target.value)} disabled={disabled} placeholder="tier"
        className="w-16 shrink-0 bg-slate-950/60 border border-slate-800 rounded px-1.5 py-1 text-[11px] text-amber-300 placeholder:text-slate-700 outline-none focus:border-amber-500/50" />
      <textarea value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => dirty && onSave(note, tier)} disabled={disabled}
        rows={1} placeholder="scouting note…"
        className="flex-1 resize-y bg-slate-950/60 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-300 placeholder:text-slate-700 outline-none focus:border-blue-500/50" />
      {dirty && <button onClick={() => onSave(note, tier)} disabled={disabled} className="shrink-0 text-[10px] font-semibold px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white">save</button>}
    </div>
  );
}

export default function DraftBoardManager({ year, years, rows, canEdit }: { year: number; years: number[]; rows: BoardRow[]; canEdit: boolean }) {
  const [queue, setQueue] = useState<BoardRow[]>(rows.filter((r) => r.rank > 0));
  const [bench, setBench] = useState<BoardRow[]>(rows.filter((r) => r.rank === 0));
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

  const persistQueue = (next: BoardRow[]) => { setQueue(next); start(async () => { await saveQueueOrderAction(next.map((r) => r.prospectId)); }); };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= queue.length) return;
    const next = [...queue]; [next[i], next[j]] = [next[j], next[i]]; persistQueue(next);
  };
  const toQueue = (row: BoardRow) => { setBench((b) => b.filter((x) => x.prospectId !== row.prospectId)); persistQueue([...queue, { ...row, rank: queue.length + 1 }]); };
  const toBench = (row: BoardRow) => { const next = queue.filter((x) => x.prospectId !== row.prospectId); setBench((b) => [{ ...row, rank: 0 }, ...b]); persistQueue(next); };
  const removeRow = (row: BoardRow) => {
    setQueue((Q) => { const next = Q.filter((x) => x.prospectId !== row.prospectId); if (Q.some((x) => x.prospectId === row.prospectId)) start(async () => { await saveQueueOrderAction(next.map((r) => r.prospectId)); }); return next; });
    setBench((b) => b.filter((x) => x.prospectId !== row.prospectId));
    start(async () => { await removeFromBoardAction(row.prospectId); });
  };
  const saveNote = (row: BoardRow, note: string, tier: string) => {
    const patch = (arr: BoardRow[]) => arr.map((x) => x.prospectId === row.prospectId ? { ...x, note: note || null, tier: tier || null } : x);
    setQueue(patch); setBench(patch);
    start(async () => { await updateNoteAction(row.prospectId, note, tier); });
  };

  const runSearch = () => {
    const id = ++seq.current; setSearching(true);
    start(async () => { const r = await searchProspectsAction(year, q); if (id === seq.current) { setHits(r.hits ?? []); setSearching(false); } });
  };
  const add = (hit: SearchHit) => {
    setHits((h) => h ? h.map((x) => x.id === hit.id ? { ...x, onBoard: true } : x) : h);
    setBench((b) => b.some((x) => x.prospectId === hit.id) ? b : [{ prospectId: hit.id, rank: 0, tier: null, note: null, name: hit.name, position: hit.position, country: hit.country, amateurLeague: hit.amateurLeague, amateurClub: null, shoots: null, heightIn: null, weightLb: null, ov: hit.ov, potential: hit.potential, csRank: hit.csRank, flag: hit.flag, drafted: hit.drafted, draftedByCode: null }, ...b]);
    start(async () => { await addToBoardAction(hit.id); });
  };

  const Meta = ({ r }: { r: BoardRow }) => (
    <span className="text-[11px] text-slate-500">OV {r.ov} · CEIL {r.potential}{r.csRank ? ` · CS#${r.csRank}` : ""}{r.amateurLeague ? ` · ${r.amateurLeague}` : ""}{r.drafted ? <span className="text-red-400/80"> · DRAFTED{r.draftedByCode ? ` ${r.draftedByCode}` : ""}</span> : ""}</span>
  );

  return (
    <div className="space-y-6">
      {/* year selector */}
      {years.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500 mr-1">Draft class:</span>
          {years.map((y) => (
            <a key={y} href={`/draft/rankings?year=${y}`} className={`px-3 py-1 rounded-lg text-sm font-semibold border ${y === year ? "border-blue-500 bg-blue-600 text-white" : "border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-600"}`}>{y}</a>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* QUEUE */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-300">🎯 Draft Queue <span className="text-slate-600 font-normal">({queue.length})</span></h2>
            <span className="text-[11px] text-slate-500">auto-pick order</span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 divide-y divide-slate-800/60">
            {queue.length === 0 && <p className="px-3 py-6 text-center text-slate-600 text-sm">Queue is empty. Add players from your board (→) or search below. When your pick nears the clock, the top still-available player here is auto-drafted.</p>}
            {queue.map((r, i) => (
              <div key={r.prospectId} className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 text-center text-sm font-black text-blue-400 tabular-nums">{i + 1}</span>
                  <span className="mr-0.5">{r.flag}</span>
                  <span className="font-medium text-slate-100 truncate">{r.name}</span>
                  <span className={`text-xs font-semibold ${posColor[r.position] ?? "text-slate-400"}`}>{r.position}</span>
                  {r.tier && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">{r.tier}</span>}
                  {canEdit && (
                    <span className="ml-auto flex items-center gap-1">
                      <button onClick={() => move(i, -1)} disabled={pending || i === 0} className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 text-xs">▲</button>
                      <button onClick={() => move(i, 1)} disabled={pending || i === queue.length - 1} className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 text-xs">▼</button>
                      <button onClick={() => toBench(r)} disabled={pending} title="Move to board (un-queue)" className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs">board</button>
                      <button onClick={() => removeRow(r)} disabled={pending} title="Remove" className="px-2 py-0.5 rounded bg-rose-950/50 hover:bg-rose-900/50 text-rose-300 text-xs">✕</button>
                    </span>
                  )}
                </div>
                <div className="pl-8"><Meta r={r} />{canEdit && <Note row={r} onSave={(n, t) => saveNote(r, n, t)} disabled={pending} />}</div>
              </div>
            ))}
          </div>
        </section>

        {/* BOARD / WATCHLIST */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-300 mb-2">📋 Watchlist <span className="text-slate-600 font-normal">({bench.length})</span></h2>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 divide-y divide-slate-800/60 max-h-[520px] overflow-y-auto">
            {bench.length === 0 && <p className="px-3 py-6 text-center text-slate-600 text-sm">Scouted players you haven&apos;t queued yet show here. Search below to add prospects.</p>}
            {bench.map((r) => (
              <div key={r.prospectId} className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="mr-0.5">{r.flag}</span>
                  <span className="font-medium text-slate-100 truncate">{r.name}</span>
                  <span className={`text-xs font-semibold ${posColor[r.position] ?? "text-slate-400"}`}>{r.position}</span>
                  {r.tier && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">{r.tier}</span>}
                  {canEdit && (
                    <span className="ml-auto flex items-center gap-1">
                      <button onClick={() => toQueue(r)} disabled={pending} title="Add to draft queue" className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold">→ Queue</button>
                      <button onClick={() => removeRow(r)} disabled={pending} title="Remove" className="px-2 py-0.5 rounded bg-rose-950/50 hover:bg-rose-900/50 text-rose-300 text-xs">✕</button>
                    </span>
                  )}
                </div>
                <div><Meta r={r} />{canEdit && <Note row={r} onSave={(n, t) => saveNote(r, n, t)} disabled={pending} />}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* SEARCH & ADD */}
      {canEdit && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-300 mb-2">🔎 Add players</h2>
          <div className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Search the draft class by name, league or club…"
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500 outline-none" />
            <button onClick={runSearch} disabled={pending || q.trim().length < 2} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold">{searching ? "…" : "Search"}</button>
          </div>
          {hits != null && (
            <div className="mt-2 rounded-xl border border-slate-800 bg-slate-900/40 divide-y divide-slate-800/60 max-h-[360px] overflow-y-auto">
              {hits.length === 0 && <p className="px-3 py-4 text-center text-slate-600 text-sm">No matches in the {year} class.</p>}
              {hits.map((h) => (
                <div key={h.id} className="flex items-center gap-2 px-3 py-2">
                  <span>{h.flag}</span>
                  <span className="font-medium text-slate-100 truncate">{h.name}</span>
                  <span className={`text-xs font-semibold ${posColor[h.position] ?? "text-slate-400"}`}>{h.position}</span>
                  <span className="text-[11px] text-slate-500 truncate">OV {h.ov} · CEIL {h.potential}{h.amateurLeague ? ` · ${h.amateurLeague}` : ""}{h.drafted ? " · drafted" : ""}</span>
                  <button onClick={() => add(h)} disabled={pending || h.onBoard} className="ml-auto px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold">{h.onBoard ? "on board" : "+ Add"}</button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
