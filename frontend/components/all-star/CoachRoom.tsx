"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveLineupAction } from "@/app/all-star/actions";

type Slot = "F" | "D" | "G";
type P = { id: number; name: string; slot: Slot; teamId: number; teamCode: string | null; teamLogo: string | null; line: string; hurt: boolean };
type Roster = { F: number[]; D: number[]; G: number[] };
const LIMIT: Record<Slot, number> = { F: 6, D: 3, G: 2 };
const sel = "bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 w-full";

export default function CoachRoom({ eventId, div, teamName, nominees, initial, editable }: {
  eventId: number; div: string; teamName: string; nominees: P[];
  initial: { roster: Roster; units: number[][]; starter: number | null; shootout: number[] } | null; editable: boolean;
}) {
  const router = useRouter();
  const [roster, setRoster] = useState<Roster>(initial?.roster ?? { F: [], D: [], G: [] });
  const [units, setUnits] = useState<(number | null)[][]>(initial?.units?.map((u) => [...u]) ?? [[null, null, null], [null, null, null], [null, null, null]]);
  const [starter, setStarter] = useState<number | null>(initial?.starter ?? null);
  const [shootout, setShootout] = useState<(number | null)[]>([...(initial?.shootout ?? []), null, null, null].slice(0, 3));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const byId = useMemo(() => new Map(nominees.map((p) => [p.id, p])), [nominees]);
  const clubs = useMemo(() => [...new Map(nominees.map((p) => [p.teamId, { id: p.teamId, code: p.teamCode, logo: p.teamLogo }])).values()], [nominees]);
  const chosen = new Set([...roster.F, ...roster.D, ...roster.G]);
  const repped = new Set([...chosen].map((id) => byId.get(id)?.teamId));

  const toggle = (p: P) => {
    if (!editable) return;
    setRoster((r) => {
      const cur = r[p.slot];
      const next = cur.includes(p.id) ? cur.filter((x) => x !== p.id) : cur.length >= LIMIT[p.slot] ? cur : [...cur, p.id];
      return { ...r, [p.slot]: next };
    });
    // drop him from units / goalie / shootout if removed
    if (chosen.has(p.id)) {
      setUnits((u) => u.map((x) => x.map((id) => (id === p.id ? null : id))));
      if (starter === p.id) setStarter(null);
      setShootout((s) => s.map((id) => (id === p.id ? null : id)));
    }
  };
  const nameOf = (id: number) => byId.get(id)?.name ?? "?";
  const setUnit = (ui: number, pos: number, v: string) => setUnits((u) => u.map((x, i) => (i === ui ? x.map((id, j) => (j === pos ? (v ? Number(v) : null) : id)) : x)));
  const save = () => start(async () => {
    setMsg(null);
    if (units.some((u) => u.some((x) => x == null)) || starter == null || shootout.some((x) => x == null)) { setMsg({ ok: false, text: "Fill all three units, the starting goalie and 3 shootout shooters." }); return; }
    const r = await saveLineupAction(eventId, div as never, { roster, units: units as number[][], starter, shootout: shootout as number[] });
    if (r.ok) { setMsg({ ok: true, text: "✅ Lineup saved — you can keep changing it until the deadline." }); router.refresh(); }
    else setMsg({ ok: false, text: r.error });
  });

  return (
    <div className="space-y-5">
      {/* 1. pick the 11 */}
      <div>
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <span className="font-bold text-slate-100">1. Roster</span>
          {(["F", "D", "G"] as const).map((s) => <span key={s} className={`text-xs ${roster[s].length === LIMIT[s] ? "text-emerald-400" : "text-slate-400"}`}>{s} {roster[s].length}/{LIMIT[s]}</span>)}
          <span className="text-xs text-slate-500">Clubs: {clubs.map((c) => <span key={c.id} className={`ml-1 ${repped.has(c.id) ? "text-emerald-400" : "text-red-400"}`}>{c.code}</span>)}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {clubs.map((c) => (
            <div key={c.id} className={`rounded-lg border p-2 ${repped.has(c.id) ? "border-slate-700" : "border-red-900/60"}`}>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 mb-1.5">{c.logo && <img src={c.logo} alt="" className="w-4 h-4 object-contain" />}{c.code}</div>
              <div className="space-y-1">
                {nominees.filter((p) => p.teamId === c.id).map((p) => {
                  const on = roster[p.slot].includes(p.id);
                  const full = !on && roster[p.slot].length >= LIMIT[p.slot];
                  return (
                    <button key={p.id} type="button" onClick={() => toggle(p)} disabled={!editable || full}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs ${on ? "bg-blue-600 text-white" : "bg-slate-800/50 text-slate-300 hover:bg-slate-800"} ${full ? "opacity-40" : ""}`}>
                      <span className="w-4 font-bold">{p.slot}</span><span className="flex-1 truncate">{p.name}{p.hurt ? " 🏥" : ""}</span><span className={`text-[10px] ${on ? "text-blue-100" : "text-slate-500"}`}>{p.line}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. 3-on-3 units */}
      <div>
        <div className="font-bold text-slate-100 mb-2">2. Three-on-three units <span className="text-xs font-normal text-slate-500">(2 F + 1 D · unit 1 plays the most)</span></div>
        <div className="grid gap-3 md:grid-cols-3">
          {units.map((u, ui) => (
            <div key={ui} className="rounded-lg border border-slate-700 p-2 space-y-1.5">
              <div className="text-xs font-bold text-slate-400">Unit {ui + 1}</div>
              {[0, 1].map((j) => (
                <select key={j} className={sel} disabled={!editable} value={u[j] ?? ""} onChange={(e) => setUnit(ui, j, e.target.value)}>
                  <option value="">Forward…</option>{roster.F.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
                </select>
              ))}
              <select className={sel} disabled={!editable} value={u[2] ?? ""} onChange={(e) => setUnit(ui, 2, e.target.value)}>
                <option value="">Defenseman…</option>{roster.D.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* 3. goalie + shootout */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="font-bold text-slate-100 mb-2">3. Starting goalie <span className="text-xs font-normal text-slate-500">(the other plays the 2nd half)</span></div>
          <div className="flex flex-wrap gap-2">
            {roster.G.map((id) => (
              <button key={id} type="button" disabled={!editable} onClick={() => setStarter(id)} className={`rounded-lg border px-3 py-1.5 text-sm ${starter === id ? "bg-emerald-600 border-emerald-500 text-white" : "border-slate-700 text-slate-300"}`}>{nameOf(id)}</button>
            ))}
            {roster.G.length === 0 && <span className="text-xs text-slate-500">Pick your two goalies first.</span>}
          </div>
        </div>
        <div>
          <div className="font-bold text-slate-100 mb-2">4. Shootout order</div>
          <div className="grid grid-cols-3 gap-2">
            {shootout.map((id, i) => (
              <select key={i} className={sel} disabled={!editable} value={id ?? ""} onChange={(e) => setShootout((s) => s.map((x, j) => (j === i ? (e.target.value ? Number(e.target.value) : null) : x)))}>
                <option value="">Shooter {i + 1}…</option>{[...roster.F, ...roster.D].map((pid) => <option key={pid} value={pid}>{nameOf(pid)}</option>)}
              </select>
            ))}
          </div>
        </div>
      </div>

      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={pending} className="px-4 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40">{pending ? "…" : `Save ${teamName} lineup`}</button>
          {msg && <span className={`text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</span>}
        </div>
      )}
    </div>
  );
}
