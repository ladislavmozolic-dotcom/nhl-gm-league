"use client";

import { useMemo, useState, useTransition } from "react";
import PlayerLink from "@/components/PlayerLink";
import Link from "next/link";
import type { RosterRow } from "@/app/teams/[slug]/roster/actions";

type Player = { id: number; name: string; position: string; number: number | null; overall: number; captaincy: "C" | "A" | null; isGoalie: boolean };
type Props = {
  teamName: string; teamSlug: string; players: Player[];
  onSave: (slug: string, rows: RosterRow[]) => Promise<void>;
  embedded?: boolean; // true when rendered under LinesNav (hide the own title/back links)
};

export default function RosterEditor({ teamName, teamSlug, players, onSave, embedded = false }: Props) {
  const [rows, setRows] = useState<Player[]>(players);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (id: number, patch: Partial<Player>) => {
    setRows((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setSaved(false);
  };

  const caps = rows.filter((r) => r.captaincy === "C").length;
  const alts = rows.filter((r) => r.captaincy === "A").length;
  const dupNums = useMemo(() => {
    const seen = new Map<number, number>();
    for (const r of rows) if (r.number != null) seen.set(r.number, (seen.get(r.number) ?? 0) + 1);
    return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([num]) => num));
  }, [rows]);

  const problems: string[] = [];
  if (caps > 1) problems.push("Only one captain (C) allowed.");
  if (alts > 2) problems.push("At most two alternates (A).");
  if (dupNums.size) problems.push(`Duplicate numbers: ${[...dupNums].join(", ")}.`);

  const save = () => start(async () => {
    setErr(null);
    try {
      await onSave(teamSlug, rows.map((r) => ({ id: r.id, number: r.number, captaincy: r.captaincy })));
      setSaved(true);
    } catch (e) { setErr((e as Error).message); }
  });

  const Table = ({ title, list }: { title: string; list: Player[] }) => (
    <div className="mb-6">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400 mb-2">{title}</h2>
      <div className="bg-slate-900/40 border border-slate-800 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-800">
              <th className="text-left px-3 py-2 w-20">Number</th>
              <th className="text-left px-3 py-2">Player</th>
              <th className="text-left px-2 py-2 w-16">Pos</th>
              <th className="text-left px-2 py-2 w-14">OVR</th>
              <th className="text-left px-3 py-2 w-28">Letter</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-b border-slate-800/60">
                <td className="px-3 py-1.5">
                  <input type="number" min={0} max={99} value={p.number ?? ""}
                    onChange={(e) => set(p.id, { number: e.target.value ? Number(e.target.value) : null })}
                    className={`w-16 bg-slate-900 border rounded px-2 py-1 text-right tabular-nums ${p.number != null && dupNums.has(p.number) ? "border-red-500 text-red-300" : "border-slate-700"}`} />
                </td>
                <td className="px-3 py-1.5">
                  <PlayerLink id={p.id} name={p.name} />
                  {p.captaincy && <span className="ml-1.5 text-[10px] font-bold text-amber-400">{p.captaincy}</span>}
                </td>
                <td className="px-2 py-1.5 text-slate-500 text-xs">{p.position}</td>
                <td className="px-2 py-1.5 text-slate-400 tabular-nums">{p.overall}</td>
                <td className="px-3 py-1.5">
                  {!p.isGoalie ? (
                    <select value={p.captaincy ?? ""} onChange={(e) => set(p.id, { captaincy: (e.target.value || null) as "C" | "A" | null })}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm">
                      <option value="">—</option>
                      <option value="C">Captain (C)</option>
                      <option value="A">Alternate (A)</option>
                    </select>
                  ) : <span className="text-slate-600 text-xs">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const skaters = rows.filter((r) => !r.isGoalie);
  const goalies = rows.filter((r) => r.isGoalie);

  return (
    <div className={embedded ? "pb-28" : "max-w-3xl mx-auto px-4 pb-28"}>
      {embedded ? (
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-sm text-slate-400">Set jersey <b className="text-slate-200">numbers</b> and the <b className="text-slate-200">captain (C)</b> / <b className="text-slate-200">alternates (A)</b>.</p>
          <div className="text-xs text-slate-500">Captain: {caps}/1 · Alternates: {alts}/2</div>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">{teamName} — Roster Management</h1>
            <div className="flex gap-3 text-sm mt-1">
              <Link href={`/teams/${teamSlug}`} className="text-slate-400 hover:text-blue-400">← team</Link>
              <Link href={`/teams/${teamSlug}/lines`} className="text-slate-400 hover:text-blue-400">Line editor →</Link>
            </div>
          </div>
          <div className="text-xs text-slate-500">Captain: {caps}/1 · Alternates: {alts}/2</div>
        </div>
      )}

      {problems.length > 0 && (
        <div className="mb-4 text-sm text-red-300 bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2">
          {problems.join(" ")}
        </div>
      )}

      <Table title="Skaters" list={skaters} />
      <Table title="Goaltenders" list={goalies} />

      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/90 border-t border-slate-800 backdrop-blur px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={save} disabled={pending || problems.length > 0}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm disabled:opacity-50">
            {pending ? "Saving…" : "Save roster"}
          </button>
          {problems.length > 0 && <span className="text-red-400 text-sm">Fix issues to save</span>}
          {saved && <span className="text-green-400 text-sm">✓ Saved</span>}
          {err && <span className="text-red-400 text-sm">{err}</span>}
        </div>
      </div>
    </div>
  );
}
