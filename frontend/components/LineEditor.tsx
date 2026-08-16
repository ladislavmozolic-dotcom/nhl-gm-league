"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import LinesNav from "@/components/LinesNav";
import { autoFill, type TeamLinesData, type ForwardLine, type DefensePair, type SpecialUnit } from "@/lib/sim/lines-core";
import { DIAL_LABELS, DIAL_DESC, mergeTactics, type PuckStyle, type DZone, type PpStyle, type PkStyle } from "@/lib/sim/tactics";
import type { GameStrategy, StratWeights } from "@/lib/sim/types";

type Player = { id: number; name: string; position: string; overall: number };
type Props = {
  teamName: string; teamSlug: string;
  players: Player[]; goalies: Player[];
  initial: TeamLinesData;
  onSave: (slug: string, data: TeamLinesData) => Promise<void>;
};

const isD = (p: string) => /(^|\/)D(\/|$)/.test(p) || p === "D";
const STATES: Array<{ key: keyof Omit<GameStrategy, "goaliePull">; label: string }> = [
  { key: "winning2", label: "Winning by 2+" },
  { key: "winning1", label: "Winning by 1" },
  { key: "tied", label: "Score tied" },
  { key: "losing1", label: "Losing by 1" },
  { key: "losing2", label: "Losing by 2+" },
];
const TABS = ["Forward", "Defense", "PP", "4 vs 4", "PK4", "PK3", "Others", "Last Min", "Overtime", "Strategy"] as const;

export default function LineEditor({ teamName, teamSlug, players, goalies, initial, onSave }: Props) {
  const [data, setData] = useState<TeamLinesData>(initial);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Forward");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const byId = useMemo(() => new Map([...players, ...goalies].map((p) => [p.id, p])), [players, goalies]);
  const nameOf = (id: number | null) => (id == null ? "" : byId.get(id)?.name ?? `#${id}`);
  const byName = (a: Player, b: Player) => a.name.localeCompare(b.name);
  const forwards = useMemo(() => players.filter((p) => !isD(p.position)).sort(byName), [players]);
  const defense = useMemo(() => players.filter((p) => isD(p.position)).sort(byName), [players]);
  const goaliesByName = useMemo(() => [...goalies].sort(byName), [goalies]);

  // duplicates that matter: the same player twice inside ONE line/pair/unit
  const dupes = useMemo(() => {
    const bad = new Set<string>();
    const scan = (ids: (number | null)[]) => {
      const seen = new Set<number>();
      for (const id of ids) if (id != null) { if (seen.has(id)) bad.add(nameOf(id)); seen.add(id); }
    };
    for (const l of data.forwardLines) scan([l.lw, l.c, l.rw]);
    for (const p of data.defensePairs) scan([p.ld, p.rd]);
    for (const key of ["pp", "fourVFour", "pk4", "pk3", "overtime"] as const)
      for (const u of data.situations[key]) scan(u.players);
    return [...bad];
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // validation: each time-share group must total 100%, each tactics row must total 5
  const timeSum = (arr: { timePct: number }[]) => arr.reduce((t, x) => t + (x.timePct || 0), 0);
  const timeGroups: Array<[string, number]> = [
    ["Forward", timeSum(data.forwardLines)],
    ["Defense", timeSum(data.defensePairs)],
    ["PP", timeSum(data.situations.pp)],
    ["4 vs 4", timeSum(data.situations.fourVFour)],
    ["PK4", timeSum(data.situations.pk4)],
    ["PK3", timeSum(data.situations.pk3)],
    ["Overtime", timeSum(data.situations.overtime)],
  ];
  const badTime = timeGroups.filter(([, s]) => s !== 100);
  const badTactics = STATES.filter((st) => { const w = data.strategy[st.key]; return w.phy + w.df + w.of !== 5; });
  // per-line tactic: PHY+DF+OF on every unit must total exactly 5
  const tSum = (t?: { phy: number; df: number; of: number }) => { const x = t ?? { phy: 1, df: 2, of: 2 }; return x.phy + x.df + x.of; };
  const badLineTactics = [
    ...data.forwardLines.map((l) => tSum(l.tactic)),
    ...data.defensePairs.map((p) => tSum(p.tactic)),
    ...([data.situations.pp, data.situations.pk4, data.situations.pk3, data.situations.fourVFour, data.situations.overtime].flatMap((us) => us.map((u) => tSum(u.tactic)))),
  ].some((s) => s !== 5);
  const invalid = dupes.length > 0 || badTime.length > 0 || badTactics.length > 0 || badLineTactics;

  const change = (fn: (d: TeamLinesData) => void) => { setData((d) => { const c = structuredClone(d); fn(c); return c; }); setSaved(false); };
  const save = () => start(async () => { await onSave(teamSlug, data); setSaved(true); });
  const auto = () => { setData(autoFill(data, players, goalies)); setSaved(false); };

  // ---------- reusable inputs ----------
  const Select = ({ value, onChange, pool }: { value: number | null; onChange: (v: number | null) => void; pool: Player[] }) => (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="w-full min-w-[132px] bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm">
      <option value="">— empty —</option>
      {value != null && !pool.some((p) => p.id === value) && <option value={value}>{nameOf(value)}</option>}
      {pool.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.overall})</option>)}
    </select>
  );

  // number field with visibly separated − / + steppers. `compact` shrinks it for
  // the 0-5 tactic cells so the player-name columns keep their width.
  const Stepper = ({ value, onChange, min = 0, max = 99, step = 1, w = "w-14", compact = false }: {
    value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; w?: string; compact?: boolean;
  }) => {
    const clamp = (v: number) => Math.max(min, Math.min(max, v));
    const btn = compact ? "w-6 h-7 text-sm" : "w-7 h-8 text-base";
    const inp = compact ? "w-8 px-1 py-1" : `${w} px-2 py-1.5`;
    return (
      <div className={`inline-flex items-center ${compact ? "gap-1" : "gap-2"}`}>
        <button type="button" onClick={() => onChange(clamp(value - step))}
          className={`${btn} rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 leading-none`}>−</button>
        <input type="number" min={min} max={max} value={value} onChange={(e) => onChange(clamp(Number(e.target.value)))}
          className={`${inp} bg-slate-900 border border-slate-700 rounded text-sm text-center tabular-nums`} />
        <button type="button" onClick={() => onChange(clamp(value + step))}
          className={`${btn} rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 leading-none`}>+</button>
      </div>
    );
  };

  // ---------- section renderers ----------
  const setFwd = (i: number, slot: keyof ForwardLine, v: number | null) => change((d) => { (d.forwardLines[i][slot] as number | null) = v; });
  const setDef = (i: number, slot: keyof DefensePair, v: number | null) => change((d) => { (d.defensePairs[i][slot] as number | null) = v; });

  // per-line tactic (PHY/DF/OF; each row must total 5). tac() supplies the neutral
  // baseline for any line that has no tactic yet (legacy / newly added).
  const NEUT = { phy: 1, df: 2, of: 2 };
  const tac = (t?: { phy: number; df: number; of: number }) => t ?? NEUT;
  const setFwdTac = (i: number, k: "phy" | "df" | "of", v: number) => change((d) => { d.forwardLines[i].tactic = { ...tac(d.forwardLines[i].tactic), [k]: v }; });
  const setDefTac = (i: number, k: "phy" | "df" | "of", v: number) => change((d) => { d.defensePairs[i].tactic = { ...tac(d.defensePairs[i].tactic), [k]: v }; });
  // per-line SYSTEM override (empty = inherit the team system). Forward lines pick a
  // Puck Style; D pairs pick a D-Zone. Lets e.g. a defensive 4th line under an
  // attacking team, or a shut-down pair under an aggressive one.
  const setFwdPuck = (i: number, v: PuckStyle | "") => change((d) => { if (v) d.forwardLines[i].puck = v; else delete d.forwardLines[i].puck; });
  const setDefDzone = (i: number, v: DZone | "") => change((d) => { if (v) d.defensePairs[i].dzone = v; else delete d.defensePairs[i].dzone; });
  const SysSelect = ({ value, opts, desc, onChange }: { value: string | undefined; opts: Record<string, string>; desc?: Record<string, string>; onChange: (v: string) => void }) => (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}
      title={value && desc?.[value] ? desc[value] : "Inherit the team system (set an option to override just this line)"}
      className={`bg-slate-800 border rounded px-1.5 py-1 text-xs cursor-help ${value ? "border-sky-600 text-sky-300" : "border-slate-700 text-slate-400"}`}>
      <option value="" title="Inherit the team system (from Team → System)">Team</option>
      {Object.entries(opts).filter(([k]) => k !== "balanced").map(([k, lbl]) => <option key={k} value={k} title={desc?.[k]}>{lbl}</option>)}
    </select>
  );
  // team-level special-teams formation (stored on data.system, persisted with lines)
  const setStyle = (k: "ppStyle" | "pkStyle", v: string) => change((d) => { d.system = { ...mergeTactics(d.system), [k]: v as PpStyle & PkStyle }; });
  const FormationPicker = (k: "ppStyle" | "pkStyle", label: string) => {
    const opts = DIAL_LABELS[k]; const desc = DIAL_DESC[k];
    const val = (mergeTactics(data.system) as Record<string, string>)[k] ?? "balanced";
    return (
      <div className="mb-3 bg-slate-900/40 border border-slate-800 rounded-lg p-3">
        <div className="flex items-baseline gap-2 mb-1.5"><span className="text-sm font-semibold">{label}</span><span className="text-xs text-slate-500">classic NHL systems — hover an option for what it does</span></div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(opts).map(([kk, lbl]) => (
            <button key={kk} type="button" title={desc?.[kk]} onClick={() => setStyle(k, kk)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors cursor-help ${
                val === kk ? "bg-blue-600 text-white border-blue-500" : "border-slate-700 text-slate-300 hover:bg-slate-800/60"
              }`}>{lbl as string}</button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{desc?.[val]}</p>
      </div>
    );
  };
  const setUnitTac = (key: keyof TeamLinesData["situations"] & string, ui: number, k: "phy" | "df" | "of", v: number) =>
    change((d) => { const u = (d.situations[key] as SpecialUnit[])[ui]; u.tactic = { ...tac(u.tactic), [k]: v }; });
  // three PHY/DF/OF steppers for one unit's tactic (clamped 0..5, red when the row ≠ 5)
  const TacCells = ({ t, onSet }: { t?: { phy: number; df: number; of: number }; onSet: (k: "phy" | "df" | "of", v: number) => void }) => {
    const tt = tac(t); const bad = tt.phy + tt.df + tt.of !== 5;
    return (["phy", "df", "of"] as const).map((k) => (
      <td key={k} className="px-1 py-1.5 text-center">
        <Stepper value={tt[k]} step={1} compact onChange={(v) => onSet(k, Math.max(0, Math.min(5, v as unknown as number)))} />
        {bad && k === "of" && <span className="ml-1 text-[10px] text-rose-400" title="PHY+DF+OF must total 5">≠5</span>}
      </td>
    ));
  };

  // what each 0-5 tactic dial means (native hover tooltip)
  const TAC_DESC: Record<string, string> = {
    PHY: "Physical play (0-5): hitting, board battles and net-front presence. Higher = a heavier, more physical unit that forechecks and grinds.",
    DF: "Defensive commitment (0-5): backchecking, shot-blocking and staying home. Higher = a shut-down unit that protects leads and suppresses chances.",
    OF: "Offensive push (0-5): pinching, joining the rush and pressing for chances. Higher = an attacking unit that generates more but leaks more.",
  };
  // one labelled 0-5 tactic stepper — hover the label for what it means
  const TacStep = ({ label, value, onSet }: { label: string; value: number; onSet: (v: number) => void }) => (
    <div className="flex items-center gap-1.5">
      <span title={TAC_DESC[label]} className="text-[11px] uppercase tracking-wide text-slate-500 w-8 cursor-help border-b border-dotted border-slate-600">{label}</span>
      <Stepper value={value} step={1} compact onChange={(v) => onSet(Math.max(0, Math.min(5, v as unknown as number)))} />
    </div>
  );
  // a player slot: small label above a full-width select
  const Slot = ({ label, value, onChange, pool }: { label: string; value: number | null; onChange: (v: number | null) => void; pool: Player[] }) => (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">{label}</div>
      <Select value={value} onChange={onChange} pool={pool} />
    </div>
  );

  const LineTotalBar = (rows: { timePct: number }[]) => {
    const tot = timeSum(rows);
    return (
      <div className="flex justify-end items-center gap-2 text-xs pt-1">
        <span className="uppercase tracking-wide text-slate-500">Time total</span>
        <span className={`font-bold tabular-nums ${tot === 100 ? "text-green-400" : "text-red-400"}`}>{tot}%{tot !== 100 && " ✗"}</span>
      </div>
    );
  };

  const ForwardSection = (
    <section className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">5 vs 5 Forward</h2>
      {data.forwardLines.map((l, i) => {
        const t = tac(l.tactic); const bad = t.phy + t.df + t.of !== 5;
        return (
          <div key={i} className="bg-slate-900/40 border border-slate-800 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-300">Line {i + 1}</span>
              <div className="flex items-center gap-2"><span className="text-[11px] uppercase tracking-wide text-slate-500">Time</span><Stepper value={l.timePct} step={1} onChange={(v) => setFwd(i, "timePct", v as unknown as number)} /><span className="text-slate-500 text-sm">%</span></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Slot label="Left Wing" value={l.lw} onChange={(v) => setFwd(i, "lw", v)} pool={forwards} />
              <Slot label="Center" value={l.c} onChange={(v) => setFwd(i, "c", v)} pool={forwards} />
              <Slot label="Right Wing" value={l.rw} onChange={(v) => setFwd(i, "rw", v)} pool={forwards} />
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 border-t border-slate-800/60">
              <TacStep label="PHY" value={t.phy} onSet={(v) => setFwdTac(i, "phy", v)} />
              <TacStep label="DF" value={t.df} onSet={(v) => setFwdTac(i, "df", v)} />
              <TacStep label="OF" value={t.of} onSet={(v) => setFwdTac(i, "of", v)} />
              {bad && <span className="text-[11px] text-rose-400" title="PHY+DF+OF must total 5">PHY+DF+OF ≠ 5</span>}
              <div className="flex items-center gap-1.5 ml-auto">
                <span title="Puck Style for this line only (empty = inherit the team system from Team → System). e.g. a Cycle 4th line under a Rush team." className="text-[11px] uppercase tracking-wide text-slate-500 cursor-help border-b border-dotted border-slate-600">System</span>
                <SysSelect value={l.puck} opts={DIAL_LABELS.puckStyle} desc={DIAL_DESC.puckStyle} onChange={(v) => setFwdPuck(i, v as PuckStyle | "")} />
              </div>
            </div>
          </div>
        );
      })}
      {LineTotalBar(data.forwardLines)}
    </section>
  );

  const DefenseSection = (
    <section className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">5 vs 5 Defense</h2>
      {data.defensePairs.map((p, i) => {
        const t = tac(p.tactic); const bad = t.phy + t.df + t.of !== 5;
        return (
          <div key={i} className="bg-slate-900/40 border border-slate-800 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-300">Pair {i + 1}</span>
              <div className="flex items-center gap-2"><span className="text-[11px] uppercase tracking-wide text-slate-500">Time</span><Stepper value={p.timePct} step={1} onChange={(v) => setDef(i, "timePct", v as unknown as number)} /><span className="text-slate-500 text-sm">%</span></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Slot label="Left Defense" value={p.ld} onChange={(v) => setDef(i, "ld", v)} pool={defense} />
              <Slot label="Right Defense" value={p.rd} onChange={(v) => setDef(i, "rd", v)} pool={defense} />
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 border-t border-slate-800/60">
              <TacStep label="PHY" value={t.phy} onSet={(v) => setDefTac(i, "phy", v)} />
              <TacStep label="DF" value={t.df} onSet={(v) => setDefTac(i, "df", v)} />
              <TacStep label="OF" value={t.of} onSet={(v) => setDefTac(i, "of", v)} />
              {bad && <span className="text-[11px] text-rose-400" title="PHY+DF+OF must total 5">PHY+DF+OF ≠ 5</span>}
              <div className="flex items-center gap-1.5 ml-auto">
                <span title="D-Zone for this pair only (empty = inherit the team system). e.g. a Collapse shut-down pair to defend a lead." className="text-[11px] uppercase tracking-wide text-slate-500 cursor-help border-b border-dotted border-slate-600">System</span>
                <SysSelect value={p.dzone} opts={DIAL_LABELS.dZone} desc={DIAL_DESC.dZone} onChange={(v) => setDefDzone(i, v as DZone | "")} />
              </div>
            </div>
          </div>
        );
      })}
      {LineTotalBar(data.defensePairs)}
    </section>
  );

  // special-teams / situational units (generic ordered slots)
  const setUnit = (key: keyof TeamLinesData["situations"] & string, ui: number, si: number, v: number | null) =>
    change((d) => { (d.situations[key] as SpecialUnit[])[ui].players[si] = v; });
  const setUnitTime = (key: keyof TeamLinesData["situations"] & string, ui: number, v: number) =>
    change((d) => { (d.situations[key] as SpecialUnit[])[ui].timePct = v; });

  const UnitSection = (key: "pp" | "fourVFour" | "pk4" | "pk3" | "overtime", title: string, labels: string[], poolFor: (i: number) => Player[]) => {
    const units = data.situations[key];
    return (
      <UnitBlock title={title} head={["Unit", ...labels, "PHY", "DF", "OF", "Time %"]} timeTotal={timeSum(units)}>
        {units.map((u, ui) => (
          <tr key={ui} className="border-b border-slate-800/60">
            <td className="px-2 py-1.5 text-slate-500">{ui + 1}</td>
            {u.players.map((val, si) => (
              <td key={si} className="px-2"><Select value={val} onChange={(v) => setUnit(key, ui, si, v)} pool={poolFor(si)} /></td>
            ))}
            <TacCells t={u.tactic} onSet={(k, v) => setUnitTac(key, ui, k, v)} />
            <td className="px-2 py-1.5 text-right"><Stepper value={u.timePct} step={5} onChange={(v) => setUnitTime(key, ui, v)} /></td>
          </tr>
        ))}
      </UnitBlock>
    );
  };

  // Split a special-teams unit into a FORWARDS table and a DEFENSE table (STHS
  // style) — wider dropdowns so full names read cleanly. The first `nF` slots are
  // forwards, the next `nD` are defense. Tactic (PHY/DF/OF) + Time % live on the
  // forwards table (one game plan per unit); the defense table shows the pairing.
  const SplitUnitSection = (key: "pp" | "fourVFour" | "pk4" | "pk3", title: string, nF: number, nD: number) => {
    const units = data.situations[key];
    return (
      <div className="space-y-4">
        <UnitBlock title={`${title} — Forwards`} head={["Unit", ...Array.from({ length: nF }, (_, i) => `F${i + 1}`), "PHY", "DF", "OF", "Time %"]} timeTotal={timeSum(units)}>
          {units.map((u, ui) => (
            <tr key={ui} className="border-b border-slate-800/60">
              <td className="px-2 py-1.5 text-slate-500">{ui + 1}</td>
              {Array.from({ length: nF }).map((_, si) => (
                <td key={si} className="px-2"><Select value={u.players[si]} onChange={(v) => setUnit(key, ui, si, v)} pool={forwards} /></td>
              ))}
              <TacCells t={u.tactic} onSet={(k, v) => setUnitTac(key, ui, k, v)} />
              <td className="px-2 py-1.5 text-right"><Stepper value={u.timePct} step={5} onChange={(v) => setUnitTime(key, ui, v)} /></td>
            </tr>
          ))}
        </UnitBlock>
        <UnitBlock title={`${title} — Defense`} head={["Unit", ...Array.from({ length: nD }, (_, i) => `D${i + 1}`)]}>
          {units.map((u, ui) => (
            <tr key={ui} className="border-b border-slate-800/60">
              <td className="px-2 py-1.5 text-slate-500">{ui + 1}</td>
              {Array.from({ length: nD }).map((_, si) => (
                <td key={si} className="px-2"><Select value={u.players[nF + si]} onChange={(v) => setUnit(key, ui, nF + si, v)} pool={defense} /></td>
              ))}
            </tr>
          ))}
        </UnitBlock>
      </div>
    );
  };

  const others = data.situations.others;
  const setOther = <K extends keyof typeof others>(k: K, v: (typeof others)[K]) => change((d) => { (d.situations.others[k] as typeof v) = v; });
  const setOtherList = (k: "extraForwards" | "extraDefense" | "shootout", i: number, v: number | null) =>
    change((d) => { d.situations.others[k][i] = v; });
  const setLastMin = (k: "off" | "def", i: number, v: number | null) => change((d) => { d.situations.lastMin[k][i] = v; });

  return (
    <div className="max-w-5xl mx-auto px-4 pb-28">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <LinesNav teamName={teamName} teamSlug={teamSlug} />
        <button onClick={auto} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold" title="Fill empty slots with the best available players">Auto Lines</button>
      </div>

      {dupes.length > 0 && (
        <div className="mb-3 text-sm text-red-300 bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2">
          Same player used twice in one line/unit: {dupes.join(", ")}
        </div>
      )}
      {badTime.length > 0 && (
        <div className="mb-3 text-sm text-red-300 bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2">
          <b>Time Invalid</b> — each group must total 100%: {badTime.map(([k, s]) => `${k} ${s}%`).join(", ")}
        </div>
      )}
      {badLineTactics && (
        <div className="mb-3 text-sm text-red-300 bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2">
          <b>Line Tactics Invalid</b> — PHY + DF + OF on every line/unit must total exactly 5 (rows flagged with <span className="text-rose-400">≠5</span>).
        </div>
      )}
      {badTactics.length > 0 && (
        <div className="mb-3 text-sm text-red-300 bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2">
          <b>Tactics Points Invalid</b> — each game state must total 5 points: {badTactics.map((st) => st.label).join(", ")}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 border-b border-slate-800 pb-3 mb-5">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-[13px] font-semibold transition-colors ${tab === t ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/60"}`}>{t}</button>
        ))}
      </div>

      {tab === "Forward" && <>{ForwardSection}<p className="text-xs text-slate-500 mt-2 px-1">💡 <strong>System</strong>: give a line its own Puck Style (else it inherits the team system from <em>Team → System</em>). E.g. set your 4th line to <em>Cycle</em> while the team runs <em>Rush</em>. Tempo &amp; Forecheck stay team-wide.</p></>}
      {tab === "Defense" && <>{DefenseSection}<p className="text-xs text-slate-500 mt-2 px-1">💡 <strong>System</strong>: give a pair its own D-Zone (else it inherits the team system). E.g. a <em>Collapse</em> shut-down pair for defending a lead.</p></>}
      {tab === "PP" && <>{FormationPicker("ppStyle", "Power-play formation")}{SplitUnitSection("pp", "Power Play (5 on 4)", 3, 2)}</>}
      {tab === "4 vs 4" && SplitUnitSection("fourVFour", "4 vs 4", 2, 2)}
      {tab === "PK4" && <>{FormationPicker("pkStyle", "Penalty-kill structure")}{SplitUnitSection("pk4", "Penalty Kill (4 on 5)", 2, 2)}</>}
      {tab === "PK3" && SplitUnitSection("pk3", "Penalty Kill (3 on 5)", 1, 2)}
      {tab === "Overtime" && UnitSection("overtime", "Overtime (3 vs 3)", ["OT1", "OT2", "OT3"], () => players)}

      {tab === "Others" && (
        <div className="space-y-6">
          <UnitBlock title="Goalies" head={["Role", "Goalie"]}>
            <ORow label="Starter"><Select value={others.starter} onChange={(v) => setOther("starter", v)} pool={goaliesByName} /></ORow>
            <ORow label="Backup"><Select value={others.backup} onChange={(v) => setOther("backup", v)} pool={goaliesByName} /></ORow>
          </UnitBlock>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ListBlock title="Extra Forwards" values={others.extraForwards} pool={forwards} onSet={(i, v) => setOtherList("extraForwards", i, v)} Select={Select} />
            <ListBlock title="Extra Defense" values={others.extraDefense} pool={defense} onSet={(i, v) => setOtherList("extraDefense", i, v)} Select={Select} />
          </div>
          <UnitBlock title="Substitutes" head={["Situation", "Player"]}>
            <ORow label="Power-play sub"><Select value={others.subPP} onChange={(v) => setOther("subPP", v)} pool={players} /></ORow>
            <ORow label="Penalty-kill 1 sub"><Select value={others.subPK1} onChange={(v) => setOther("subPK1", v)} pool={players} /></ORow>
            <ORow label="Penalty-kill 2 sub"><Select value={others.subPK2} onChange={(v) => setOther("subPK2", v)} pool={players} /></ORow>
          </UnitBlock>
          <ListBlock title="Shootout order (1 → 5)" values={others.shootout} pool={players} numbered onSet={(i, v) => setOtherList("shootout", i, v)} Select={Select} />
        </div>
      )}

      {tab === "Last Min" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ListBlock title="Offensive — chase the tie (goalie pulled)" values={data.situations.lastMin.off} pool={players} numbered onSet={(i, v) => setLastMin("off", i, v)} Select={Select} />
          <ListBlock title="Defensive — protect the lead" values={data.situations.lastMin.def} pool={players} numbered onSet={(i, v) => setLastMin("def", i, v)} Select={Select} />
        </div>
      )}

      {tab === "Strategy" && (
        <div className="space-y-4">
          <UnitBlock title="Team Strategy (each row must total 5)" head={["Game state", "PHY", "DF", "OF", "Σ"]}>
            {STATES.map((st) => {
              const w = data.strategy[st.key];
              const sum = w.phy + w.df + w.of;
              return (
                <tr key={st.key} className="border-b border-slate-800/60">
                  <td className="px-3 py-2">{st.label}</td>
                  {(["phy", "df", "of"] as const).map((k) => (
                    <td key={k} className="px-2 py-2 text-center">
                      <Stepper value={w[k]} min={0} max={5} w="w-12"
                        onChange={(v) => change((d) => { d.strategy[st.key][k as keyof StratWeights] = v; })} />
                    </td>
                  ))}
                  <td className={`px-2 py-2 text-right font-bold tabular-nums ${sum === 5 ? "text-green-400" : "text-red-400"}`}>{sum}{sum !== 5 && " ✗"}</td>
                </tr>
              );
            })}
          </UnitBlock>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-900/40 border border-slate-800 rounded-lg p-4">
            <label className="text-sm flex items-center justify-between gap-3">Pull goalie down by ≥
              <Stepper value={data.strategy.goaliePull.minGoals} min={1} max={6} w="w-12" onChange={(v) => change((d) => { d.strategy.goaliePull.minGoals = v; })} /></label>
            <label className="text-sm flex items-center justify-between gap-3">Pull at (sec left)
              <Stepper value={data.strategy.goaliePull.pullSec} min={0} max={300} step={10} w="w-16" onChange={(v) => change((d) => { d.strategy.goaliePull.pullSec = v; })} /></label>
            <label className="text-sm flex items-center justify-between gap-3">Swap goalie under SV%
              <Stepper value={data.strategy.goaliePull.savePctUnder} min={0} max={100} step={5} w="w-14" onChange={(v) => change((d) => { d.strategy.goaliePull.savePctUnder = v; })} /></label>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/90 border-t border-slate-800 backdrop-blur px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button onClick={save} disabled={pending || invalid}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm disabled:opacity-50">
            {pending ? "Saving…" : "Save Lines"}
          </button>
          {invalid && <span className="text-red-400 text-sm">
            {dupes.length ? "Fix duplicate players" : badTime.length ? "Time must total 100%" : "Tactics must total 5 points"} to save
          </span>}
          {saved && <span className="text-green-400 text-sm">✓ Saved — used in the next simulation</span>}
        </div>
      </div>
    </div>
  );
}

// ---- small layout helpers ----
function UnitBlock({ title, head, children, timeTotal }: { title: string; head: string[]; children: React.ReactNode; timeTotal?: number }) {
  return (
    <section className="mb-2">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400 mb-2">{title}</h2>
      <div className="bg-slate-900/40 border border-slate-800 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead><tr className="text-xs text-slate-500 border-b border-slate-800">
            {head.map((h, i) => <th key={i} className={`px-2 py-2 ${i === 0 ? "text-left w-14" : i === head.length - 1 ? "text-right" : "text-left"}`}>{h}</th>)}
          </tr></thead>
          <tbody>{children}</tbody>
          {timeTotal != null && (
            <tfoot><tr className="border-t border-slate-700/70">
              <td colSpan={head.length - 1} className="px-2 py-1.5 text-right text-xs text-slate-500 uppercase tracking-wide">Time total</td>
              <td className={`px-2 py-1.5 text-right text-sm font-bold tabular-nums ${timeTotal === 100 ? "text-green-400" : "text-red-400"}`}>{timeTotal}%{timeTotal !== 100 && " ✗"}</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

function ORow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-slate-800/60">
      <td className="px-3 py-1.5 text-slate-300 w-40">{label}</td>
      <td className="px-2 py-1.5">{children}</td>
    </tr>
  );
}

function ListBlock({ title, values, pool, onSet, Select, numbered }: {
  title: string; values: (number | null)[]; pool: { id: number; name: string; overall: number }[];
  onSet: (i: number, v: number | null) => void; numbered?: boolean;
  Select: (p: { value: number | null; onChange: (v: number | null) => void; pool: any }) => React.ReactElement;
}) {
  return (
    <div>
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400 mb-2">{title}</h2>
      <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-3 space-y-2">
        {values.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            {numbered && <span className="w-5 text-slate-500 text-sm tabular-nums">{i + 1}</span>}
            <div className="flex-1"><Select value={v} onChange={(nv) => onSet(i, nv)} pool={pool} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
