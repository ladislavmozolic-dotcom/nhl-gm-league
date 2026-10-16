// Client-safe Game Flow (xG timeline) built straight from the live event stream — the same shape the
// finished-game page gets from lib/game-report-server, so GameFlowChart draws both.
import type { GameFlow, FlowBin } from "@/lib/game-report-server";
import type { SimEvent } from "./events";

const P = 1200;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const per = (p: number) => (p <= 3 ? `P${p}` : "OT");

/** Team xG so far from the stream (shots on goal, goals). */
export function liveXg(events: SimEvent[], homeId: number): { home: number; away: number } {
  let home = 0, away = 0;
  for (const s of shotPoints(events, homeId)) { if (s.home) home += s.xg; else away += s.xg; }
  return { home, away };
}

function shotPoints(events: SimEvent[], homeId: number) {
  const reg = events.filter((e) => !(e.meta as { so?: boolean } | undefined)?.so);
  const shots = reg.filter((e) => e.type === "SHOT" && e.xg != null);
  const keys = new Set(shots.map((s) => `${s.teamId}:${s.playerId}:${s.period}:${s.seconds}`));
  return shots.map((e) => ({ t: (e.period - 1) * P + e.seconds, home: e.teamId === homeId, xg: e.xg ?? 0 }))
    .concat(reg.filter((g) => g.type === "GOAL" && !keys.has(`${g.teamId}:${g.playerId}:${g.period}:${g.seconds}`))
      .map((g) => ({ t: (g.period - 1) * P + g.seconds, home: g.teamId === homeId, xg: g.xg && g.xg > 0 ? g.xg : 0.05 })))
    .sort((a, b) => a.t - b.t);
}

export function liveFlow(events: SimEvent[], home: { id: number; code: string | null }, away: { id: number; code: string | null }, nowT: number): GameFlow {
  const pts = shotPoints(events, home.id);
  let cum = 0, homeXg = 0, awayXg = 0;
  const points: GameFlow["points"] = [{ t: 0, diff: 0 }];
  for (const s of pts) { cum += s.home ? s.xg : -s.xg; if (s.home) homeXg += s.xg; else awayXg += s.xg; points.push({ t: s.t, diff: +cum.toFixed(3) }); }
  points.push({ t: Math.max(nowT, pts.length ? pts[pts.length - 1].t : 0), diff: +cum.toFixed(3) });
  const goals = events.filter((e) => e.type === "GOAL" && !(e.meta as { so?: boolean } | undefined)?.so);
  const code = (id?: number) => (id === home.id ? home.code : away.code) ?? "";
  const lastP = Math.max(3, ...events.map((e) => e.period));
  const totalSec = lastP <= 3 ? 3600 : 3600 + 300;
  const bins: FlowBin[] = [];
  for (let start = 0; start < totalSec; start += 300) {
    const end = start + 300, inWin = (t: number) => t >= start && t < end;
    let hx = 0, ax = 0;
    for (const s of pts) if (inWin(s.t)) { if (s.home) hx += s.xg; else ax += s.xg; }
    const plays: string[] = [];
    for (const g of goals) if (inWin((g.period - 1) * P + g.seconds)) plays.push(`${mmss(g.seconds)} ${per(g.period)} — 🚨 ${code(g.teamId)} ${g.playerName ?? ""}${g.strength && g.strength !== "EV" ? ` (${g.strength})` : ""}`);
    for (const sv of events) if (sv.type === "SAVE" && (sv.xg ?? 0) >= 0.18 && inWin((sv.period - 1) * P + sv.seconds)) plays.push(`${mmss(sv.seconds)} ${per(sv.period)} — 🧤 ${sv.playerName ?? ""} denies ${sv.targetName ?? ""}`);
    bins.push({ startSec: start, endSec: end, label: `${mmss(start)}–${mmss(Math.min(end, totalSec))}`, homeXg: +hx.toFixed(2), awayXg: +ax.toFixed(2), plays });
  }
  return {
    homeCode: home.code ?? "HOME", awayCode: away.code ?? "AWAY", homeXg: +homeXg.toFixed(2), awayXg: +awayXg.toFixed(2), points,
    goals: goals.map((g) => ({ t: (g.period - 1) * P + g.seconds, home: g.teamId === home.id, text: `${code(g.teamId)} ${g.playerName ?? ""}` })),
    bins, maxAbs: +Math.max(0.5, ...points.map((p) => Math.abs(p.diff))).toFixed(3),
  };
}
