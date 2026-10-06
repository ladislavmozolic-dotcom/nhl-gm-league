"use client";

import { salaryDollars, salaryMillions, formatSalaryMillions, formatSalaryDisplay } from "@/components/SalaryStepper";
import { useEffect, useState, useTransition } from "react";
import PlayerLink from "@/components/PlayerLink";
import { useRouter } from "next/navigation";
import {
  getInterestAction,
  extendContractAction,
  setFranchiseTagAction,
  setRightsReleasedAction,
} from "@/app/free-agents/actions";
import InfoTip from "@/components/InfoTip";
import { cleanName } from "@/lib/playerName";
import { clauseDiscount } from "@/lib/free-agency";
import { friendlyActionError } from "@/lib/client/action-error";

type NegotiationSnapshot = { round: number | null; offerSalary: number | null; offerYears: number | null; offerLine: number | null; offerPP: boolean | null; offerPK: boolean | null; offerClause: string | null; offerTwoWay: boolean | null; counterSalary: number | null; counterYears: number | null; note: string | null };
type ExpiringPlayer = { id: number; name: string; age?: number | null; position?: string | null; isGoalie?: boolean; lastSeasonGP?: number | null; lastSeasonPts?: number | null; lastSeasonSvPct?: number | null; type?: "UFA" | "RFA"; capHit: number | null; contractYears: number | null; contractText: string | null; farm?: boolean; franchiseTag?: boolean; rightsReleased?: boolean; rfaStatus?: string; qoAmount?: number; qoDueAt?: string; resignRound?: number | null; resignStatus?: string | null; resignOfferSalary?: number | null; resignCounterSalary?: number | null; resignCounterYears?: number | null; negotiation?: NegotiationSnapshot };

const M = formatSalaryDisplay;
function lineOptions(grp: string) {
  if (grp === "G") return [[1, "Starter"], [2, "Backup"], [3, "3rd goalie"]] as const;
  if (grp === "D") return [[1, "Top pair"], [2, "2nd pair"], [3, "3rd pair"], [4, "7th D"]] as const;
  return [[1, "1st line"], [2, "2nd line"], [3, "3rd line"], [4, "4th line"], [5, "Extra forward"]] as const;
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
  const [years, setYears] = useState(1);
  const [line, setLine] = useState(2);
  const [pp, setPp] = useState(false);
  const [pk, setPk] = useState(false);
  const [grantClause, setGrantClause] = useState("");
  const [breadth, setBreadth] = useState(12);
  const [twoWay, setTwoWay] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    start(async () => {
      try {
        const i = await getInterestAction(player.id, teamId);
        setInfo(i);
        if (i.ok) {
          const previous = player.negotiation;
          setLine(previous?.offerLine ?? i.line);
          setPp(previous?.offerPP ?? i.wantPP);
          setPk(previous?.offerPK ?? i.wantPK);
          setGrantClause(previous?.offerClause ?? "");
          setTwoWay(previous?.offerTwoWay ?? false);
          const suggestedSalary = previous?.counterSalary ?? player.resignCounterSalary;
          const suggestedYears = previous?.counterYears ?? player.resignCounterYears;
          if (suggestedSalary) setSalaryM(formatSalaryMillions(suggestedSalary / 1e6));
          setYears(suggestedYears ?? i.askYears ?? 1);
        }
      } catch (e) { setMsg({ t: "err", s: friendlyActionError(e) }); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const i = info && info.ok ? info : null;
  const grp = i?.grp ?? "F";

  const currentSalaryDollars = salaryDollars(salaryM);
  const maxTwoWay = i?.twoWayMaxSalary ?? 1_300_000;
  const isSalaryAboveTwoWayMax = Number.isFinite(currentSalaryDollars) && currentSalaryDollars > maxTwoWay;
  const canTakeTwoWay = i ? (i.twoWayAllowed && !isSalaryAboveTwoWayMax) : !isSalaryAboveTwoWayMax;

  // Auto-switch from two-way to one-way if GM raises salary over $1.30M
  useEffect(() => {
    if (isSalaryAboveTwoWayMax && twoWay) {
      setTwoWay(false);
    }
  }, [isSalaryAboveTwoWayMax, twoWay]);

  const stepSalary = (dir: 1 | -1) => {
    const cur = salaryMillions(salaryM);
    const min = 0.775;
    const max = i ? i.maxSalary / 1e6 : 25;
    let next: number;
    if (!Number.isFinite(cur)) {
      const base = i ? i.floor / 1e6 : 0.825;
      next = dir === 1 ? Math.min(max, base) : Math.max(min, base - 0.05);
    } else {
      const step = 0.05;
      const snapped = (dir === 1 ? Math.floor(cur / step + 1e-9) : Math.ceil(cur / step - 1e-9)) * step;
      next = snapped + dir * step;
    }
    next = Math.max(min, Math.min(max, next));
    setSalaryM(formatSalaryMillions(next));
  };

  const router = useRouter();
  const closeAndRefresh = () => { router.refresh(); onClose(); };
  const [result, setResult] = useState<{ salary: number; years: number; next?: boolean } | null>(null);
  const [walkedToUFA, setWalkedToUFA] = useState(true);
  const submit = () => start(async () => {
    setMsg(null);
    const salary = salaryDollars(salaryM);
    if (!Number.isFinite(salary)) { setMsg({ t: "err", s: "Zadajte plat hráča." }); return; }
    if (years < 1) { setMsg({ t: "err", s: "Vyberte dĺžku kontraktu (roky)." }); return; }
    let r: Awaited<ReturnType<typeof extendContractAction>>;
    try {
      r = await extendContractAction(player.id, teamId, salary, years, line, pp, pk, grantClause || null, grantClause === "M_NTC" ? breadth : null, twoWay);
    } catch (e) { setMsg({ t: "err", s: friendlyActionError(e) }); return; }
    if (r.ok) { setResult({ salary: r.salary, years: r.years, next: !!r.startsNextSeason }); setDone(true); return; }
    const rr = r as { walked?: boolean; toUFA?: boolean; rejected?: boolean; reason?: string; error?: string };
    if (rr.walked) { setWalkedToUFA(rr.toUFA !== false); setDone(true); setMsg({ t: "err", s: rr.reason ?? "Hráč ukončil rokovania." }); return; }
    setMsg({ t: "err", s: rr.rejected ? (rr.reason ?? "") : (rr.error ?? "Odoslanie ponuky zlyhalo.") });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 md:p-6 overflow-y-auto" onClick={closeAndRefresh}>
      <div
        className="bg-gradient-to-b from-slate-900 via-[#0d1627] to-[#0a101d] border-2 border-amber-500/30 rounded-2xl w-full max-w-4xl max-h-[92dvh] overflow-y-auto p-5 md:p-8 shadow-2xl relative ring-1 ring-white/10"
        role="dialog"
        aria-modal="true"
        aria-label={`Re-sign ${cleanName(player.name)}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Document Header with Official Seal */}
        <div className="flex items-start justify-between pb-4 border-b border-amber-500/20 relative">
          <div>
            <div className="flex items-center gap-2 text-[10px] md:text-xs text-amber-400/80 font-mono tracking-widest uppercase mb-1">
              <span>Standard Player&apos;s Contract (SPC-1)</span>
              <span>•</span>
              <span>UNHL CBA Authorized</span>
            </div>
            <h2 className="text-lg md:text-2xl font-black tracking-wide text-white uppercase flex items-center gap-2">
              <span className="text-amber-400">📜</span> Zmluva o predĺžení kontraktu
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Predloženie oficiálnej ponuky pre hráča: <b className="text-slate-200">{cleanName(player.name)}</b>
            </p>
          </div>
          <button
            onClick={closeAndRefresh}
            className="text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center text-lg leading-none transition"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {done && result && (
          <div className="my-8 p-6 md:p-8 bg-slate-950/70 border-2 border-emerald-500/40 rounded-2xl text-center relative overflow-hidden">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-3xl">
              ✍️
            </div>
            <div className="text-[11px] font-mono tracking-widest uppercase text-emerald-400 font-bold">Oficiálne zaregistrovaná zmluva</div>
            <div className="text-2xl md:text-3xl font-black text-white mt-1">{cleanName(player.name)}</div>
            <div className="text-xl text-emerald-300 font-bold mt-2 font-mono tabular-nums">{M(result.salary)} × {result.years} {result.years === 1 ? "rok" : result.years < 5 ? "roky" : "rokov"}</div>
            <div className="text-xs text-slate-400 mt-2 max-w-md mx-auto">
              {result.next ? "Kontrakt je podpísaný ako Extension — hráč dohrá túto sezónu za doterajších podmienok a nová zmluva začne platiť od budúcej sezóny." : `Hráč zostáva v klube do 30. júna ${new Date().getUTCFullYear() + result.years}.`}
            </div>
            <button onClick={() => { router.refresh(); onClose(); }} className="mt-6 px-8 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white shadow-lg shadow-emerald-600/30">Hotovo</button>
          </div>
        )}

        {done && !result && (
          <div className="my-8 p-6 md:p-8 bg-slate-950/70 border-2 border-amber-500/40 rounded-2xl text-center relative">
            <div className="text-4xl mb-3">{walkedToUFA ? "🚪" : "📝"}</div>
            <div className="text-xl font-black text-white">
              {walkedToUFA ? `${cleanName(player.name)} ukončil rokovania (Walked away)` : `${cleanName(player.name)} je otvorený pre Offer Sheets`}
            </div>
            <div className="text-sm text-amber-300 mt-2 max-w-md mx-auto leading-relaxed">{msg?.s}</div>
            {!walkedToUFA && (
              <div className="text-xs text-slate-500 mt-2 max-w-md mx-auto">
                Hráč je naďalej chránený — ak mu iný klub nepredloží akceptovateľný Offer Sheet, rokovania s vami sa po sezóne obnovia.
              </div>
            )}
            <button onClick={() => { router.refresh(); onClose(); }} className="mt-6 px-8 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white">Zavrieť</button>
          </div>
        )}

        {pending && !i && (
          <div className="py-12 text-center text-slate-400 text-sm">
            <span className="inline-block animate-spin mr-2">⏳</span> Načítavam zmluvné podklady a požiadavky agenta…
          </div>
        )}

        {!done && i && (
          <div className="mt-5 space-y-5">
            
            {/* Player & Agent Dossier Box */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-300 font-black text-base shrink-0">
                  {cleanName(player.name).split(" ").map(w => w[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-base">{cleanName(player.name)}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {player.rfaStatus ? "RFA" : "Expiring"}
                    </span>
                    {i.age != null && <span className="text-xs text-slate-400">{i.age}r</span>}
                    {i.overall != null && <span className="text-xs text-slate-400">· {i.overall} OVR</span>}
                    <span className="text-xs text-slate-400">
                      · Doterajší plat: <b className="text-slate-200">{player.capHit ? `${M(player.capHit)} · posledný rok` : "—"}</b>
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Vidí sa ako váš <b className="text-sky-300">{slotLabels[i.slot] ?? "—"}</b> · chce {i.wantPP ? "PP" : "bez PP"} · {i.wantPK ? "PK" : "bez PK"}
                  </div>
                </div>
              </div>

              <div className="text-left md:text-right bg-slate-900/90 px-3.5 py-2.5 rounded-lg border border-slate-800 shrink-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Požiadavka agenta
                </span>
                <span className="text-sm md:text-base font-bold text-amber-300 font-mono">
                  {M(i.floor)} – {M(i.askSalary * 1.05)} <span className="text-xs font-normal text-slate-400">/ {i.askYears} {i.askYears === 1 ? "rok" : i.askYears < 5 ? "roky" : "rokov"}</span>
                </span>
                {i.moraleNote && (
                  <p className={`mt-0.5 text-[10px] font-medium ${i.moraleNote.startsWith("Happy") ? "text-emerald-400" : "text-amber-400"}`}>
                    {i.moraleNote.startsWith("Happy") ? "😀 " : "😕 "}{i.moraleNote}
                  </p>
                )}
              </div>
            </div>

            {/* Previous Negotiation Alert */}
            {(player.negotiation || (player.resignRound ?? 0) > 0) && (
              <div className="bg-sky-500/5 border border-sky-500/25 rounded-xl p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold uppercase tracking-wide text-sky-300 mr-2">Predchádzajúca ponuka:</span>
                  <span className="text-slate-200 font-mono">
                    {player.negotiation?.offerSalary ? `${M(player.negotiation.offerSalary)} × ${player.negotiation.offerYears ?? "?"}yr` : player.resignOfferSalary ? M(player.resignOfferSalary) : "zaznamenaná"}
                  </span>
                </div>
                {(player.negotiation?.counterSalary ?? player.resignCounterSalary) && (
                  <div className="text-amber-300">
                    Protinávrh hráča: <b className="font-mono">{M(player.negotiation?.counterSalary ?? player.resignCounterSalary!)} × {player.negotiation?.counterYears ?? player.resignCounterYears ?? "?"}yr</b>
                  </div>
                )}
              </div>
            )}

            {/* CONTRACT ARTICLES */}
            <div className="space-y-4">
              
              {/* §1 Doba trvania & Odmena (Salary & Term) */}
              <div className="border border-slate-800/80 rounded-xl p-5 bg-slate-950/40">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black flex items-center justify-center">§1</span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Doba trvania & Odmena (Salary & Term)</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Salary input */}
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-2">Garantovaný ročný plat v NHL (AAV)</label>
                    <div className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] items-center gap-2">
                      <button
                        type="button"
                        onClick={() => stepSalary(-1)}
                        className="h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-lg border border-slate-700 active:scale-95 transition leading-none"
                        aria-label="Znížiť plat o $50,000"
                      >
                        −
                      </button>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={salaryM}
                          onChange={(e) => setSalaryM(e.target.value)}
                          onBlur={() => {
                            const m = salaryMillions(salaryM);
                            if (Number.isFinite(m) && salaryM.trim() !== "") {
                              setSalaryM(formatSalaryMillions(m));
                            }
                          }}
                          className="h-10 w-full rounded-lg border-2 border-amber-500/40 bg-slate-900 px-3 text-center text-lg font-bold font-mono text-amber-300 outline-none placeholder:text-slate-600 focus:border-amber-400"
                          placeholder={i.floor ? formatSalaryMillions(i.floor / 1e6) : "Plat v $M"}
                        />
                        <span className="absolute right-3 top-2.5 text-[11px] font-bold text-slate-500 pointer-events-none">$M / rok</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => stepSalary(1)}
                        className="h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-lg border border-slate-700 active:scale-95 transition leading-none"
                        aria-label="Zvýšiť plat o $50,000"
                      >
                        +
                      </button>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1.5 px-1">
                      <span>Min: $0.775M</span>
                      <span className="text-slate-400">Požaduje: {M(i.floor)}–{M(i.askSalary * 1.05)}</span>
                      <span>Max: ${(i.maxSalary / 1e6).toFixed(1)}M</span>
                    </div>
                  </div>

                  {/* Term buttons */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-400">Dĺžka kontraktu (Term)</label>
                      <span className="text-[10px] text-slate-400">
                        Preferuje: <b className="text-amber-300">{i.askYears} {i.askYears === 1 ? "rok" : i.askYears < 5 ? "roky" : "rokov"}</b>
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4].map((yr) => {
                        const isSelected = years === yr;
                        const isPreferred = yr === i.askYears;
                        return (
                          <button
                            key={yr}
                            type="button"
                            onClick={() => setYears(yr)}
                            className={`relative py-2.5 rounded-lg text-xs md:text-sm font-bold border transition-all ${
                              isSelected
                                ? "border-amber-500 bg-amber-500/25 text-white shadow-md shadow-amber-500/10 ring-1 ring-amber-500/40"
                                : "border-slate-800 bg-slate-900/90 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                            }`}
                          >
                            {yr} {yr === 1 ? "rok" : yr < 5 ? "roky" : "rokov"}
                            {isPreferred && (
                              <span className="absolute -top-2 right-1.5 px-1 py-0.2 bg-amber-500/30 text-amber-300 text-[8px] font-black rounded border border-amber-500/40">
                                Žiada
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1.5 px-1 flex justify-between">
                      <span>Rozpätie rokov: {i.minYears}–{i.maxYears} yr (dlhší kontrakt zvyčajne stojí viac, pri 35+ naopak)</span>
                      <span>Limit ligy: 4 roky</span>
                    </div>
                  </div>
                </div>

                {/* Total Value & Cap Impact Bar */}
                {Number.isFinite(currentSalaryDollars) && currentSalaryDollars >= 775_000 && years > 0 && (
                  <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-900/40 rounded-xl p-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Celková hodnota kontraktu</span>
                      <span className="text-sm font-black text-amber-300 font-mono">
                        {M(currentSalaryDollars * years)} <span className="text-xs font-normal text-slate-400">({M(currentSalaryDollars)} / rok × {years} {years === 1 ? "rok" : years < 5 ? "roky" : "rokov"})</span>
                      </span>
                    </div>
                    {i.capRoom != null && (
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Dopad na platový strop klubu{i.capSeason ? ` · sezóna ${i.capSeason}-${String((i.capSeason + 1) % 100).padStart(2, "0")}` : ""}</span>
                        <span className={`text-xs font-bold font-mono ${i.capRoom - currentSalaryDollars < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                          {i.capRoom - currentSalaryDollars < 0
                            ? `⚠️ Prekročenie stropu o ${M(Math.abs(i.capRoom - currentSalaryDollars))}`
                            : `Voľné miesto po podpise: ${M(i.capRoom - currentSalaryDollars)}`}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* §2 Forma zmluvy & Rola (Structure & Role) */}
              <div className="border border-slate-800/80 rounded-xl p-5 bg-slate-950/40">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black flex items-center justify-center">§2</span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Forma zmluvy & Úloha v tíme</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Contract Type (One-way vs Two-way) */}
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-2">
                      Charakter zmluvy (CBA Pravidlá)
                      <InfoTip text="One-way aj Two-way zmluva garantuje rovnaký plat v NHL aj v AHL. Two-way umožňuje flexibilný pohyb na farmu a je povolená najviac do výšky platu $1.30M; etablovaní hráči (nad 25 rokov s 30+ NHL zápasmi vlani) dvojcestnú zmluvu odmietajú." />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTwoWay(false)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          !twoWay
                            ? "border-amber-500 bg-amber-500/15 text-white shadow-md shadow-amber-500/10 ring-1 ring-amber-500/40"
                            : "border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <span className="block text-xs font-bold text-amber-300">Jednocestná (1-way)</span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">Plný NHL plat aj v AHL</span>
                      </button>

                      <button
                        type="button"
                        disabled={!canTakeTwoWay}
                        onClick={() => {
                          if (canTakeTwoWay) setTwoWay(true);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          !canTakeTwoWay
                            ? "border-slate-800/60 bg-slate-950/40 text-slate-600 opacity-60 cursor-not-allowed"
                            : twoWay
                              ? "border-blue-500 bg-blue-500/20 text-white shadow-md shadow-blue-500/10 ring-1 ring-blue-500/40"
                              : "border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`block text-xs font-bold ${!canTakeTwoWay ? "text-slate-500" : "text-blue-300"}`}>
                            Dvojcestná (2-way)
                          </span>
                          {!canTakeTwoWay && (
                            <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              Nedostupná
                            </span>
                          )}
                        </div>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          {!canTakeTwoWay
                            ? isSalaryAboveTwoWayMax
                              ? `Len do ${M(maxTwoWay)}`
                              : "Hráč odmieta 2-way"
                            : "Flexibilný pohyb do AHL (do $1.30M)"}
                        </span>
                      </button>
                    </div>

                    {!canTakeTwoWay && (
                      <p className="text-[11px] text-amber-400/90 mt-2 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">
                        ℹ️ {isSalaryAboveTwoWayMax
                          ? `Dvojcestná zmluva je podľa pravidiel CBA možná len do výšky platu ${M(maxTwoWay)}. Pri vyššej sume je povinná 1-way zmluva.`
                          : i.twoWayReason ?? "Hráč má štatút etablovaného hráča NHL a neprijme dvojcestnú zmluvu."}
                      </p>
                    )}
                  </div>

                  {/* Role & Special teams */}
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-2">Sľúbená pozícia & Špeciálne formácie</label>
                    <select
                      value={line}
                      onChange={(e) => setLine(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 mb-2.5"
                    >
                      {lineOptions(grp).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                    {grp !== "G" && (
                      <div className="flex gap-4 text-xs text-slate-300">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={pp} onChange={(e) => setPp(e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0" />
                          <span>Power play (PP)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={pk} onChange={(e) => setPk(e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0" />
                          <span>Penalty kill (PK)</span>
                        </label>
                      </div>
                    )}
                    <span className="text-[10px] text-slate-500 mt-2 block">
                      Zmena formácie alebo odobratie PP/PK dynamicky prepočítava hráčove platové nároky v reálnom čase.
                    </span>
                  </div>
                </div>
              </div>

              {/* §3 Doložky o nevymeniteľnosti (Clauses) */}
              <div className="border border-slate-800/80 rounded-xl p-5 bg-slate-950/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black flex items-center justify-center">§3</span>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Doložky o nevymeniteľnosti (NTC / NMC)</h3>
                      <p className="text-[11px] text-slate-500">Udelenie klauzuly znižuje platové nároky hráča (zľava sa prejaví na požiadavke agenta).</p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center flex-wrap">
                    <select
                      value={grantClause}
                      onChange={(e) => setGrantClause(e.target.value)}
                      className="h-9 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200"
                    >
                      <option value="">Bez klauzuly (No clause)</option>
                      <option value="NTC">NTC — zákaz výmeny</option>
                      <option value="NMC">NMC — zákaz pohybu/farmy</option>
                      <option value="M_NTC">M-NTC — modifikovaný zoznam</option>
                    </select>
                    {grantClause === "M_NTC" && (
                      <select
                        value={breadth}
                        onChange={(e) => setBreadth(Number(e.target.value))}
                        className="h-9 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200"
                      >
                        {[6, 12, 18, 24].map((n) => (
                          <option key={n} value={n}>{n}-team list</option>
                        ))}
                      </select>
                    )}
                    {grantClause && (
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
                        ≈ {Math.round(clauseDiscount(grantClause, breadth) * 100)}% zľava z platu
                      </span>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Signature & Submission Block */}
            <div className="mt-8 pt-6 border-t border-amber-500/20">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end mb-6">
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 text-center">
                  <div className="h-10 flex items-center justify-center text-amber-300 font-serif italic text-lg tracking-wide">
                    {i?.gmName || "Generálny manažér"}
                  </div>
                  <div className="border-t border-slate-800 pt-1 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                    Podpis GM {i?.teamName ? `(${i.teamName})` : "(autorizovaný zástupca klubu)"}
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 text-center">
                  <div className="h-10 flex items-center justify-center text-slate-400 font-serif italic text-lg">
                    {cleanName(player.name)}
                  </div>
                  <div className="border-t border-slate-800 pt-1 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                    Súhlas hráča a hráčskej asociácie (NHLPA)
                  </div>
                </div>
              </div>

              {msg && (
                <div className={`mb-4 p-3 rounded-xl text-xs font-semibold border ${
                  msg.t === "ok" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                }`}>
                  {msg.s}
                </div>
              )}

              {/* Offer Summary Bar */}
              {Number.isFinite(currentSalaryDollars) && currentSalaryDollars >= 775_000 && (
                <div className="mb-4 text-center text-xs text-slate-400">
                  Pripravený návrh: <strong className="text-amber-300 font-mono">{M(currentSalaryDollars)}/rok</strong> × <strong className="text-white">{years} {years === 1 ? "rok" : years < 5 ? "roky" : "rokov"}</strong> ({M(currentSalaryDollars * years)} celkovo) • <span className={twoWay ? "text-blue-300 font-semibold" : "text-amber-300 font-semibold"}>{twoWay ? "2-way" : "1-way"}</span>{grantClause ? ` • ${grantClause}` : ""}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={closeAndRefresh}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Zrušiť
                </button>
                <button
                  onClick={submit}
                  disabled={pending}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-black text-xs md:text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition flex items-center justify-center gap-2"
                >
                  <span>✍️</span> {pending ? "Odosielam návrh zmluvy…" : "Pečatiť a odoslať ponuku zmluvy"}
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export default function ReSignPanel({
  teamId, players, title, blurb, accent = "text-amber-400", group,
  franchiseEnabled = true, canNegotiate = true,
  franchiseTagUsed = false, franchiseTaggedPlayer = null,
}: {
  teamId: number;
  players: ExpiringPlayer[];
  title?: string;
  blurb?: string;
  accent?: string;
  group?: string;
  franchiseEnabled?: boolean;
  canNegotiate?: boolean;
  franchiseTagUsed?: boolean;
  franchiseTaggedPlayer?: { id: number; name: string } | null;
}) {
  const [tagPending, startTag] = useTransition();
  const initialTaggedId = franchiseTaggedPlayer?.id ?? players.find((p) => p.franchiseTag)?.id ?? null;
  const [tagged, setTagged] = useState<number | null>(initialTaggedId);
  const [tagMsg, setTagMsg] = useState<string | null>(null);
  const toggleTag = (id: number) => startTag(async () => {
    setTagMsg(null);
    const on = tagged !== id;
    try {
      const r = await setFranchiseTagAction(id, teamId, on);
      if (r.ok) setTagged(on ? id : null);
      else setTagMsg(r.error ?? "Couldn't set the tag.");
    } catch (e) { setTagMsg(friendlyActionError(e)); }
  });
  const [releasePending, startRelease] = useTransition();
  const [released, setReleased] = useState<Set<number>>(new Set(players.filter((p) => p.rightsReleased).map((p) => p.id)));
  const [releaseMsg, setReleaseMsg] = useState<string | null>(null);
  const toggleRelease = (id: number, next: boolean) => startRelease(async () => {
    setReleaseMsg(null);
    try {
      const r = await setRightsReleasedAction(id, teamId, next);
      if (r.ok) setReleased((s) => { const n = new Set(s); if (next) n.add(id); else n.delete(id); return n; });
      else setReleaseMsg(r.error ?? "Couldn't update.");
    } catch (e) { setReleaseMsg(friendlyActionError(e)); }
  });
  // hold the OPEN PLAYER OBJECT, not just an id — the server action's revalidatePath
  // re-renders this list without the just-signed player, and a find(openId) would go
  // undefined and tear the modal down before its confirmation shows.
  const [openPlayer, setOpenPlayer] = useState<ExpiringPlayer | null>(null);
  const [tab, setTab] = useState<"ALL" | "UFA" | "RFA">("ALL");
  const [bookmarked, setBookmarked] = useState<Set<number>>(new Set());
  const priorities = [...players].sort((a, b) => {
    const score = (p: ExpiringPlayer) => (p.capHit ?? 0) / 1_000_000 - Math.max(0, (p.age ?? 28) - 34) * 1.6;
    return score(b) - score(a);
  }).slice(0, 3);
  const visiblePlayers = players.filter((p) => tab === "ALL" || p.type === tab);
  const ufaCount = players.filter((p) => p.type === "UFA").length;
  const rfaCount = players.filter((p) => p.type === "RFA").length;
  const capTotal = players.reduce((sum, p) => sum + (p.capHit ?? 0), 0);
  if (players.length === 0 && !openPlayer) return null;
  return (
    <section className="overflow-hidden rounded-[26px] border border-slate-700/80 bg-[#08182c] shadow-2xl shadow-black/35">
      <div className="flex items-center justify-between border-b border-slate-700/70 bg-gradient-to-r from-amber-500/15 via-slate-900/20 to-slate-900 px-5 py-4 sm:px-6">
        <h2 className={`text-lg font-black uppercase tracking-tight sm:text-xl ${accent}`}>{title ?? "Contracts — up for renewal"} <span className="text-white">({players.length})</span></h2>
        <div className="flex gap-5 text-sm font-black"><span className="text-rose-400">UFA {ufaCount}</span><span className="text-sky-400">RFA {rfaCount}</span></div>
      </div>
      <div className="p-4 sm:p-5">
      <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-700 bg-[#0b1d34] p-4"><div className="text-3xl">🏳️</div><div className="mt-1 text-2xl font-black">{players.length}</div><div className="text-sm font-semibold text-slate-300">Total expiring</div><div className="mt-1 text-xs text-slate-500">{ufaCount} UFA · {rfaCount} RFA</div></div>
        <div className="rounded-2xl border border-slate-700 bg-[#0b1d34] p-4"><div className="text-3xl text-emerald-400">♻</div><div className="mt-1 text-2xl font-black">{M(capTotal)}</div><div className="text-sm font-semibold text-slate-300">Total cap hit</div><div className="mt-1 text-xs text-slate-500">next season</div></div>
        <div className="rounded-2xl border border-rose-500/25 bg-rose-950/20 p-4"><div className="text-3xl text-rose-400">⚠</div><div className="mt-1 text-2xl font-black">{priorities.length}</div><div className="text-sm font-semibold text-slate-300">High priority</div><div className="mt-1 text-xs text-slate-500">key decisions</div></div>
        <div className="rounded-2xl border border-slate-700 bg-[#0b1d34] p-4"><div className="text-3xl text-sky-300">☷</div><div className="mt-1 text-2xl font-black">{Math.min(6, players.length)}</div><div className="text-sm font-semibold text-slate-300">Re-sign targets</div><div className="mt-1 text-xs text-slate-500">recommended</div></div>
      </div>
      {priorities.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between"><span className="text-lg font-black uppercase tracking-tight text-amber-300">Top priority decisions</span><button type="button" onClick={() => setTab("ALL")} className="text-sm font-bold text-sky-400 hover:text-sky-300">View all {players.length} players →</button></div>
          <div className="grid gap-3 lg:grid-cols-3">{priorities.map((p, i) => (
            <div key={p.id} className={`relative overflow-hidden rounded-2xl border-2 p-4 ${i === 0 ? "border-rose-400/75 bg-gradient-to-br from-rose-950/45 to-[#0c1c31]" : "border-amber-400/65 bg-gradient-to-br from-amber-950/20 to-[#0c1c31]"}`}>
              <div className="flex items-center justify-between"><span className={`flex h-9 w-9 items-center justify-center rounded-full text-lg font-black ${i === 0 ? "bg-rose-400 text-rose-950" : "bg-amber-300 text-amber-950"}`}>{i + 1}</span><div className="flex items-center gap-2"><span className={`text-xs font-black uppercase ${i === 0 ? "text-rose-300" : "text-amber-300"}`}>{i === 0 ? "High priority" : "Medium priority"}</span><span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-bold text-slate-300">{p.position ?? "—"}</span></div></div>
              <div className="mt-8 text-2xl font-black tracking-tight text-white">{cleanName(p.name)}</div>
              <div className="mt-1 text-sm font-semibold text-slate-400">{p.type ?? "UFA"} · {p.age ?? "—"} years</div>
              <div className="mt-4 text-3xl font-black text-white">{p.capHit ? M(p.capHit) : "—"}</div>
              <div className="mt-3 flex gap-2 text-xs font-bold text-slate-300"><span className="rounded-lg bg-slate-950/60 px-2 py-1.5">{p.lastSeasonGP ?? 0} GP</span><span className="rounded-lg bg-slate-950/60 px-2 py-1.5">{p.isGoalie ? `${p.lastSeasonSvPct ? p.lastSeasonSvPct.toFixed(3) : "—"} SV%` : `${p.lastSeasonPts ?? 0} PTS`}</span></div>
              <div className="mt-4 flex gap-2"><button type="button" onClick={() => setOpenPlayer(p)} className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-black text-white transition hover:bg-emerald-500">Re-sign</button><button type="button" onClick={() => setBookmarked((s) => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; })} aria-label="Bookmark player" className={`rounded-lg border px-3 text-lg ${bookmarked.has(p.id) ? "border-sky-400 bg-sky-400/15 text-sky-200" : "border-slate-600 bg-slate-900 text-slate-300"}`}>♧</button></div>
            </div>
          ))}</div>
        </div>
      )}
      {players.some((p) => p.type === "RFA") && franchiseEnabled && (
        <div className="mb-3 space-y-1.5">
          <p className="text-xs text-slate-500">
            <span className="text-fuchsia-300 font-semibold">★ Franchise tag</span> (1 per club)
            <InfoTip text="Tag one RFA as your Franchise player. A franchise RFA gets TWO re-sign rounds before rivals can submit offer sheets; every other RFA gets one round, then he's open to offer sheets. Ak ho raz použijete v rokovaniach, už ho nemožno zmeniť ani použiť na iného hráča v tejto sezóne." />
          </p>
          {(franchiseTagUsed || (franchiseTaggedPlayer && tagged != null && ((players.find((p) => p.id === tagged)?.resignRound ?? 0) > 0 || players.find((p) => p.id === tagged)?.resignStatus === "extended"))) && (
            <div className="flex items-center gap-1.5 text-xs text-fuchsia-300 bg-fuchsia-950/40 border border-fuchsia-800/50 rounded-lg px-2.5 py-1.5 font-medium">
              <span className="text-fuchsia-400 font-bold">★</span>
              <span>
                Franchise Tag v tejto sezóne využitý: <b className="text-fuchsia-200">{franchiseTaggedPlayer?.name ?? players.find((p) => p.id === tagged)?.name ?? "Využitý"}</b> (1 na klub za sezónu)
              </span>
            </div>
          )}
        </div>
      )}
      {tagMsg && <p className="text-xs text-rose-400 mb-2">{tagMsg}</p>}
      {releaseMsg && <p className="text-xs text-rose-400 mb-2">{releaseMsg}</p>}
      <div className="overflow-hidden rounded-2xl border border-slate-700/80 bg-[#091a2f]">
        <div className="flex flex-col gap-3 border-b border-slate-700/70 px-3 pt-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex gap-1"><button type="button" onClick={() => setTab("ALL")} className={`border-b-2 px-4 py-3 text-sm font-black ${tab === "ALL" ? "border-sky-400 bg-sky-500/10 text-white" : "border-transparent text-slate-400 hover:text-white"}`}>All ({players.length})</button><button type="button" onClick={() => setTab("UFA")} className={`border-b-2 px-4 py-3 text-sm font-black ${tab === "UFA" ? "border-rose-400 bg-rose-500/10 text-rose-200" : "border-transparent text-slate-400 hover:text-white"}`}>UFA ({ufaCount})</button><button type="button" onClick={() => setTab("RFA")} className={`border-b-2 px-4 py-3 text-sm font-black ${tab === "RFA" ? "border-sky-400 bg-sky-500/10 text-sky-200" : "border-transparent text-slate-400 hover:text-white"}`}>RFA ({rfaCount})</button></div>
          <div className="pb-2 text-xs font-semibold text-slate-400">Sort by <span className="ml-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white">Cap Hit⌄</span><span className="ml-2 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2">⌕ Filter</span></div>
        </div>
        <div className="hidden grid-cols-[28px_minmax(180px,1.8fr)_42px_54px_42px_76px_1fr_82px_34px] gap-2 border-b border-slate-700/70 bg-slate-900/65 px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-400 md:grid"><span>#</span><span>Player</span><span>Pos</span><span>Type</span><span>Age</span><span>Cap hit</span><span>Priority</span><span>Action</span><span /></div>
      <div className="divide-y divide-slate-800/70">
        {visiblePlayers.map((p, index) => (
          <div key={p.id} className="grid gap-2 px-3 py-3 transition-colors hover:bg-slate-800/35 md:grid-cols-[28px_minmax(180px,1.8fr)_42px_54px_42px_76px_1fr_82px_34px] md:items-center md:px-4">
            <span className="hidden text-sm font-bold text-slate-500 md:block">{index + 1}</span>
            <div className="min-w-0">
              <PlayerLink id={p.id} name={p.name} className="font-medium truncate" />
              {p.farm && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30">AHL</span>}
              {/* show the REAL current deal (cap hit) — the stored contractText is a stale
                  profinhl string that can misrepresent the term; everyone here is in their
                  final year by the query filter, so label it plainly. */}
              <span className="text-xs text-slate-500 ml-2">{p.capHit ? `${M(p.capHit)} · last year` : "—"}</span>
              {p.type === "RFA" && p.rfaStatus && (
                <span className={`ml-2 text-[10px] font-bold uppercase ${p.rfaStatus === "QO_DUE" ? "text-sky-300" : "text-slate-400"}`}>
                  {p.rfaStatus === "QO_DUE" ? `QO ${p.qoAmount ? M(p.qoAmount) : ""} due ${p.qoDueAt?.slice(0, 10) ?? ""}` : p.rfaStatus.replaceAll("_", " ")}
                </span>
              )}
            </div>
            <span className="hidden text-sm font-bold text-slate-300 md:block">{p.position ?? "—"}</span>
            <span className={`hidden text-sm font-black md:block ${p.type === "RFA" ? "text-sky-300" : "text-rose-300"}`}>{p.type ?? "UFA"}</span>
            <span className="hidden text-sm text-slate-300 md:block">{p.age ?? "—"}</span>
            <span className="hidden text-sm font-bold text-white md:block">{p.capHit ? M(p.capHit) : "—"}</span>
            <span className="hidden md:block"><span className={`rounded-lg px-2 py-1 text-xs font-black ${index < 1 ? "bg-rose-500/15 text-rose-300" : index < 6 ? "bg-amber-500/15 text-amber-300" : "bg-sky-500/15 text-sky-300"}`}>{index < 1 ? "High" : index < 6 ? "Medium" : "Low"}</span></span>
            <div className="flex items-center gap-2 shrink-0 md:flex">
              {p.type === "RFA" && franchiseEnabled && (() => {
                const isTagged = tagged === p.id;
                const isUsed = franchiseTagUsed || (isTagged && ((p.resignRound ?? 0) > 0 || p.resignStatus === "extended"));
                const isDisabled = tagPending || isUsed || (!isTagged && ((p.resignRound ?? 0) > 0 || tagged != null));
                const tagTitle = isUsed
                  ? (isTagged
                      ? "Franchise Tag už bol pre tohto hráča v rokovaniach použitý — nemožno ho zmeniť"
                      : `Váš klub už v tejto sezóne použil Franchise Tag (${franchiseTaggedPlayer?.name ?? "využitý"})`)
                  : !isTagged && tagged != null
                    ? `Franchise Tag už má priradený iný hráč (${franchiseTaggedPlayer?.name ?? "hráč"})`
                    : !isTagged && (p.resignRound ?? 0) > 0
                      ? "Franchise Tag musí byť priradený pred začiatkom rokovaní o zmluve"
                      : isTagged
                        ? "Franchise Tag — kliknutím zrušíte (ešte neprebehli rokovania)"
                        : "Priradiť Franchise Tag (1 na klub za sezónu, chráni pred offer sheet na 2 kolá)";
                return (
                  <button
                    type="button"
                    onClick={() => toggleTag(p.id)}
                    disabled={isDisabled}
                    title={tagTitle}
                    className={`px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap border ${
                      isTagged
                        ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40"
                        : "bg-slate-800 text-slate-400 border-slate-700 hover:text-fuchsia-300"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    ★ {isTagged ? "Franchise" : "Tag"}
                  </button>
                );
              })()}
              {p.type === "RFA" && (
                released.has(p.id) ? (
                  <button onClick={() => toggleRelease(p.id, false)} disabled={releasePending}
                    title="Rights released — he's priced like a UFA and hits the open market the moment his deal expires. Click to reclaim his RFA rights."
                    className="px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap border bg-amber-950/50 text-amber-400 border-amber-800/50 hover:text-amber-300">
                    🔓 Released
                  </button>
                ) : (
                  <button onClick={() => toggleRelease(p.id, true)} disabled={releasePending}
                    title="Declare you won't re-sign him (real-NHL 'not qualifying') — he's priced and treated like a UFA from now on, and hits the open market the moment his deal expires instead of staying RFA-locked to you."
                    className="px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap border bg-slate-800 text-slate-400 border-slate-700 hover:text-rose-300">
                    Release rights
                  </button>
                )
              )}
              {canNegotiate ? (
                <button onClick={() => setOpenPlayer(p)}
                  className="px-3 py-1 rounded-md bg-green-600/80 hover:bg-green-500 text-white text-xs font-semibold whitespace-nowrap md:px-2">
                  Re-sign
                </button>
              ) : (
                <span title="Extensions open once the regular season starts — a player can only be re-signed during the final year of his deal."
                  className="px-3 py-1 rounded-md bg-slate-800 text-slate-500 border border-slate-700 text-xs font-semibold whitespace-nowrap cursor-not-allowed">
                  Unavailable
                </span>
              )}
              <button type="button" onClick={() => setBookmarked((s) => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; })} aria-label={`Bookmark ${cleanName(p.name)}`} className={`hidden rounded-md border px-2 py-1 text-sm md:block ${bookmarked.has(p.id) ? "border-sky-400 bg-sky-400/15 text-sky-100" : "border-slate-700 text-slate-400"}`}>♧</button>
            </div>
          </div>
        ))}
      </div>
      </div>
      {openPlayer && <ReSignModal player={openPlayer} teamId={teamId} onClose={() => setOpenPlayer(null)} />}
      </div>
    </section>
  );
}
