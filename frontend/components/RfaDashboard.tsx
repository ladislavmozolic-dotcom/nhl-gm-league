"use client";

import { useMemo, useState, useTransition } from "react";
import PlayerLink from "@/components/PlayerLink";
import { Card } from "@/components/ui";
import { acceptArbitrationAwardAction, decideArbitrationAction, fileArbitrationAction, tenderQualifyingOfferAction, walkAwayArbitrationAction } from "@/app/rfa/actions";

type Row = {
  id: number; teamId: number; status: string; qoAmount: number; qoDueAt: string; qoTenderedAt: string | null; arbEligible: boolean;
  awardAav: number | null; awardTerm: number | null; walkAwayThreshold: number | null;
  offerSheetRisk: "Low" | "Medium" | "High";
  comparables: { id: number; name: string; capHit: number | null; overall: number | null; age: number | null }[];
  player: { id: number; name: string; position: string; age: number | null; capHit: number | null; overall: number | null };
  team: { code: string | null; name: string; isAffiliate: boolean };
};
const M = (n: number | null) => n == null ? "—" : `$${(n / 1e6).toFixed(2)}M`;
const label: Record<string, string> = { QO_DUE: "QO due", QO_TENDERED: "QO tendered", NEGOTIATING: "Negotiating", ARB_FILED: "Hearing open", AWARDED: "Awarded", OS_ELIGIBLE: "Offer-sheet eligible", WALKED_AWAY: "Walked away", UFA: "UFA", SIGNED: "Signed" };

function Hearing({ row }: { row: Row }) {
  const [pending, start] = useTransition();
  const [club, setClub] = useState(""); const [player, setPlayer] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const decide = () => start(async () => {
    const r = await decideArbitrationAction(row.id, row.teamId, Number(club) * 1e6, 1, Number(player) * 1e6, 1);
    setMsg(r.ok ? `Verdikt: ${M(r.award)} × ${r.term} rok (pásmo ${M(r.low)}–${M(r.high)}).` : r.error);
  });
  if (row.status !== "ARB_FILED") return null;
  return <div className="mt-2 text-xs">
    <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-slate-400">Porovnateľní hráči: {row.comparables.map((p) => <span key={p.id}>{p.name} <b className="text-slate-200">{M(p.capHit)}</b> · {p.overall ?? "—"} OVR</span>)}</div>
    <div className="flex flex-wrap items-center gap-2">
    <input value={club} onChange={(e) => setClub(e.target.value)} placeholder="Klub AAV $M" inputMode="decimal" className="w-28 rounded border border-slate-700 bg-slate-950 px-2 py-1.5" />
    <input value={player} onChange={(e) => setPlayer(e.target.value)} placeholder="Hráč AAV $M" inputMode="decimal" className="w-28 rounded border border-slate-700 bg-slate-950 px-2 py-1.5" />
    <button onClick={decide} disabled={pending} className="rounded bg-violet-600 px-2 py-1.5 font-semibold disabled:opacity-50">Rozhodnúť hearing</button>
    {msg && <span className={msg.startsWith("Verdikt") ? "text-emerald-300" : "text-rose-300"}>{msg}</span>}
    </div>
  </div>;
}

function Risk({ level }: { level: Row["offerSheetRisk"] }) {
  return <span className={`font-semibold ${level === "High" ? "text-rose-300" : level === "Medium" ? "text-amber-300" : "text-emerald-300"}`}>{level}</span>;
}

function RfaRow({ r, pending, run }: { r: Row; pending: boolean; run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void }) {
  return <div className="px-4 py-3 sm:px-5">
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
      <div className="min-w-0 flex-1">
        <PlayerLink id={r.player.id} name={r.player.name} className="font-semibold text-sm" />
        <span className="ml-2 text-xs text-slate-500">{r.player.position} · {r.player.age ?? "—"}r · {r.player.overall ?? "—"} OVR</span>
      </div>
      <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-300">{label[r.status] ?? r.status}</span>
    </div>
    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
      <span className="text-slate-500">QO <b className="ml-1 text-sky-300">{M(r.qoAmount)}</b></span>
      <span className="text-slate-500">Deadline <b className="ml-1 text-slate-300">{new Date(r.qoDueAt).toISOString().slice(0, 10)}</b></span>
      <span className="text-slate-500">Arbitráž <b className={r.arbEligible ? "ml-1 text-violet-300" : "ml-1 text-slate-400"}>{r.arbEligible ? "eligible" : "nie"}</b></span>
      <span className="text-slate-500">OS riziko <span className="ml-1"><Risk level={r.offerSheetRisk} /></span></span>
    </div>
    {r.awardAav && <div className="mt-2 text-xs text-emerald-300">Arbitrážny verdikt: <b>{M(r.awardAav)} × {r.awardTerm}r</b></div>}
    <div className="mt-3 flex flex-wrap gap-2 text-xs">
      {r.status === "QO_DUE" && <button disabled={pending} onClick={() => run(() => tenderQualifyingOfferAction(r.id, r.teamId))} className="rounded-lg bg-sky-700 px-2.5 py-1.5 font-semibold text-white hover:bg-sky-600 disabled:opacity-50">Tender QO</button>}
      {["QO_TENDERED", "NEGOTIATING", "OS_ELIGIBLE"].includes(r.status) && r.arbEligible && <>
        <button disabled={pending} onClick={() => run(() => fileArbitrationAction(r.id, r.teamId, "CLUB"))} className="rounded-lg bg-violet-700 px-2.5 py-1.5 font-semibold text-white hover:bg-violet-600 disabled:opacity-50">Klub podá arbitráž</button>
        <button disabled={pending} onClick={() => run(() => fileArbitrationAction(r.id, r.teamId, "PLAYER"))} className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-50">Podanie hráča</button>
      </>}
      {r.status === "AWARDED" && <button disabled={pending} onClick={() => run(() => acceptArbitrationAwardAction(r.id, r.teamId))} className="rounded-lg bg-emerald-700 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">Prijať award</button>}
      {r.status === "AWARDED" && r.awardAav != null && r.walkAwayThreshold != null && r.awardAav >= r.walkAwayThreshold && <button disabled={pending} onClick={() => run(() => walkAwayArbitrationAction(r.id, r.teamId))} className="rounded-lg bg-rose-800 px-2.5 py-1.5 font-semibold text-white hover:bg-rose-700 disabled:opacity-50">Walk away → UFA</button>}
    </div>
    <Hearing row={r} />
  </div>;
}

function TeamGroup({ team, rows, leagueView, pending, run }: { team: Row["team"]; rows: Row[]; leagueView: boolean; pending: boolean; run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void }) {
  const urgent = rows.filter((r) => r.status === "QO_DUE").length;
  const [open, setOpen] = useState(!leagueView);
  return <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 shadow-sm">
    <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/50 sm:px-5">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-black ${team.isAffiliate ? "bg-sky-500/15 text-sky-300" : "bg-blue-500/15 text-blue-300"}`}>{team.code ?? "TM"}</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-100">{team.name}</span><span className="text-[11px] text-slate-500">{team.isAffiliate ? "AHL affiliate" : "NHL club"}</span></span>
      {urgent > 0 && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300">{urgent} QO due</span>}
      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300">{rows.length}</span>
      <span className="text-slate-500">{open ? "⌃" : "⌄"}</span>
    </button>
    {open && <div className="divide-y divide-slate-800/70 border-t border-slate-800/80">{rows.map((r) => <RfaRow key={r.id} r={r} pending={pending} run={run} />)}</div>}
  </section>;
}

export default function RfaDashboard({ rows, leagueView = false }: { rows: Row[]; leagueView?: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); setMessage(r.ok ? "Uložené." : (r.error ?? "Akciu sa nepodarilo vykonať.")); });
  const filtered = useMemo(() => rows.filter((r) => `${r.player.name} ${r.team.name} ${r.team.code ?? ""}`.toLowerCase().includes(query.toLowerCase())), [rows, query]);
  const groups = useMemo(() => {
    const map = new Map<number, { team: Row["team"]; rows: Row[] }>();
    for (const r of filtered) { const g = map.get(r.teamId) ?? { team: r.team, rows: [] }; g.rows.push(r); map.set(r.teamId, g); }
    return [...map.values()].sort((a, b) => a.team.name.localeCompare(b.team.name));
  }, [filtered]);
  const qDue = rows.filter((r) => r.status === "QO_DUE").length;
  const hearings = rows.filter((r) => r.status === "ARB_FILED" || r.status === "AWARDED").length;
  return <div className="space-y-4">
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">RFA cases</div><div className="mt-1 text-xl font-black text-slate-100">{rows.length}</div></div>
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-sky-300">QO due</div><div className="mt-1 text-xl font-black text-sky-200">{qDue}</div></div>
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-violet-300">Hearings</div><div className="mt-1 text-xl font-black text-violet-200">{hearings}</div></div>
    </div>
    <Card bodyClassName="p-3"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={leagueView ? "Hľadať hráča alebo tím…" : "Hľadať vo svojej organizácii…"} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none placeholder:text-slate-600 focus:border-sky-500" />{message && <p className="mt-2 text-xs text-sky-300">{message}</p>}</Card>
    <div className="space-y-3">{groups.map((g) => <TeamGroup key={g.team.name} {...g} leagueView={leagueView} pending={pending} run={run} />)}{groups.length === 0 && <Card><p className="text-sm text-slate-500">Žiadny RFA nezodpovedá vyhľadávaniu.</p></Card>}</div>
  </div>;
}
