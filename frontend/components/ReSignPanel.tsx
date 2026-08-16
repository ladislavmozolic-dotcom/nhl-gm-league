"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getInterestAction, extendContractAction } from "@/app/free-agents/actions";
import { Card } from "@/components/ui";
import { cleanName } from "@/lib/playerName";
import { clauseDiscount } from "@/lib/free-agency";

type ExpiringPlayer = { id: number; name: string; capHit: number | null; contractYears: number | null; contractText: string | null; farm?: boolean };

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
  const [grantClause, setGrantClause] = useState("");
  const [breadth, setBreadth] = useState(12);
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

  const router = useRouter();
  const [result, setResult] = useState<{ salary: number; years: number } | null>(null);
  const submit = () => start(async () => {
    setMsg(null);
    const salary = Math.round(parseFloat(salaryM) * 1e6);
    if (!Number.isFinite(salary)) { setMsg({ t: "err", s: "Enter a salary." }); return; }
    const r = await extendContractAction(player.id, teamId, salary, years, line, pp, pk, grantClause || null, grantClause === "M_NTC" ? breadth : null);
    // don't refresh yet — that would unmount this modal before the confirmation shows;
    // refresh when the GM closes it (Done button).
    if (r.ok) { setResult({ salary: r.salary, years: r.years }); setDone(true); return; }
    const rr = r as { walked?: boolean; rejected?: boolean; reason?: string; error?: string };
    if (rr.walked) { setDone(true); setMsg({ t: "err", s: rr.reason ?? "He walked away." }); return; }
    setMsg({ t: "err", s: rr.rejected ? (rr.reason ?? "") : (rr.error ?? "Failed.") });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">Re-sign {cleanName(player.name)}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">Current: {player.contractText ?? (player.capHit ? `${M(player.capHit)} × ${player.contractYears}yr` : "—")}</p>

        {done && result && (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">✅</div>
            <div className="text-xs uppercase tracking-wide text-emerald-400/80">Contract signed</div>
            <div className="text-2xl font-black text-white mt-1">{cleanName(player.name)}</div>
            <div className="text-lg text-emerald-400 font-bold mt-1 tabular-nums">{M(result.salary)} × {result.years}yr</div>
            <div className="text-xs text-slate-500 mt-1">stays with the club through {new Date().getUTCFullYear()}</div>
            <button onClick={() => { router.refresh(); onClose(); }} className="mt-6 px-8 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-bold">Done</button>
          </div>
        )}
        {done && !result && (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🚪</div>
            <div className="text-lg font-bold text-white">{cleanName(player.name)} walked away</div>
            <div className="text-sm text-amber-300 mt-1 max-w-xs mx-auto">{msg?.s}</div>
            <button onClick={() => { router.refresh(); onClose(); }} className="mt-6 px-8 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold">Close</button>
          </div>
        )}

        {pending && !i && <p className="text-slate-500 text-sm py-3">Loading…</p>}

        {!done && i && (
          <>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 mb-3 text-sm">
              <p className="text-slate-300">Sees himself as your <b className="text-blue-300">{slotLabels[i.slot] ?? "—"}</b> · wants {i.wantPP ? "PP" : "no PP"} · {i.wantPK ? "PK" : "no PK"}</p>
              <p className="mt-1 text-slate-200">He&apos;s looking for roughly <b className="text-amber-300">{M(i.floor * 0.97)}–{M(i.askSalary * 1.08)}</b> <span className="text-slate-500">· term negotiable {i.minYears}-{i.maxYears}yr (more years = more money)</span></p>
              {i.moraleNote && <p className={`mt-1 text-xs font-medium ${i.moraleNote.startsWith("Happy") ? "text-emerald-400" : "text-amber-400"}`}>{i.moraleNote.startsWith("Happy") ? "😀 " : "😕 "}{i.moraleNote}</p>}
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
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setYears((y) => Math.max(1, y - 1))} className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-lg leading-none">−</button>
                      <div className="flex-1 text-center py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm tabular-nums font-semibold">{years} yr</div>
                      <button type="button" onClick={() => setYears((y) => Math.min(4, y + 1))} className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-lg leading-none">+</button>
                    </div>
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
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Grant a no-trade clause (he signs for less)</label>
                  <div className="flex gap-2 items-center flex-wrap">
                    <select value={grantClause} onChange={(e) => setGrantClause(e.target.value)} className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm">
                      <option value="">No clause</option>
                      <option value="NTC">NTC — no-trade</option>
                      <option value="NMC">NMC — no-movement</option>
                      <option value="M_NTC">M-NTC — modified</option>
                    </select>
                    {grantClause === "M_NTC" && (
                      <select value={breadth} onChange={(e) => setBreadth(Number(e.target.value))} className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm">
                        {[6, 12, 18, 24].map((n) => <option key={n} value={n}>{n}-team list</option>)}
                      </select>
                    )}
                    {grantClause && <span className="text-xs text-emerald-400">≈ {Math.round(clauseDiscount(grantClause, breadth) * 100)}% cheaper</span>}
                  </div>
                </div>
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
  // hold the OPEN PLAYER OBJECT, not just an id — the server action's revalidatePath
  // re-renders this list without the just-signed player, and a find(openId) would go
  // undefined and tear the modal down before its confirmation shows.
  const [openPlayer, setOpenPlayer] = useState<ExpiringPlayer | null>(null);
  if (players.length === 0 && !openPlayer) return null;
  return (
    <Card title={`${title ?? "Expiring Contracts"} (${players.length})`} accent={accent}>
      <p className="text-xs text-slate-500 mb-3">{blurb ?? "These players are entering the final year of their deal. Re-sign them before they reach free agency."}</p>
      <div className="divide-y divide-slate-800/50">
        {players.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-2 gap-3">
            <div className="min-w-0">
              <span className="font-medium truncate">{cleanName(p.name)}</span>
              {p.farm && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30">AHL</span>}
              <span className="text-xs text-slate-500 ml-2">{p.contractText ?? (p.capHit ? `${M(p.capHit)} × ${p.contractYears}yr` : "—")}</span>
            </div>
            <button onClick={() => setOpenPlayer(p)}
              className="px-3 py-1 rounded-md bg-green-600/80 hover:bg-green-500 text-white text-xs font-semibold whitespace-nowrap">
              Re-sign
            </button>
          </div>
        ))}
      </div>
      {openPlayer && <ReSignModal player={openPlayer} teamId={teamId} onClose={() => setOpenPlayer(null)} />}
    </Card>
  );
}
