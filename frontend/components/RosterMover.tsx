"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ROSTER_LIMITS, type MoveRow } from "@/lib/roster-rules";

type Player = {
  id: number; name: string; position: string; overall: number;
  isGoalie: boolean; side: "pro" | "farm"; contractType: "ONE_WAY" | "TWO_WAY" | null;
};
type Props = {
  teamName: string; teamSlug: string; affiliateName: string; hasAffiliate: boolean;
  players: Player[]; onSave: (slug: string, rows: MoveRow[]) => Promise<void>;
};

export default function RosterMover({ teamName, teamSlug, affiliateName, hasAffiliate, players, onSave }: Props) {
  const [rows, setRows] = useState<Player[]>(players);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const byName = (a: Player, b: Player) => a.name.localeCompare(b.name);
  const pro = rows.filter((r) => r.side === "pro").sort(byName);
  const farm = rows.filter((r) => r.side === "farm").sort(byName);
  const goalies = (l: Player[]) => l.filter((p) => p.isGoalie).length;
  const proSkaters = pro.length - goalies(pro);

  const move = (id: number, to: "pro" | "farm") => {
    const p = rows.find((r) => r.id === id)!;
    if (to === "farm" && p.contractType === "ONE_WAY") return; // blocked
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, side: to } : r)));
    setSaved(false); setErr(null);
  };
  const setContract = (id: number, ct: "ONE_WAY" | "TWO_WAY" | null) =>
    { setRows((prev) => prev.map((r) => (r.id === id ? { ...r, contractType: ct } : r))); setSaved(false); };

  const orgGoalies = goalies(pro) + goalies(farm);
  const problems: string[] = [];
  if (pro.length > ROSTER_LIMITS.proMax) problems.push(`Pro over ${ROSTER_LIMITS.proMax} (cap limit).`);
  if (proSkaters < ROSTER_LIMITS.proMinSkaters) problems.push(`Pro needs ≥ ${ROSTER_LIMITS.proMinSkaters} skaters.`);
  if (goalies(pro) < ROSTER_LIMITS.proMinGoalies) problems.push(`Pro needs ≥ ${ROSTER_LIMITS.proMinGoalies} goalies.`);
  if (rows.length > ROSTER_LIMITS.orgMax) problems.push(`Organization over ${ROSTER_LIMITS.orgMax} players.`);
  if (orgGoalies > ROSTER_LIMITS.orgMaxGoalies) problems.push(`Organization over ${ROSTER_LIMITS.orgMaxGoalies} goalies.`);

  const save = () => start(async () => {
    setErr(null);
    try { await onSave(teamSlug, rows.map((r) => ({ id: r.id, side: r.side, contractType: r.contractType }))); setSaved(true); }
    catch (e) { setErr((e as Error).message); }
  });

  const Row = ({ p }: { p: Player }) => {
    const oneWay = p.contractType === "ONE_WAY";
    const toFarm = p.side === "pro";
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-800/60 text-sm hover:bg-slate-800/30">
        <span className="flex-1 min-w-0 truncate">{p.name}
          <span className="text-slate-500 text-xs ml-1">{p.position} · {p.overall}</span>
        </span>
        <button onClick={() => setContract(p.id, oneWay ? "TWO_WAY" : "ONE_WAY")}
          title="Toggle one-way / two-way contract"
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${oneWay ? "border-amber-600/60 text-amber-400" : "border-slate-700 text-slate-400"}`}>
          {oneWay ? "1-way" : "2-way"}
        </button>
        <button onClick={() => move(p.id, toFarm ? "farm" : "pro")}
          disabled={toFarm && oneWay}
          title={toFarm && oneWay ? "One-way contracts can't be sent to the farm" : ""}
          className="text-xs px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30">
          {toFarm ? "→ Farm" : "→ Pro"}
        </button>
      </div>
    );
  };

  const Col = ({ title, sub, list, warn }: { title: string; sub: string; list: Player[]; warn?: boolean }) => (
    <div className="bg-slate-900/40 border border-slate-800 rounded-lg overflow-hidden">
      <div className={`px-3 py-2 border-b border-slate-800 ${warn ? "bg-red-950/40" : "bg-slate-800/40"}`}>
        <div className="font-bold text-sm">{title}</div>
        <div className="text-[11px] text-slate-500">{sub}</div>
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        {list.length === 0 && <div className="px-3 py-3 text-slate-600 text-sm">empty</div>}
        {list.map((p) => <Row key={p.id} p={p} />)}
      </div>
    </div>
  );

  if (!hasAffiliate) return (
    <div className="max-w-2xl mx-auto px-4"><h1 className="text-2xl font-bold mb-2">{teamName} — Rosters</h1>
      <p className="text-slate-400">This team has no AHL affiliate to move players between.</p></div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 pb-28">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">{teamName} — Rosters</h1>
        <div className="flex gap-3 text-sm mt-1">
          <Link href={`/teams/${teamSlug}`} className="text-slate-400 hover:text-blue-400">← team</Link>
          <Link href={`/teams/${teamSlug}/lines`} className="text-slate-400 hover:text-blue-400">Lines →</Link>
          <Link href={`/teams/${teamSlug}/roster/edit`} className="text-slate-400 hover:text-blue-400">Numbers &amp; captains →</Link>
        </div>
        <p className="text-xs text-slate-500 mt-1">Move players between the pro (NHL) and farm (AHL) rosters. One-way contracts can't go to the farm.</p>
      </div>

      {problems.length > 0 && (
        <div className="mb-4 text-sm text-red-300 bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2">{problems.join(" ")}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Col title={`Pro — ${teamName}`} warn={pro.length > ROSTER_LIMITS.proMax || proSkaters < ROSTER_LIMITS.proMinSkaters || goalies(pro) < ROSTER_LIMITS.proMinGoalies}
          sub={`${pro.length}/${ROSTER_LIMITS.proMax} · ${proSkaters} skaters · ${goalies(pro)} G (need 18+2)`} list={pro} />
        <Col title={`Farm — ${affiliateName}`} warn={rows.length > ROSTER_LIMITS.orgMax || orgGoalies > ROSTER_LIMITS.orgMaxGoalies}
          sub={`${farm.length} on farm · org ${rows.length}/${ROSTER_LIMITS.orgMax}, ${orgGoalies}/${ROSTER_LIMITS.orgMaxGoalies} G`} list={farm} />
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/90 border-t border-slate-800 backdrop-blur px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button onClick={save} disabled={pending || problems.length > 0}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm disabled:opacity-50">
            {pending ? "Saving…" : "Save rosters"}
          </button>
          {problems.length > 0 && <span className="text-red-400 text-sm">Fix issues to save</span>}
          {saved && <span className="text-green-400 text-sm">✓ Saved</span>}
          {err && <span className="text-red-400 text-sm">{err}</span>}
        </div>
      </div>
    </div>
  );
}
