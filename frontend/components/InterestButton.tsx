"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getInterestAction, getPlayerOffersAction, submitOfferAction, withdrawOfferAction, getAskAtAction,
} from "@/app/free-agents/actions";

export type InterestCtx = {
  frenzyOpen: boolean;
  actingTeamId: number | null;
  teams: { id: number; code: string; name: string }[];
};

type Interest = Awaited<ReturnType<typeof getInterestAction>>;
type Offers = Awaited<ReturnType<typeof getPlayerOffersAction>>;

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

export default function InterestButton({ playerId, name, ctx }: { playerId: number; name: string; ctx: InterestCtx }) {
  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState<number | null>(ctx.actingTeamId);
  const [info, setInfo] = useState<Interest | null>(null);
  const [offers, setOffers] = useState<Offers>([]);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ t: "ok" | "err"; s: string } | null>(null);

  // offer form
  const [salaryM, setSalaryM] = useState("");
  const [years, setYears] = useState(1);
  const [line, setLine] = useState(2);
  const [pp, setPp] = useState(false);
  const [pk, setPk] = useState(false);
  const [liveAsk, setLiveAsk] = useState<Awaited<ReturnType<typeof getAskAtAction>>>(null);

  // the ask reacts to the promised role: a worse line / stripped PP-PK raises it
  useEffect(() => {
    if (!teamId || !(info && info.ok)) return;
    let cancelled = false;
    getAskAtAction(playerId, teamId, line, pp, pk).then((r) => { if (!cancelled) setLiveAsk(r); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, pp, pk, teamId, info]);

  const load = (tid: number) => start(async () => {
    setMsg(null);
    const [i, o] = await Promise.all([getInterestAction(playerId, tid), getPlayerOffersAction(playerId)]);
    setInfo(i); setOffers(o);
    if (i.ok) {
      const ex = i.existing;
      // if the player countered, pre-fill the form with his counter so the GM can match it
      const startSalary = ex?.status === "COUNTERED" && ex.counterSalary ? ex.counterSalary : (ex?.salary ?? i.askSalary);
      setSalaryM((startSalary / 1e6).toFixed(2));
      setYears(ex?.status === "COUNTERED" && ex.counterYears ? ex.counterYears : (ex?.years ?? i.askYears));
      setLine(ex?.line ?? i.line);
      setPp(ex?.pp ?? i.wantPP);
      setPk(ex?.pk ?? i.wantPK);
    }
  });

  const openModal = () => {
    setOpen(true);
    if (teamId) load(teamId);
  };

  const onTeam = (tid: number) => { setTeamId(tid); load(tid); };

  const submit = () => {
    if (!teamId) return;
    const salary = Math.round(parseFloat(salaryM) * 1e6);
    if (!Number.isFinite(salary)) { setMsg({ t: "err", s: "Enter a salary." }); return; }
    start(async () => {
      const r = await submitOfferAction(playerId, teamId, salary, years, line, pp, pk);
      if (!r.ok) { setMsg({ t: "err", s: r.error }); return; }
      setMsg({ t: "ok", s: r.clears ? `Offer ${r.raised ? "raised" : "placed"} — clears his ask at your club. ✓` : `Offer ${r.raised ? "raised" : "placed"} — below his floor ${M(r.floor)}; he may pick a better one.` });
      load(teamId);
    });
  };

  const withdraw = () => {
    if (!teamId) return;
    start(async () => {
      await withdrawOfferAction(playerId, teamId);
      setMsg({ t: "ok", s: "Offer withdrawn." });
      load(teamId);
    });
  };

  const canOffer = ctx.frenzyOpen && teamId != null;
  const i = info && info.ok ? info : null;
  const grp = i?.grp ?? "F";

  return (
    <>
      <button onClick={openModal} disabled={!ctx.frenzyOpen}
        title={ctx.frenzyOpen ? "Register interest / make an offer" : "Free-agent market is closed"}
        className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap ${ctx.frenzyOpen ? "bg-amber-600/80 hover:bg-amber-500 text-white" : "bg-slate-800 text-slate-600 cursor-not-allowed"}`}>
        Interest
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[88vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold">{name}</h3>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-200 text-xl leading-none">×</button>
            </div>

            {ctx.teams.length > 1 && (
              <div className="mb-3">
                <label className="text-xs text-slate-400 block mb-1">Team</label>
                <select value={teamId ?? ""} onChange={(e) => onTeam(Number(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm">
                  {ctx.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            {pending && !i && <p className="text-slate-500 text-sm py-4">Loading…</p>}

            {i && (
              <>
                {i.existing?.status === "COUNTERED" && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-3 text-sm">
                    <b className="text-blue-300">He countered.</b> He&apos;ll sign with you for <b className="text-amber-300">{M(i.existing.counterSalary ?? 0)} × {i.existing.counterYears}yr</b> — raise your offer to stay in it.
                  </div>
                )}
                {i.existing?.status === "SHORTLISTED" && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-3 text-sm">
                    <b className="text-green-300">You made his shortlist.</b> Final week — sharpen your best offer.
                  </div>
                )}
                {i.existing?.status === "REJECTED" && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3 text-sm text-red-300">He&apos;s moved on — your club is out of the running.</div>
                )}
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 mb-3 text-sm">
                  <p className="text-slate-300">
                    Projects as your <b className="text-blue-300">{slotLabels[i.slot] ?? "—"}</b> ·{" "}
                    <span className={i.contention === "contender" ? "text-green-300" : i.contention === "rebuild" ? "text-amber-300" : "text-slate-300"}>{i.contention}</span>
                  </p>
                  <p className="text-slate-400 mt-1">
                    Wants {i.wantPP ? "PP time" : "no PP"} · {i.wantPK ? "PK time" : "no PK"}
                  </p>
                  {i.moraleNote && (
                    <p className={`mt-1 text-xs font-medium ${i.moraleNote.startsWith("Happy") ? "text-emerald-400" : "text-amber-400"}`}>
                      {i.moraleNote.startsWith("Happy") ? "😀 " : "😕 "}{i.moraleNote}
                    </p>
                  )}
                  <p className="mt-2 text-slate-200">
                    {liveAsk && (liveAsk.askSalary !== i.askSalary || liveAsk.askYears !== i.askYears)
                      ? <>At <b className="text-slate-300">{slotLabels[["", "L1", "L2", "L3", "L4"][line] ?? ""] ?? `line ${line}`}</b>{!pp && i.wantPP ? ", no PP" : ""}{!pk && i.wantPK ? ", no PK" : ""} he wants </>
                      : <>Asking </>}
                    <b className="text-amber-300">{M((liveAsk ?? i).askSalary)} × {(liveAsk ?? i).askYears}yr</b>{" "}
                    <span className="text-slate-500">(floor {M((liveAsk ?? i).floor)}, term {(liveAsk ?? i).minYears}-{(liveAsk ?? i).maxYears}yr)</span>
                  </p>
                </div>

                {canOffer ? (
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
                    <div className="flex gap-2">
                      <button onClick={submit} disabled={pending}
                        className="flex-1 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-sm font-semibold">
                        {i.existing ? "Raise offer" : "Make offer"}
                      </button>
                      {i.existing && (
                        <button onClick={withdraw} disabled={pending}
                          className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-sm">Withdraw</button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">{ctx.frenzyOpen ? "No team selected." : "The free-agent market is closed."}</p>
                )}

                {msg && <div className={`mt-3 text-sm ${msg.t === "ok" ? "text-green-300" : "text-red-300"}`}>{msg.s}</div>}

                {offers.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Standing offers ({offers.length})</div>
                    <div className="space-y-1">
                      {offers.map((o) => (
                        <div key={o.teamId} className="flex items-center justify-between text-sm bg-slate-800/40 rounded px-2 py-1">
                          <span className="font-semibold">{o.teamCode}</span>
                          <span className="tabular-nums text-slate-300">{M(o.salary)} × {o.years}yr · L{o.line}{o.pp ? " PP" : ""}{o.pk ? " PK" : ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
