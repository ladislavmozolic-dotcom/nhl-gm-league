"use client";

import { useState, useTransition } from "react";
import { setPlayerBlockAction, setTeamNeedsAction } from "@/app/trade-block/actions";
import { NEED_POSITIONS, type BlockPlayer } from "@/lib/trade-block-server";

type Row = BlockPlayer & { onBlock: boolean };

export default function TradeBlockManager({ teamId, teamName, initialNeeds, players }: { teamId: number; teamName: string; initialNeeds: string[]; players: Row[] }) {
  const [needs, setNeeds] = useState<string[]>(initialNeeds);
  const [rows, setRows] = useState<Row[]>(players);
  const [, start] = useTransition();
  const [savingNeeds, setSavingNeeds] = useState(false);

  const toggleNeed = (pos: string) => {
    const next = needs.includes(pos) ? needs.filter((n) => n !== pos) : [...needs, pos];
    setNeeds(next); setSavingNeeds(true);
    start(async () => { await setTeamNeedsAction(teamId, next).catch(() => {}); setSavingNeeds(false); });
  };

  const toggleBlock = (id: number) => {
    const row = rows.find((r) => r.id === id); if (!row) return;
    const on = !row.onBlock;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, onBlock: on } : r)));
    start(async () => { await setPlayerBlockAction(id, on, row.note ?? "").catch(() => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, onBlock: !on } : r)))); });
  };

  const saveNote = (id: number, note: string) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, note } : r)));
    const row = rows.find((r) => r.id === id); if (!row?.onBlock) return;
    start(async () => { await setPlayerBlockAction(id, true, note).catch(() => {}); });
  };

  const onBlock = rows.filter((r) => r.onBlock);

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">{teamName} — positions you&apos;re shopping for {savingNeeds && <span className="text-slate-600">· saving…</span>}</div>
        <div className="flex flex-wrap gap-2">
          {NEED_POSITIONS.map((pos) => (
            <button key={pos} onClick={() => toggleNeed(pos)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${needs.includes(pos) ? "bg-sky-600 border-sky-500 text-white" : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"}`}>
              {pos}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Your roster — toggle a player onto the block ({onBlock.length} listed)</div>
        <div className="rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800/60">
          {rows.map((r) => (
            <div key={r.id} className={`flex items-center gap-3 px-3 py-2 ${r.onBlock ? "bg-amber-950/15" : "bg-slate-900/40"}`}>
              <button onClick={() => toggleBlock(r.id)}
                className={`w-16 shrink-0 text-xs font-bold rounded-md py-1 border ${r.onBlock ? "bg-amber-600 border-amber-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400"}`}>
                {r.onBlock ? "LISTED" : "List"}
              </button>
              <div className="w-40 shrink-0 min-w-0">
                <div className="truncate text-sm font-medium">{r.name}</div>
                <div className="text-[11px] text-slate-500">{r.position} · {r.overall ?? "—"} OV{r.age ? ` · ${r.age}y` : ""}</div>
              </div>
              <input
                defaultValue={r.note ?? ""} placeholder={r.onBlock ? "asking price / note…" : "list to add a note"}
                disabled={!r.onBlock} onBlur={(e) => saveNote(r.id, e.target.value)}
                className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm disabled:opacity-40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
