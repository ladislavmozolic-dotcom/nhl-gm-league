"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getInterestAction, getPlayerOffersAction, submitOfferAction, withdrawOfferAction, getAskAtAction,
} from "@/app/free-agents/actions";
import { clauseDiscount } from "@/lib/free-agency";
import InfoTip from "@/components/InfoTip";

export type InterestCtx = {
  frenzyOpen: boolean;          // FA market open (Frenzy, regular season, or playoffs)
  immediate?: boolean;          // in-season: an acceptable offer signs on the spot
  ownOnly?: boolean;            // playoffs: only a club's own UFAs
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
  const [result, setResult] = useState<{ t: "ok" | "err"; s: string } | null>(null); // post-offer response — shown as a dialog you dismiss with Continue

  // offer form
  const [salaryM, setSalaryM] = useState("");
  const [years, setYears] = useState(1);
  const [line, setLine] = useState(2);
  const [pp, setPp] = useState(false);
  const [pk, setPk] = useState(false);
  const [grantClause, setGrantClause] = useState("");
  const [breadth, setBreadth] = useState(12);
  const [twoWay, setTwoWay] = useState(false);
  const [liveAsk, setLiveAsk] = useState<Awaited<ReturnType<typeof getAskAtAction>>>(null);

  // the ask reacts to the promised role (a worse line / stripped PP-PK raises it)
  // AND to a granted clause (he signs for less)
  useEffect(() => {
    if (!teamId || !(info && info.ok)) return;
    let cancelled = false;
    getAskAtAction(playerId, teamId, line, pp, pk, grantClause || null, grantClause === "M_NTC" ? breadth : null).then((r) => { if (!cancelled) setLiveAsk(r); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, pp, pk, teamId, info, grantClause, breadth]);

  const load = (tid: number) => start(async () => {
    setMsg(null);
    const [i, o] = await Promise.all([getInterestAction(playerId, tid), getPlayerOffersAction(playerId)]);
    setInfo(i); setOffers(o);
    if (i.ok) {
      const ex = i.existing;
      // pre-fill only with the club's OWN previous offer; a fresh offer starts blank so
      // the GM has to judge the range himself (we no longer hand him the exact ask).
      setSalaryM(ex && ex.status !== "COUNTERED" ? (ex.salary / 1e6).toFixed(2) : "");
      setYears(ex?.years ?? i.askYears);
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
      const r = await submitOfferAction(playerId, teamId, salary, years, line, pp, pk, grantClause || null, grantClause === "M_NTC" ? breadth : null, twoWay);
      if (!r.ok) { setResult({ t: "err", s: r.error }); return; }
      if ("deliberating" in r && r.deliberating) {
        const when = new Date(r.decisionAt).toLocaleDateString();
        const raised = "raised" in r && r.raised;
        setResult({ t: "ok", s: `${raised ? "Offer raised" : "Offer placed"} — ${name} is taking time to weigh his offers${r.countered ? " and has already countered his suitors (match to stay in it)" : ""}. He'll decide around ${when}; other clubs can keep bidding until then.${r.clears ? " Your terms clear his ask. ✓" : ""}` });
      } else if ("signed" in r && r.signed) {
        setResult({ t: "ok", s: `✅ ${name} signed!` });
      } else if ("signed" in r && r.signed === false) {
        setResult({ t: "err", s: `Below his ask — he wants at least ${M("floor" in r ? r.floor : 0)}. Raise the offer to sign him now.` });
      } else {
        const raised = "raised" in r && r.raised;
        setResult({ t: "ok", s: r.clears ? `Offer ${raised ? "raised" : "placed"} — clears his ask at your club. ✓` : `Offer ${raised ? "raised" : "placed"} — below his floor ${M("floor" in r ? r.floor : 0)}; he may pick a better one.` });
      }
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
      {result && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4" onClick={() => setResult(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-[#0e1e35] p-6 shadow-2xl shadow-black/50" onClick={(e) => e.stopPropagation()}>
            <div className={`text-2xl mb-2 ${result.t === "ok" ? "text-emerald-400" : "text-amber-400"}`}>{result.t === "ok" ? "✓" : "!"}</div>
            <p className="text-sm text-slate-200 leading-relaxed">{result.s}</p>
            <button onClick={() => setResult(null)} autoFocus
              className="mt-5 w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm text-white">Continue</button>
          </div>
        </div>
      )}
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
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-3 text-sm space-y-1">
                    <div className="flex items-center justify-between"><span className="text-slate-400">Your offer</span><b className="text-slate-200 tabular-nums">{M(i.existing.salary)} × {i.existing.years}yr</b></div>
                    <div className="flex items-center justify-between"><span className="text-blue-300 font-semibold">His counter</span><b className="text-amber-300 tabular-nums">{M(i.existing.counterSalary ?? 0)} × {i.existing.counterYears}yr</b></div>
                    <p className="text-[11px] text-slate-500 pt-0.5">Match or beat his counter to stay in it.</p>
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
                      <InfoTip text="Based on the player's morale (MO). An unhappy player holds out for more money than his baseline ask; a happy one signs for a little less. A bigger star swings this harder." />
                    </p>
                  )}
                  {i.existing?.status === "COUNTERED" ? (
                    <p className="mt-2 text-slate-200">He countered around <b className="text-amber-300">{M((i.existing.counterSalary ?? 0) * 0.97)}–{M((i.existing.counterSalary ?? 0) * 1.06)}</b> <span className="text-slate-500">× {i.existing.counterYears}yr</span>
                      <InfoTip text="His counter after your last offer — a rough range, his agent won't name an exact figure. Land in it (or above) and he signs." />
                    </p>
                  ) : (
                    <p className="mt-2 text-slate-200">
                      {liveAsk && (liveAsk.askSalary !== i.askSalary || liveAsk.askYears !== i.askYears)
                        ? <>At <b className="text-slate-300">{slotLabels[["", "L1", "L2", "L3", "L4"][line] ?? ""] ?? `line ${line}`}</b>{!pp && i.wantPP ? ", no PP" : ""}{!pk && i.wantPK ? ", no PK" : ""} he&apos;s looking for </>
                        : <>Looking for roughly </>}
                      <b className="text-amber-300">{M((liveAsk ?? i).floor * 0.95)}–{M((liveAsk ?? i).askSalary * 1.08)}</b>{" "}
                      <span className="text-slate-500">· term {(liveAsk ?? i).minYears}-{(liveAsk ?? i).maxYears}yr (longer = more)</span>
                      <InfoTip text="A rough range — his agent won't name an exact floor, so you have to gauge the market. Offer in the range (or above) and he signs; a lowball draws a counter. Longer term costs more." />
                    </p>
                  )}
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
                      <label className="text-xs text-slate-400 block mb-1">Contract type<InfoTip text="One-way pays the same in NHL or AHL. Two-way pays less on the farm. An established player past 25 (30+ NHL games last season) won't take one — but from round 2 on, a veteran who drew no round-1 offer will settle. Young players sign two-ways freely. One year only." /></label>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => setTwoWay(false)} className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border ${!twoWay ? "bg-blue-600 text-white border-blue-500" : "bg-slate-800 text-slate-400 border-slate-700"}`}>One-way</button>
                        <button type="button" onClick={() => setTwoWay(true)} className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border ${twoWay ? "bg-blue-600 text-white border-blue-500" : "bg-slate-800 text-slate-400 border-slate-700"}`}>Two-way</button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Grant a no-trade clause (optional — he signs for less)</label>
                      <div className="flex gap-2 items-center flex-wrap">
                        <select value={grantClause} onChange={(e) => setGrantClause(e.target.value)}
                          className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm">
                          <option value="">No clause</option>
                          <option value="NTC">NTC — no-trade</option>
                          <option value="NMC">NMC — no-movement</option>
                          <option value="M_NTC">M-NTC — modified</option>
                        </select>
                        {grantClause === "M_NTC" && (
                          <select value={breadth} onChange={(e) => setBreadth(Number(e.target.value))}
                            className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm">
                            {[6, 12, 18, 24].map((n) => <option key={n} value={n}>{n}-team list</option>)}
                          </select>
                        )}
                        {grantClause && <span className="text-xs text-emerald-400">≈ {Math.round(clauseDiscount(grantClause, breadth) * 100)}% cheaper to sign</span>}
                      </div>
                    </div>
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
                      {offers.map((o) => {
                        const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
                        const raised = o.updatedAt !== o.placedAt;
                        return (
                          <div key={o.teamId} className="flex items-center justify-between gap-3 text-sm bg-slate-800/40 rounded px-2 py-1">
                            <span className="font-semibold shrink-0">{o.teamCode}</span>
                            <span className="tabular-nums text-slate-300 flex-1 text-right">{M(o.salary)} × {o.years}yr · L{o.line}{o.pp ? " PP" : ""}{o.pk ? " PK" : ""}</span>
                            <span className="text-[11px] text-slate-500 shrink-0 whitespace-nowrap" title={raised ? `Placed ${fmt(o.placedAt)} · raised ${fmt(o.updatedAt)}` : `Placed ${fmt(o.placedAt)}`}>
                              🕒 {fmt(o.updatedAt)}{raised ? " (raised)" : ""}
                            </span>
                          </div>
                        );
                      })}
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
