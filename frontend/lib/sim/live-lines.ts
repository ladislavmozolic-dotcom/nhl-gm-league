// Client-safe: how each forward line is doing so far — shots, xG and goals for/against while it was on the ice,
// rebuilt from the live stream's LINE_CHANGE events (who is out) and SHOT/GOAL events (what happened).
import type { SimEvent } from "./events";

export type LineRow = { label: string; names: string; toi: number; sf: number; sa: number; xgf: number; xga: number; gf: number; ga: number };

const absT = (e: SimEvent) => (e.period - 1) * 1200 + e.seconds;

export function liveLineStats(events: SimEvent[], homeId: number, awayId: number, nowT: number): Record<number, LineRow[]> {
  const ev = [...events].filter((e) => !(e.meta as { so?: boolean } | undefined)?.so).sort((a, b) => absT(a) - absT(b) || a.seq - b.seq);
  const rows: Record<number, Map<string, LineRow>> = { [homeId]: new Map(), [awayId]: new Map() };
  const cur: Record<number, { label: string; since: number } | null> = { [homeId]: null, [awayId]: null };
  const row = (team: number, label: string, names = "") => {
    const m = rows[team]; if (!m) return null;
    if (!m.has(label)) m.set(label, { label, names, toi: 0, sf: 0, sa: 0, xgf: 0, xga: 0, gf: 0, ga: 0 });
    const r = m.get(label)!; if (names) r.names = names; return r;
  };
  const close = (team: number, t: number) => { const c = cur[team]; if (c) { const r = row(team, c.label); if (r) r.toi += Math.max(0, t - c.since); } };
  const shotKeys = new Set(ev.filter((e) => e.type === "SHOT").map((e) => `${e.teamId}:${e.playerId}:${e.period}:${e.seconds}`));
  for (const e of ev) {
    const t = absT(e);
    if (e.type === "LINE_CHANGE" && e.teamId != null && (e.meta as { unit?: string } | undefined)?.unit === "F") {
      const m = e.meta as { label?: string; names?: string[] | string };
      const label = m.label ?? "?";
      if (!/^Line \d/.test(label)) { close(e.teamId, t); cur[e.teamId] = null; continue; } // PP/PK/4v4 units aren't lines
      close(e.teamId, t);
      cur[e.teamId] = { label, since: t };
      row(e.teamId, label, Array.isArray(m.names) ? m.names.join(" – ") : m.names ?? "");
      continue;
    }
    const isShot = e.type === "SHOT" || (e.type === "GOAL" && !shotKeys.has(`${e.teamId}:${e.playerId}:${e.period}:${e.seconds}`));
    if (!isShot && e.type !== "GOAL") continue;
    if (e.teamId == null) continue;
    const opp = e.teamId === homeId ? awayId : homeId;
    const mine = cur[e.teamId] && row(e.teamId, cur[e.teamId]!.label), theirs = cur[opp] && row(opp, cur[opp]!.label);
    if (isShot) {
      if (mine) { mine.sf++; mine.xgf += e.xg ?? 0; }
      if (theirs) { theirs.sa++; theirs.xga += e.xg ?? 0; }
    }
    if (e.type === "GOAL") { if (mine) mine.gf++; if (theirs) theirs.ga++; }
  }
  close(homeId, nowT); close(awayId, nowT);
  const out: Record<number, LineRow[]> = {};
  for (const id of [homeId, awayId]) out[id] = [...rows[id].values()].sort((a, b) => a.label.localeCompare(b.label));
  return out;
}
