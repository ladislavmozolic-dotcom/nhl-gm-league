"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getOsCompPlanAction, submitOfferSheetAction, withdrawOfferSheetAction } from "@/lib/offer-sheet-server";
import { clauseDiscount } from "@/lib/free-agency";
import InfoTip from "@/components/InfoTip";

const M = (n: number) => `$${(n / 1e6).toFixed(2)}M`;

function lineOptions(grp: string) {
  if (grp === "G") return [[1, "Starter"], [2, "Backup"]] as const;
  if (grp === "D") return [[1, "Top pair"], [2, "2nd pair"], [3, "3rd pair"]] as const;
  return [[1, "1st line"], [2, "2nd line"], [3, "3rd line"], [4, "4th line"]] as const;
}

type Plan = Awaited<ReturnType<typeof getOsCompPlanAction>>;

export default function OfferSheetButton({
  playerId, name, grp, fromTeamId, existing,
}: {
  playerId: number; name: string; grp: string; fromTeamId: number;
  existing?: { salary: number; years: number } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ t: "ok" | "err"; s: string } | null>(null);

  const [salaryM, setSalaryM] = useState(existing ? (existing.salary / 1e6).toFixed(2) : "");
  const [years, setYears] = useState(existing?.years ?? 2);
  const [line, setLine] = useState(2);
  const [twoWay, setTwoWay] = useState(false);
  const [grantClause, setGrantClause] = useState("");
  const [breadth, setBreadth] = useState(12);
  const [plan, setPlan] = useState<Plan | null>(null);

  // live compensation preview as the salary changes
  useEffect(() => {
    if (!open) return;
    const salary = Math.round(parseFloat(salaryM) * 1e6);
    if (!Number.isFinite(salary) || salary <= 0) { setPlan(null); return; }
    let cancelled = false;
    getOsCompPlanAction(fromTeamId, salary).then((p) => { if (!cancelled) setPlan(p); });
    return () => { cancelled = true; };
  }, [salaryM, open, fromTeamId]);

  const submit = () => {
    const salary = Math.round(parseFloat(salaryM) * 1e6);
    if (!Number.isFinite(salary) || salary <= 0) { setMsg({ t: "err", s: "Enter a salary." }); return; }
    start(async () => {
      const r = await submitOfferSheetAction(playerId, fromTeamId, salary, years, twoWay, line, false, false, grantClause || null, grantClause === "M_NTC" ? breadth : null);
      if (!r.ok) { setMsg({ t: "err", s: r.error }); return; }
      setMsg({ t: "ok", s: "Offer sheet submitted — he decides by July 10. ✓" });
      router.refresh();
    });
  };

  const withdraw = () => start(async () => {
    const r = await withdrawOfferSheetAction(playerId, fromTeamId);
    if (!r.ok) { setMsg({ t: "err", s: r.error }); return; }
    setMsg({ t: "ok", s: "Offer sheet withdrawn." });
    router.refresh();
  });

  return (
    <>
      <button onClick={() => { setOpen(true); setMsg(null); }}
        className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
        {existing ? "Edit offer sheet" : "Offer Contract"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[88vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold">Offer sheet · {name}</h3>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-200 text-xl leading-none">×</button>
            </div>
            <p className="text-xs text-slate-500 mb-3">He&apos;ll sign it on July 10 only if it clears his ask <b>and</b> beats his own club&apos;s last offer. No counter — one shot.<InfoTip text="The player's own club does not get to match. His agent takes the best offer sheet that both meets his demand and pays more than his current club offered; otherwise he declines and stays to negotiate further with his club." /></p>

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

              {/* compensation preview */}
              {plan && plan.enabled && (
                <div className={`rounded-lg border p-3 text-sm ${plan.canCover ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Compensation<InfoTip text="Draft-pick cost you pay the player's old club if he signs. You can only surrender your OWN original picks — never picks you acquired in trades." /></span>
                    <b className={plan.canCover ? "text-emerald-300" : "text-red-300"}>{plan.label}</b>
                  </div>
                  {plan.canCover ? (
                    <p className="text-[11px] text-slate-400 mt-1">You&apos;ll send: {plan.detail.map((d) => `${d.year} R${d.round}`).join(", ")}</p>
                  ) : (
                    <p className="text-[11px] text-red-300 mt-1">You don&apos;t own enough of your own original picks to pay this. Lower the salary or acquire picks first.</p>
                  )}
                </div>
              )}
              {plan && !plan.enabled && <p className="text-xs text-slate-500">Offer-sheet compensation is disabled by the commissioner.</p>}

              <div>
                <label className="text-xs text-slate-400 block mb-1">Promised role</label>
                <select value={line} onChange={(e) => setLine(Number(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm">
                  {lineOptions(grp).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Contract type<InfoTip text="One-way pays the same in NHL or AHL. Two-way pays less on the farm — a player who logged 30+ NHL games last season won't accept one (he's an established NHLer, whatever his rating); those who do take a two-way take it only as a one-year deal." /></label>
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
                  {grantClause && <span className="text-xs text-emerald-400">≈ {Math.round(clauseDiscount(grantClause, breadth) * 100)}% cheaper</span>}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={submit} disabled={pending || (plan?.enabled && !plan?.canCover)}
                  className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-semibold">
                  {existing ? "Update offer sheet" : "Submit offer sheet"}
                </button>
                {existing && (
                  <button onClick={withdraw} disabled={pending}
                    className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-sm">Withdraw</button>
                )}
              </div>

              {msg && <div className={`text-sm ${msg.t === "ok" ? "text-green-300" : "text-red-300"}`}>{msg.s}</div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
