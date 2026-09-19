"use client";

import { useMemo, useState, useTransition } from "react";

export type ProtPlayer = {
  id: number; name: string; position: string; posGroup: "F" | "D" | "G";
  isGoalie: boolean; overall: number | null; capHit: number | null;
  forced: boolean; exempt: boolean;
};

type Format = "7-3-1" | "8-1";
const SLOTS: Record<Format, { f: number; d: number; g: number; skaters: number }> = {
  "7-3-1": { f: 7, d: 3, g: 1, skaters: 10 },
  "8-1": { f: 0, d: 0, g: 1, skaters: 8 },
};

export default function ExpansionProtectionForm({
  teamId, slug, expansionDraftId, players, initialFormat, initialChosenIds, submittedAt, action,
}: {
  teamId: number; slug: string; expansionDraftId: number; players: ProtPlayer[];
  initialFormat: Format; initialChosenIds: number[]; submittedAt: string | null;
  action: (input: { teamId: number; slug: string; expansionDraftId: number; format: Format; playerIds: number[] }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [format, setFormat] = useState<Format>(initialFormat);
  const [chosen, setChosen] = useState<Set<number>>(new Set(initialChosenIds));
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(!!submittedAt);

  const forced = useMemo(() => players.filter((p) => p.forced), [players]);
  const eligible = useMemo(() => players.filter((p) => !p.exempt && !p.forced), [players]);

  const toggle = (id: number) => {
    setSaved(false);
    setChosen((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const protectedAll = useMemo(() => [...forced, ...eligible.filter((p) => chosen.has(p.id))], [forced, eligible, chosen]);
  const fCount = protectedAll.filter((p) => p.posGroup === "F").length;
  const dCount = protectedAll.filter((p) => p.posGroup === "D").length;
  const gCount = protectedAll.filter((p) => p.posGroup === "G").length;
  const skaterCount = fCount + dCount;
  const slots = SLOTS[format];
  const complete = format === "7-3-1" ? (fCount === slots.f && dCount === slots.d && gCount === slots.g) : (skaterCount === slots.skaters && gCount === slots.g);

  const submit = () => {
    setErr(null);
    start(async () => {
      const res = await action({ teamId, slug, expansionDraftId, format, playerIds: [...chosen] });
      if (!res.ok) setErr(res.error || "Submission failed.");
      else setSaved(true);
    });
  };

  const Row = ({ p, disabled, checked, dimmed, note }: { p: ProtPlayer; disabled: boolean; checked: boolean; dimmed?: boolean; note?: string }) => (
    <label className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${dimmed ? "border-slate-800/50 opacity-50" : checked ? "border-blue-600 bg-blue-950/30" : "border-slate-800 hover:border-slate-700"} ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={() => !disabled && toggle(p.id)} className="accent-blue-500" />
      <span className="w-8 text-center text-[10px] font-bold text-slate-500">{p.posGroup}</span>
      <span className="flex-1 truncate text-slate-100">{p.name}</span>
      {p.overall != null && <span className="text-xs text-slate-500 tabular-nums">{p.overall} OV</span>}
      {note && <span className="text-[10px] uppercase tracking-wide text-amber-400">{note}</span>}
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {(["7-3-1", "8-1"] as Format[]).map((f) => (
          <button key={f} type="button" onClick={() => { setFormat(f); setSaved(false); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${format === f ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}>
            {f === "7-3-1" ? "7 F + 3 D + 1 G" : "8 skaters (any mix) + 1 G"}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 text-xs">
        {format === "7-3-1" ? (
          <>
            <span className={fCount === slots.f ? "text-emerald-400" : "text-slate-400"}>F {fCount}/{slots.f}</span>
            <span className={dCount === slots.d ? "text-emerald-400" : "text-slate-400"}>D {dCount}/{slots.d}</span>
          </>
        ) : (
          <span className={skaterCount === slots.skaters ? "text-emerald-400" : "text-slate-400"}>Skaters {skaterCount}/{slots.skaters}</span>
        )}
        <span className={gCount === slots.g ? "text-emerald-400" : "text-slate-400"}>G {gCount}/{slots.g}</span>
      </div>

      {forced.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-wider text-amber-400">Force-protected (active NMC)</div>
          {forced.map((p) => <Row key={p.id} p={p} disabled checked note="NMC" />)}
        </div>
      )}

      <div className="space-y-1.5">
        <div className="text-[11px] uppercase tracking-wider text-slate-500">Your roster</div>
        {eligible.map((p) => <Row key={p.id} p={p} disabled={false} checked={chosen.has(p.id)} />)}
      </div>

      {players.some((p) => p.exempt) && (
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-wider text-slate-600">Exempt — entry-level/two-way (not protectable, not takeable)</div>
          {players.filter((p) => p.exempt).map((p) => <Row key={p.id} p={p} disabled checked={false} dimmed />)}
        </div>
      )}

      {err && <p className="text-sm text-red-400">{err}</p>}

      <div className="flex items-center gap-3">
        <button type="button" onClick={submit} disabled={pending || !complete}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold">
          {pending ? "Ukladám…" : "Odoslať protection list"}
        </button>
        {!complete && <span className="text-xs text-slate-500">Vyber presne {format === "7-3-1" ? `${slots.f} F, ${slots.d} D, ${slots.g} G` : `${slots.skaters} skaters, ${slots.g} G`} (vrátane force-protected).</span>}
        {saved && complete && !err && <span className="text-emerald-400 text-sm">✓ Odoslané</span>}
      </div>
    </div>
  );
}
