"use client";

import SalaryStepper, { salaryDollars } from "@/components/SalaryStepper";
import { useEffect, useState, useTransition } from "react";
import PlayerLink from "@/components/PlayerLink";
import { useRouter } from "next/navigation";
import { getInterestAction, extendContractAction, setFranchiseTagAction, setRightsReleasedAction } from "@/app/free-agents/actions";
import { Card } from "@/components/ui";
import InfoTip from "@/components/InfoTip";
import { cleanName } from "@/lib/playerName";
import { clauseDiscount } from "@/lib/free-agency";
import { friendlyActionError } from "@/lib/client/action-error";

type ExpiringPlayer = { id: number; name: string; capHit: number | null; contractYears: number | null; contractText: string | null; farm?: boolean; franchiseTag?: boolean; rightsReleased?: boolean; rfaStatus?: string; qoAmount?: number; qoDueAt?: string };

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
  const [years, setYears] = useState(0);
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
        // Salary and term start blank — his headline ask is shown as context above the
        // form, not pre-filled into it, so every GM has to actually decide a number
        // instead of just accepting the computed figure by default. Role/PP/PK still
        // default to what he wants — those aren't the part being negotiated here.
        if (i.ok) { setLine(i.line); setPp(i.wantPP); setPk(i.wantPK); }
      } catch (e) { setMsg({ t: "err", s: friendlyActionError(e) }); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const i = info && info.ok ? info : null;
  const grp = i?.grp ?? "F";

  const router = useRouter();
  const [result, setResult] = useState<{ salary: number; years: number; next?: boolean } | null>(null);
  const [walkedToUFA, setWalkedToUFA] = useState(true);
  const submit = () => start(async () => {
    setMsg(null);
    const salary = salaryDollars(salaryM);
    if (!Number.isFinite(salary)) { setMsg({ t: "err", s: "Enter a salary." }); return; }
    if (years < 1) { setMsg({ t: "err", s: "Choose a term (years)." }); return; }
    let r: Awaited<ReturnType<typeof extendContractAction>>;
    try {
      r = await extendContractAction(player.id, teamId, salary, years, line, pp, pk, grantClause || null, grantClause === "M_NTC" ? breadth : null, twoWay);
    } catch (e) { setMsg({ t: "err", s: friendlyActionError(e) }); return; }
    // don't refresh yet — that would unmount this modal before the confirmation shows;
    // refresh when the GM closes it (Done button).
    if (r.ok) { setResult({ salary: r.salary, years: r.years, next: !!r.startsNextSeason }); setDone(true); return; }
    const rr = r as { walked?: boolean; toUFA?: boolean; rejected?: boolean; reason?: string; error?: string };
    // an RFA who exhausts his round(s) isn't leaving the club — he's just open to rival
    // offer sheets, and comes back to the negotiating table if nobody bites (rfaOsUsed).
    // Only a real UFA walk means he's actually testing outside free agency.
    if (rr.walked) { setWalkedToUFA(rr.toUFA !== false); setDone(true); setMsg({ t: "err", s: rr.reason ?? "He walked away." }); return; }
    setMsg({ t: "err", s: rr.rejected ? (rr.reason ?? "") : (rr.error ?? "Failed.") });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md max-h-[88dvh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">Re-sign {cleanName(player.name)}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">Current: {player.capHit ? `${M(player.capHit)} · last year` : "—"}</p>

        {done && result && (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">✅</div>
            <div className="text-xs uppercase tracking-wide text-emerald-400/80">Contract signed</div>
            <div className="text-2xl font-black text-white mt-1">{cleanName(player.name)}</div>
            <div className="text-lg text-emerald-400 font-bold mt-1 tabular-nums">{M(result.salary)} × {result.years}yr</div>
            <div className="text-xs text-slate-500 mt-1">{result.next ? "Extension — plays out his current deal this season; the new one starts next season." : `stays with the club through ${new Date().getUTCFullYear() + result.years}`}</div>
            <button onClick={() => { router.refresh(); onClose(); }} className="mt-6 px-8 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-bold">Done</button>
          </div>
        )}
        {done && !result && (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">{walkedToUFA ? "🚪" : "📝"}</div>
            <div className="text-lg font-bold text-white">
              {walkedToUFA ? `${cleanName(player.name)} walked away` : `${cleanName(player.name)} is open to offer sheets`}
            </div>
            <div className="text-sm text-amber-300 mt-1 max-w-xs mx-auto">{msg?.s}</div>
            {!walkedToUFA && (
              <div className="text-xs text-slate-500 mt-2 max-w-xs mx-auto">
                He&apos;s still your player — if no rival club signs him to an offer sheet, negotiations with you resume.
              </div>
            )}
            <button onClick={() => { router.refresh(); onClose(); }} className="mt-6 px-8 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold">Close</button>
          </div>
        )}

        {pending && !i && <p className="text-slate-500 text-sm py-3">Loading…</p>}

        {!done && i && (
          <>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 mb-3 text-sm">
              <p className="text-slate-300">Sees himself as your <b className="text-blue-300">{slotLabels[i.slot] ?? "—"}</b> · wants {i.wantPP ? "PP" : "no PP"} · {i.wantPK ? "PK" : "no PK"}</p>
              <p className="mt-1 text-slate-200">He&apos;s looking for roughly <b className="text-amber-300">{M(i.floor)}–{M(i.askSalary * 1.05)} / {i.askYears}yr</b></p>
              <p className="mt-0.5 text-xs text-slate-500">That&apos;s his base ask at his preferred term — offer a different length yourself and the price shifts ({i.minYears}-{i.maxYears}yr negotiable; more years usually costs more, except 35+ vets, where it's the reverse).</p>
              {i.moraleNote && <p className={`mt-1 text-xs font-medium ${i.moraleNote.startsWith("Happy") ? "text-emerald-400" : "text-amber-400"}`}>{i.moraleNote.startsWith("Happy") ? "😀 " : "😕 "}{i.moraleNote}</p>}
            </div>

            {!done && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Salary ($M / yr)</label>
                    <SalaryStepper value={salaryM} onChange={setSalaryM} max={i.maxSalary / 1e6} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Term (years)</label>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setYears((y) => Math.max(1, y - 1))} className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-lg leading-none">−</button>
                      <div className="flex-1 text-center py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm tabular-nums font-semibold">{years > 0 ? `${years} yr` : "— yr"}</div>
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
                  <label className="text-xs text-slate-400 block mb-1">Contract type<InfoTip text="One-way pays the same in the NHL or AHL. Two-way pays less on the farm — an established player past 25 (30+ NHL games last season) won't accept one, whatever his rating; young players sign two-ways freely. One year only." /></label>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setTwoWay(false)} className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border ${!twoWay ? "bg-blue-600 text-white border-blue-500" : "bg-slate-800 text-slate-400 border-slate-700"}`}>One-way</button>
                    <button type="button" onClick={() => setTwoWay(true)} className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border ${twoWay ? "bg-blue-600 text-white border-blue-500" : "bg-slate-800 text-slate-400 border-slate-700"}`}>Two-way</button>
                  </div>
                </div>
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

export default function ReSignPanel({ teamId, players, title, blurb, accent = "text-amber-400", group, franchiseEnabled = true, canNegotiate = true }: {
  teamId: number; players: ExpiringPlayer[]; title?: string; blurb?: string; accent?: string; group?: string; franchiseEnabled?: boolean; canNegotiate?: boolean;
}) {
  const [tagPending, startTag] = useTransition();
  const [tagged, setTagged] = useState<number | null>(players.find((p) => p.franchiseTag)?.id ?? null);
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
  if (players.length === 0 && !openPlayer) return null;
  return (
    <Card title={`${title ?? "Expiring Contracts"} (${players.length})`} accent={accent}>
      <p className="text-xs text-slate-500 mb-3">{blurb ?? "These players are entering the final year of their deal. Re-sign them before they reach free agency."}</p>
      {group === "RFA" && franchiseEnabled && (
        <p className="text-xs text-slate-500 mb-2">
          <span className="text-fuchsia-300 font-semibold">★ Franchise tag</span> (1 per club)
          <InfoTip text="Tag one RFA as your Franchise player. A franchise RFA gets TWO re-sign rounds before rivals can submit offer sheets; every other RFA gets one round, then he's open to offer sheets. One tag per club at a time." />
        </p>
      )}
      {tagMsg && <p className="text-xs text-rose-400 mb-2">{tagMsg}</p>}
      {releaseMsg && <p className="text-xs text-rose-400 mb-2">{releaseMsg}</p>}
      <div className="divide-y divide-slate-800/50">
        {players.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-2 gap-3">
            <div className="min-w-0">
              <PlayerLink id={p.id} name={p.name} className="font-medium truncate" />
              {p.farm && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30">AHL</span>}
              {/* show the REAL current deal (cap hit) — the stored contractText is a stale
                  profinhl string that can misrepresent the term; everyone here is in their
                  final year by the query filter, so label it plainly. */}
              <span className="text-xs text-slate-500 ml-2">{p.capHit ? `${M(p.capHit)} · last year` : "—"}</span>
              {group === "RFA" && p.rfaStatus && (
                <span className={`ml-2 text-[10px] font-bold uppercase ${p.rfaStatus === "QO_DUE" ? "text-sky-300" : "text-slate-400"}`}>
                  {p.rfaStatus === "QO_DUE" ? `QO ${p.qoAmount ? M(p.qoAmount) : ""} due ${p.qoDueAt?.slice(0, 10) ?? ""}` : p.rfaStatus.replaceAll("_", " ")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {group === "RFA" && franchiseEnabled && (
                <button onClick={() => toggleTag(p.id)} disabled={tagPending}
                  title="Franchise RFA — gets 2 re-sign rounds before offer sheets (1 per club)"
                  className={`px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap border ${tagged === p.id ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" : "bg-slate-800 text-slate-400 border-slate-700 hover:text-fuchsia-300"} disabled:opacity-40`}>
                  ★ {tagged === p.id ? "Franchise" : "Tag"}
                </button>
              )}
              {group === "RFA" && (
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
                  className="px-3 py-1 rounded-md bg-green-600/80 hover:bg-green-500 text-white text-xs font-semibold whitespace-nowrap">
                  Re-sign
                </button>
              ) : (
                <span title="Extensions open once the regular season starts — a player can only be re-signed during the final year of his deal."
                  className="px-3 py-1 rounded-md bg-slate-800 text-slate-500 border border-slate-700 text-xs font-semibold whitespace-nowrap cursor-not-allowed">
                  Unavailable
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {openPlayer && <ReSignModal player={openPlayer} teamId={teamId} onClose={() => setOpenPlayer(null)} />}
    </Card>
  );
}
