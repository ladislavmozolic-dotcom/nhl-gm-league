"use client";

import { useState, useMemo, useTransition } from "react";
import { makePickAction } from "@/app/draft/room/actions";
import EpHoverName from "@/components/EpHoverName";

export type BoardProspect = {
  id: number; name: string; position: string; country: string | null; shoots: string | null; amateurLeague: string | null; amateurClub: string | null; flag: string;
  heightIn: number | null; weightLb: number | null;
};

const posColor: Record<string, string> = { C: "text-sky-400", LW: "text-emerald-400", RW: "text-emerald-400", D: "text-amber-400", G: "text-rose-400" };

export type OnClock = { teamName: string; teamLogo: string | null; pick: number };

export default function DraftAvailableBoard({ prospects, canPick, onClock }: { prospects: BoardProspect[]; canPick: boolean; onClock?: OnClock }) {
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<string>("ALL");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: number; name: string } | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return prospects.filter((p) =>
      (pos === "ALL" || (pos === "F" ? ["C", "LW", "RW"].includes(p.position) : p.position === pos)) &&
      (!needle || p.name.toLowerCase().includes(needle) || (p.amateurLeague ?? "").toLowerCase().includes(needle))
    );
  }, [prospects, q, pos]);

  const pick = (id: number, name: string) => start(async () => {
    setMsg(null);
    const r = await makePickAction(id);
    // the announcement itself is broadcast to everyone by <DraftAnnouncer/> (polling)
    setMsg(r.ok ? `✓ Drafted ${name}` : (r.error ?? "Failed."));
  });

  const POSES = ["ALL", "F", "C", "LW", "RW", "D", "G"];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prospect or league…"
          className="flex-1 min-w-[200px] bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500 outline-none"
        />
        <div className="flex gap-1">
          {POSES.map((p) => (
            <button key={p} onClick={() => setPos(p)} className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border ${pos === p ? "border-blue-500 bg-blue-600 text-white" : "border-slate-800 bg-slate-900/50 text-slate-400 hover:text-slate-200"}`}>{p}</button>
          ))}
        </div>
      </div>
      {msg && <div className={`text-sm px-3 py-2 rounded-lg ${msg.startsWith("✓") ? "bg-emerald-950/30 text-emerald-300" : "bg-red-950/30 text-red-300"}`}>{msg}</div>}

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-auto max-h-[520px]">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-800 [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-slate-800">
              <th className="text-left px-3 py-2.5">Prospect</th>
              <th className="text-center px-2 py-2.5">Pos</th>
              <th className="text-left px-3 py-2.5">League</th>
              <th className="text-center px-2 py-2.5">Sh</th>
              {canPick && <th className="px-3 py-2.5"></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 150).map((p) => (
              <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="px-3 py-1.5 font-medium text-slate-100">
                  <EpHoverName player={p} className="inline-flex items-center cursor-help"><span className="mr-1.5">{p.flag}</span>{p.name}</EpHoverName>
                </td>
                <td className={`px-2 py-1.5 text-center font-semibold ${posColor[p.position] ?? "text-slate-400"}`}>{p.position}</td>
                <td className="px-3 py-1.5 text-slate-400">{p.amateurLeague ?? "—"}</td>
                <td className="px-2 py-1.5 text-center text-slate-500">{p.shoots ?? "—"}</td>
                {canPick && (
                  <td className="px-3 py-1.5 text-right">
                    <button onClick={() => setConfirm({ id: p.id, name: p.name })} disabled={pending}
                      className="rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold px-3 py-1">
                      Pick
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-600">Showing {Math.min(150, filtered.length)} of {filtered.length} available. Rest on a name to preview.</p>

      {confirm && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setConfirm(null)}>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-bold text-white">Draft {confirm.name}?</div>
            <div className="text-sm text-slate-400 mt-1.5">Are you sure you want to pick this player?</div>
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => { const c = confirm; setConfirm(null); pick(c.id, c.name); }}
                disabled={pending}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold px-6 py-2"
              >Yes, draft</button>
              <button onClick={() => setConfirm(null)} className="rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-6 py-2">No</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
