"use client";

import { useEffect, useState, useTransition } from "react";
import { getInterestAction, extendContractAction } from "@/app/free-agents/actions";
import { Card } from "@/components/ui";
import { cleanName } from "@/lib/playerName";

type ExpiringPlayer = { id: number; name: string; capHit: number | null; contractYears: number | null; contractText: string | null };

const M = (n: number) => `$${(n / 1e6).toFixed(2)}M`;
function lineOptions(grp: string) {
  if (grp === "G") return [[1, "Starter"], [2, "Backup"]] as const;
  if (grp === "D") return [[1, "Top pair"], [2, "2nd pair"], [3, "3rd pair"]] as const;
  return [[1, "1st line"], [2, "2nd line"], [3, "3rd line"], [4, "4th line"]] as const;
}
const slotLabels: Record<string, string> = {
  L1: "1st line", L2: "2nd line", L3: "3rd line", L4: "4th line", XF: "extra forward",
  P1: "top pair", P2: "2nd pair", P3: "3rd pair", XD: "7th D", G1: "starter", G2: "backup", G3: "3rd goalie",
};

function ReSignModal({ player, teamId, onClose }: { player: ExpiringPlayer; teamId: number; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [info, setInfo] = useState<Awaited<ReturnType<typeof getInterestAction>> | null>(null);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; s: string } | null>(null);
  const [salaryM, setSalaryM] = useState("");
  const [years, setYears] = useState(2);
  const [line, setLine] = useState(2);
  const [pp, setPp] = useState(false);
  const [pk, setPk] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    start(async () => {
      const i = await getInterestAction(player.id, teamId);
      setInfo(i);
      if (i.ok) {
        setSalaryM((i.askSalary / 1e6).toFixed(2)); setYears(i.askYears);
        setLine(i.line); setPp(i.wantPP); setPk(i.wantPK);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const i = info && info.ok ? info : null;
  const grp = i?.grp ?? "F";

  const submit = () => start(async () => {
    setMsg(null);
    const salary = Math.round(parseFloat(salaryM) * 1e6);
    if (!Number.isFinite(salary)) { setMsg({ t: "err", s: "Enter a salary." }); return; }
    const r = await extendContractAction(player.id, teamId, salary, years, line, pp, pk);
    if (r.ok) { setMsg({ t: "ok", s: `Re-signed for ${M(r.salary)} × ${r.years}yr. ✓` }); setDone(true); return; }
    setMsg({ t: "err", s: (r as any).rejected ? (r as any).reason : r.error });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">Re-sign {cleanName(player.name)}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">Current: {player.contractText ?? (player.capHit ? `${M(player.capHit)} × ${player.contractYears}yr` : "—")}</p>

        {pending && !i && <p className="text-slate-500 text-sm py-3">Loading…</p>}

        {i && (
          <>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 mb-3 text-sm">
              <p className="text-slate-300">Sees himself as your <b className="text-blue-300">{slotLabels[i.slot] ?? "—"}</b> · wants {i.wantPP ? "PP" : "no PP"} · {i.wantPK ? "PK" : "no PK"}</p>
              <p className="mt-1 text-slate-200">Asking <b className="text-amber-300">{M(i.askSalary)} × {i.askYears}yr</b> <span className="text-slate-500">(floor {M(i.floor)}, {i.minYears}-{i.maxYears}yr)</span></p>
            </div>

            {!done && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Salary ($M / yr)</label>
                    <input type="number" step="0.05" min="0.775" value={salaryM} onChange={(e) => setSalaryM(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm tabular-nums" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Term (years)</label>
                    <input type="number" min="1" max="4" value={years} onChange={(e) => setYears(Number(e.target.value))}
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm tabular-nums" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Promised role</label>
                  <select value={line} onChange={(e) => setLine(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm">
                    {lineOptions(grp).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                {grp !== "G" && (
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={pp} onChange={(e) => setPp(e.target.checked)} /> Power play</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={pk} onChange={(e) => setPk(e.target.checked)} /> Penalty kill</label>
                  </div>
                )}
                <button onClick={submit} disabled={pending}
                  className="w-full px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-sm font-semibold">
                  {pending ? "…" : "Offer extension"}
                </button>
              </div>
            )}
            {msg && <div className={`mt-3 text-sm ${msg.t === "ok" ? "text-green-300" : "text-red-300"}`}>{msg.s}</div>}
          </>
        )}
      </div>
    </div>
  );
}

export default function ReSignPanel({ teamId, players, title, blurb, accent = "text-amber-400" }: {
  teamId: number; players: ExpiringPlayer[]; title?: string; blurb?: string; accent?: string;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  if (players.length === 0) return null;
  return (
    <Card title={`${title ?? "Expiring Contracts"} (${players.length})`} accent={accent}>
      <p className="text-xs text-slate-500 mb-3">{blurb ?? "These players are entering the final year of their deal. Re-sign them before they reach free agency."}</p>
      <div className="divide-y divide-slate-800/50">
        {players.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-2 gap-3">
            <div className="min-w-0">
              <span className="font-medium truncate">{cleanName(p.name)}</span>
              <span className="text-xs text-slate-500 ml-2">{p.contractText ?? (p.capHit ? `${M(p.capHit)} × ${p.contractYears}yr` : "—")}</span>
            </div>
            <button onClick={() => setOpenId(p.id)}
              className="px-3 py-1 rounded-md bg-green-600/80 hover:bg-green-500 text-white text-xs font-semibold whitespace-nowrap">
              Re-sign
            </button>
          </div>
        ))}
      </div>
      {openId != null && <ReSignModal player={players.find((p) => p.id === openId)!} teamId={teamId} onClose={() => setOpenId(null)} />}
    </Card>
  );
}
