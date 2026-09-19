"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type ExpBoardPlayer = { id: number; name: string; position: string; isGoalie: boolean; overall: number | null; posGroup: "F" | "D" | "G" };

const POS_FILTERS = ["ALL", "F", "D", "G"] as const;

export default function ExpansionDraftBoard({
  expansionTeamId, sourceTeam, players, onPick,
}: {
  expansionTeamId: number;
  sourceTeam: { name: string; code: string | null; logoUrl: string | null } | null;
  players: ExpBoardPlayer[];
  onPick: (expansionTeamId: number, playerId: number) => Promise<{ ok: boolean; error?: string; done?: boolean }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof POS_FILTERS)[number]>("ALL");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => players
    .filter((p) => filter === "ALL" || p.posGroup === filter)
    .filter((p) => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0)), [players, filter, search]);

  const confirm = confirmId != null ? players.find((p) => p.id === confirmId) ?? null : null;

  const pick = (playerId: number) => {
    setErr(null);
    start(async () => {
      const res = await onPick(expansionTeamId, playerId);
      if (!res.ok) setErr(res.error || "Pick failed.");
      else { setConfirmId(null); router.refresh(); }
    });
  };

  return (
    <div className="space-y-4">
      {sourceTeam && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-700/50 bg-amber-950/20 px-4 py-3">
          {sourceTeam.logoUrl && <img src={sourceTeam.logoUrl} alt="" className="w-10 h-10 object-contain" />}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-amber-400">On the clock</div>
            <div className="font-bold text-slate-100">{sourceTeam.name}</div>
          </div>
          <div className="ml-auto text-xs text-slate-400">{players.length} exposed</div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {POS_FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filter === f ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}>{f}</button>
        ))}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search player…"
          className="ml-auto px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm w-48" />
      </div>

      {err && <p className="text-sm text-red-400">{err}</p>}

      <div className="space-y-1 max-h-[28rem] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No exposed players match.</p>
        ) : filtered.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-800 px-3 py-2 text-sm hover:border-slate-700">
            <span className="w-6 text-center text-[10px] font-bold text-slate-500">{p.posGroup}</span>
            <span className="flex-1 truncate text-slate-100">{p.name}</span>
            <span className="text-xs text-slate-500">{p.position}</span>
            {p.overall != null && <span className="w-10 text-right text-xs text-slate-500 tabular-nums">{p.overall} OV</span>}
            <button type="button" disabled={pending} onClick={() => setConfirmId(p.id)}
              className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold">Pick</button>
          </div>
        ))}
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setConfirmId(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-slate-100">Draft <span className="font-bold">{confirm.name}</span>{sourceTeam ? ` from ${sourceTeam.name}` : ""}?</p>
            <div className="flex gap-3">
              <button type="button" disabled={pending} onClick={() => pick(confirm.id)} className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold">{pending ? "Drafting…" : "Yes, draft"}</button>
              <button type="button" onClick={() => setConfirmId(null)} className="flex-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold">No</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
