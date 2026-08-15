"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startLotteryBroadcastAction, resetLotteryAction, practiceLotteryAction } from "@/app/admin/draft-lottery/actions";
import DraftChat from "@/components/DraftChat";

export type OddsRow = { pos: number; code: string; logo: string | null; points: number; pct: number };
type Row = { pick: number; code: string; name: string; logo: string | null; viaLottery: boolean; combo?: number[] | null };

// cumulative phase timeline (seconds from startedAt)
const T = { intro: 4, draw2: 11, reveal2: 15, draw1: 22, reveal1: 26 };
function phaseAt(el: number): "intro" | "draw2" | "reveal2" | "draw1" | "reveal1" | "done" {
  if (el < T.intro) return "intro";
  if (el < T.draw2) return "draw2";
  if (el < T.reveal2) return "reveal2";
  if (el < T.draw1) return "draw1";
  if (el < T.reveal1) return "reveal1";
  return "done";
}

// The real NHL lottery uses 14 numbered ping-pong balls; four are drawn to form a
// combination (1001 usable) assigned to a club by its odds — not one ball per club.
const DRUM_BALLS = [4, 9, 13, 2, 7, 11, 1, 14, 6, 10, 3, 12, 8, 5];
// A spinning drum of 14 balls; as the draw progresses, the four winning balls drop
// into the chute one by one — the real numbers, so the whole league can verify.
function LotteryDrum({ label, balls, progress }: { label: string; balls: number[] | null; progress: number }) {
  const four = balls ?? [];
  // reveal balls one at a time across the phase, all four out by ~80% through
  const shown = Math.min(four.length, Math.max(0, Math.floor(progress * 5)));
  const slots = [0, 1, 2, 3];
  return (
    <div className="text-center py-8">
      <div className="text-sm uppercase tracking-widest text-amber-400/90 mb-1">{label}</div>
      <div className="text-[11px] text-slate-500 mb-5">14 balls · draw of 4 → the winning combination</div>
      <style>{`@keyframes lotDrum{to{transform:rotate(360deg)}}@keyframes lotDrumRev{to{transform:rotate(-360deg)}}@keyframes lotDrop{0%{opacity:0;transform:translateY(-20px) scale(.4)}60%{opacity:1;transform:translateY(4px) scale(1.15)}100%{opacity:1;transform:translateY(0) scale(1)}}`}</style>
      {/* spinning drum */}
      <div className="relative w-44 h-44 mx-auto rounded-full border-[6px] border-slate-500/50 bg-gradient-to-br from-slate-800 to-slate-950 shadow-inner overflow-hidden">
        {DRUM_BALLS.map((n, i) => (
          <div key={i} className="absolute inset-0" style={{ animation: "lotDrum 3.2s linear infinite", animationDelay: `${(-i * 3.2 / DRUM_BALLS.length).toFixed(2)}s` }}>
            <span className="absolute left-1/2 top-3 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-b from-white to-slate-300 text-slate-900 font-bold grid place-items-center text-sm shadow-md"
              style={{ display: "inline-grid", animation: "lotDrumRev 3.2s linear infinite", animationDelay: `${(-i * 3.2 / DRUM_BALLS.length).toFixed(2)}s` }}>{n}</span>
          </div>
        ))}
      </div>
      {/* chute + the four drawn balls dropping out */}
      <div className="mx-auto w-3 h-4 bg-slate-600/60 rounded-b" />
      <div className="mt-3 flex items-center justify-center gap-2 h-12">
        {slots.map((s) => {
          const out = s < shown;
          return out ? (
            <span key={`${s}-${four[s]}`} className="w-10 h-10 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 text-slate-900 font-black grid place-items-center text-lg shadow-[0_0_16px_rgba(245,200,66,0.5)]" style={{ animation: "lotDrop 0.5s ease" }}>{four[s]}</span>
          ) : (
            <span key={s} className="w-10 h-10 rounded-full border-2 border-dashed border-slate-700 grid place-items-center text-slate-600 text-lg">?</span>
          );
        })}
      </div>
    </div>
  );
}

function RevealCard({ w, label, big }: { w?: Row; label: string; big?: boolean }) {
  return (
    <div className={`rounded-2xl border ${big ? "border-amber-500/60" : "border-slate-700"} bg-gradient-to-b from-slate-900 to-slate-950 p-6 text-center`}>
      <div className="text-xs uppercase tracking-widest text-amber-400/90">{label}</div>
      {w ? (
        <div className="mt-3 animate-[lbFade_0.5s_ease]">
          <style>{`@keyframes lbFade{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:none}}`}</style>
          {w.logo && <img src={w.logo} alt="" className={`${big ? "w-24 h-24" : "w-20 h-20"} object-contain mx-auto mb-2`} />}
          <div className={`${big ? "text-3xl" : "text-2xl"} font-black text-white`}>{w.name}</div>
          {w.combo && w.combo.length > 0 && (
            <div className="mt-3 flex items-center justify-center gap-1.5">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 mr-1">combo</span>
              {w.combo.map((n, i) => (
                <span key={i} className="w-6 h-6 rounded-full bg-white text-slate-900 text-xs font-bold grid place-items-center">{n}</span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 h-[104px] grid place-items-center text-5xl text-slate-700">?</div>
      )}
    </div>
  );
}

export default function LotteryBroadcast({ year, odds, admin, myTeamId }: { year: number; odds: OddsRow[]; admin: boolean; myTeamId: number | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ startedAt: string | null; order?: Row[] }>({ startedAt: null });
  const [now, setNow] = useState(() => 0);
  const [replayStart, setReplayStart] = useState<number | null>(null);
  const [practice, setPractice] = useState<Row[] | null>(null);

  useEffect(() => {
    let alive = true;
    const poll = async () => { try { const r = await fetch(`/api/draft/lottery-state?year=${year}`, { cache: "no-store" }); const j = await r.json(); if (alive) setState(j); } catch {} };
    poll(); const t = setInterval(poll, 2500); return () => { alive = false; clearInterval(t); };
  }, [year]);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);

  const startedMs = replayStart ?? (state.startedAt ? new Date(state.startedAt).getTime() : null);
  const order = practice ?? state.order ?? [];
  const winners = order.filter((o) => o.viaLottery).sort((a, b) => a.pick - b.pick);
  const isPractice = practice != null;
  const elapsed = startedMs != null && now ? (now - startedMs) / 1000 : -1;
  const live = (startedMs != null || isPractice) && order.length > 0;
  // practice always plays from its own start; use a local timer via replayStart
  const phase = !live ? "lobby" : phaseAt(isPractice && replayStart == null ? 999 : elapsed);

  // clear the standalone verify checker whenever a new draw begins
  const clearVerify = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event("lottery:new-draw")); };
  const startBroadcast = () => start(async () => { clearVerify(); await startLotteryBroadcastAction(year); setPractice(null); setReplayStart(null); router.refresh(); });
  const reset = () => start(async () => { await resetLotteryAction(year); setPractice(null); setReplayStart(null); router.refresh(); });
  const doPractice = () => start(async () => { clearVerify(); const r = await practiceLotteryAction(year); if (r.order) { setPractice(r.order as Row[]); setReplayStart(Date.now()); } });
  const replay = () => { setReplayStart(Date.now()); };

  // computed as JSX (NOT a nested component) so the 250ms ticks diff instead of
  // remounting — otherwise the drum/reveal animations restart every tick.
  const stage = (() => {
    if (phase === "lobby") {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center">
            <div className="text-4xl mb-2">🎰</div>
            <div className="text-lg font-bold text-slate-100">The {year} Draft Lottery hasn&apos;t started.</div>
            <div className="text-sm text-slate-500 mt-1">Odds are set — chat while you wait. {admin ? "Start it when everyone&apos;s here." : "The commissioner will begin the draw."}</div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-800 text-sm font-semibold text-slate-200">Lottery odds · #1 pick</div>
            <table className="w-full text-sm"><tbody>
              {odds.map((o) => (
                <tr key={o.pos} className="border-b border-slate-800/50">
                  <td className="px-3 py-1.5 text-slate-500 tabular-nums w-10 text-right">{o.pos}</td>
                  <td className="px-2 py-1.5">{o.logo && <img src={o.logo} alt="" className="w-5 h-5 object-contain inline" />}</td>
                  <td className="px-2 py-1.5 font-medium text-slate-200">{o.code}</td>
                  <td className="px-2 py-1.5 text-slate-500 tabular-nums">{o.points} pts</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-amber-300">{o.pct}%</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
      );
    }
    if (phase === "intro") return <div className="rounded-2xl border border-amber-500/40 bg-slate-900/60 p-10 text-center"><div className="text-5xl mb-3">🎰</div><div className="text-xl font-black text-white">The {year} Draft Lottery is underway…</div></div>;
    if (phase === "draw2") return <div className="rounded-2xl border border-slate-700 bg-slate-900/60"><LotteryDrum label="Drawing the 2nd overall pick" balls={winners[1]?.combo ?? null} progress={(elapsed - T.intro) / (T.draw2 - T.intro)} /></div>;
    if (phase === "draw1") return (
      <div className="space-y-3">
        <RevealCard w={winners[1]} label="2nd overall pick" />
        <div className="rounded-2xl border border-amber-500/40 bg-slate-900/60"><LotteryDrum label="Drawing the 1st overall pick" balls={winners[0]?.combo ?? null} progress={(elapsed - T.reveal2) / (T.draw1 - T.reveal2)} /></div>
      </div>
    );
    // reveal2, reveal1, done
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <RevealCard w={phase === "reveal2" || phase === "reveal1" || phase === "done" ? winners[1] : undefined} label="2nd overall pick" />
          <RevealCard w={phase === "reveal1" || phase === "done" ? winners[0] : undefined} label="1st overall pick" big />
        </div>
        {phase === "done" && (
          <div>
            <div className="text-sm text-slate-400 mb-2">{isPractice && <span className="text-amber-400 font-semibold mr-2">PRACTICE — not saved.</span>}Full round-1 order</div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {order.map((o) => (
                <div key={o.pick} className={`flex items-center gap-3 rounded-lg border px-3 py-1.5 ${o.viaLottery ? "border-amber-500/40 bg-amber-500/10" : "border-slate-800 bg-slate-900/40"}`}>
                  <span className="w-8 text-center text-sm font-bold text-slate-500 tabular-nums">{o.pick}</span>
                  {o.logo && <img src={o.logo} alt="" className="w-7 h-7 object-contain" />}
                  <span className="font-medium text-slate-100">{o.name}</span>
                  {o.viaLottery && <span className="ml-auto text-xs font-semibold text-amber-400">🎰</span>}
                </div>
              ))}
            </div>
            <button onClick={replay} className="mt-3 text-xs text-amber-400 hover:text-amber-300 underline">↻ Replay the draw</button>
          </div>
        )}
      </div>
    );
  })();

  return (
    <div className="space-y-4">
      {/* admin controls */}
      <div className="flex flex-wrap items-center gap-3">
        {admin && state.startedAt == null && !isPractice && (
          <button onClick={startBroadcast} disabled={pending} className="rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold px-6 py-2.5 text-lg">🎰 Start the Lottery (live)</button>
        )}
        <button onClick={doPractice} disabled={pending} className="rounded-xl border border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40 text-amber-300 font-semibold px-5 py-2.5">🎲 Practice draw</button>
        {admin && state.startedAt != null && <button onClick={reset} disabled={pending} className="text-xs text-slate-400 hover:text-slate-200 underline">Reset lottery</button>}
        {isPractice && <button onClick={() => { setPractice(null); setReplayStart(null); }} className="text-xs text-slate-500 hover:text-slate-300 underline">Exit practice</button>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>{stage}</div>
        <DraftChat canChat={myTeamId != null} myTeamId={myTeamId} channel="lottery" />
      </div>
    </div>
  );
}
