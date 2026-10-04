"use client";

import { useMemo, useState, useTransition } from "react";
import PlayerLink from "@/components/PlayerLink";
import { Card } from "@/components/ui";
import { acceptArbitrationAwardAction, decideArbitrationAction, fileArbitrationAction, tenderQualifyingOfferAction, walkAwayArbitrationAction } from "@/app/rfa/actions";

type Row = {
  id: number; teamId: number; status: string; qoAmount: number; qoDueAt: string; qoTenderedAt: string | null; arbEligible: boolean;
  awardAav: number | null; awardTerm: number | null; awardContractType: string | null; qoContractType: string | null;
  qoForm: { oneWayRequired: boolean; gp3: number; gpLast: number; waived: boolean }; walkAwayThreshold: number | null;
  offerSheetRisk: "Low" | "Medium" | "High";
  comparables: { id: number; name: string; capHit: number | null; overall: number | null; age: number | null }[];
  player: { id: number; name: string; position: string; age: number | null; capHit: number | null; overall: number | null };
  team: { code: string | null; name: string; isAffiliate: boolean };
  org: { id: number; code: string | null; name: string };
  range: { low: number; high: number } | null;
};
const M = (n: number | null) => n == null ? "—" : `$${(n / 1e6).toFixed(2)}M`;
const label: Record<string, string> = { QO_DUE: "QO due", QO_TENDERED: "QO tendered", NEGOTIATING: "Negotiating", ARB_FILED: "Hearing open", AWARDED: "Awarded", OS_ELIGIBLE: "Offer-sheet eligible", WALKED_AWAY: "Walked away", UFA: "UFA", SIGNED: "Signed" };

function Hearing({ row }: { row: Row }) {
  const [pending, start] = useTransition();
  // Prefill with sensible submissions: the club argues for the bottom of the band,
  // the player for the top — the award lands in the middle (clamped to the band).
  const lo = row.range?.low ?? row.qoAmount;
  const hi = row.range?.high ?? row.qoAmount;
  const [club, setClub] = useState((lo / 1e6).toFixed(2)); const [player, setPlayer] = useState((hi / 1e6).toFixed(2));
  const [type, setType] = useState<"ONE_WAY" | "TWO_WAY">(row.qoContractType === "TWO_WAY" ? "TWO_WAY" : "ONE_WAY");
  const [clubTerm, setClubTerm] = useState(1); const [playerTerm, setPlayerTerm] = useState(2);
  const [msg, setMsg] = useState<string | null>(null);
  const decide = () => start(async () => {
    const r = await decideArbitrationAction(row.id, row.teamId, Number(club) * 1e6, clubTerm, Number(player) * 1e6, playerTerm, type);
    setMsg(r.ok ? `Verdikt: ${M(r.award)} × ${r.term} rok, ${r.contractType === "TWO_WAY" ? "two-way" : "one-way"} (pásmo ${M(r.low)}–${M(r.high)}).` : r.error);
  });
  if (row.status !== "ARB_FILED") return null;
  const input = "w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100";
  const select = "rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100";
  return <div className="mt-3 space-y-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="font-bold uppercase tracking-wide text-violet-300">Arbitration hearing <span className="ml-1 rounded bg-slate-950/60 px-1.5 py-0.5 text-slate-300">{type === "TWO_WAY" ? "two-way" : "one-way"} · 1–2 roky</span></span>
      {row.range && <span className="rounded-full bg-slate-950/60 px-2.5 py-1 text-slate-300">Povolené pásmo: <b className="text-emerald-300">{M(row.range.low)} – {M(row.range.high)}</b></span>}
    </div>
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Porovnateľní hráči</div>
      <div className="grid gap-1 sm:grid-cols-2">{row.comparables.map((p) => <div key={p.id} className="flex items-center justify-between rounded-lg bg-slate-950/50 px-2.5 py-1.5"><span className="truncate text-slate-300">{p.name}</span><span className="ml-2 shrink-0 text-slate-500"><b className="text-slate-200">{M(p.capHit)}</b> · {p.overall ?? "—"} OVR</span></div>)}</div>
    </div>
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-lg bg-slate-950/50 p-2.5"><div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-sky-300">Návrh klubu</div>
        <div className="flex items-center gap-2"><input value={club} onChange={(e) => setClub(e.target.value)} inputMode="decimal" className={input} /><span className="text-slate-500">$M ×</span><select value={clubTerm} onChange={(e) => setClubTerm(Number(e.target.value))} className={select}><option value={1}>1 rok</option><option value={2}>2 roky</option></select></div></div>
      <div className="rounded-lg bg-slate-950/50 p-2.5"><div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">Návrh hráča</div>
        <div className="flex items-center gap-2"><input value={player} onChange={(e) => setPlayer(e.target.value)} inputMode="decimal" className={input} /><span className="text-slate-500">$M ×</span><select value={playerTerm} onChange={(e) => setPlayerTerm(Number(e.target.value))} className={select}><option value={1}>1 rok</option><option value={2}>2 roky</option></select></div></div>
    </div>
    <div className="rounded-lg bg-slate-950/50 p-2.5">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Forma zmluvy v awarde{row.qoContractType ? ` (QO bola ${row.qoContractType === "TWO_WAY" ? "two-way" : "one-way"})` : ""}</div>
      <div className="flex flex-wrap gap-2">{([["ONE_WAY", "One-way", "NHL plat celý rok, nemožno poslať na farmu"], ["TWO_WAY", "Two-way", "plný plat berie aj v AHL — do Salary Capu sa nepočíta, ide do Finance; hráč ho nemusí prijať"]] as const).map(([k, t, d]) => <button key={k} type="button" onClick={() => setType(k)} className={`rounded-lg border px-3 py-1.5 text-left transition-colors ${type === k ? "border-violet-500 bg-violet-500/20 text-violet-100" : "border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200"}`}><b>{t}</b><span className="block text-[10px] opacity-70">{d}</span></button>)}</div>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={decide} disabled={pending} className="rounded-lg bg-violet-600 px-3 py-1.5 font-semibold text-white hover:bg-violet-500 disabled:opacity-50">Rozhodnúť hearing</button>
      {msg && <span className={msg.startsWith("Verdikt") ? "text-emerald-300" : "text-rose-300"}>{msg}</span>}
    </div>
  </div>;
}

function Risk({ level }: { level: Row["offerSheetRisk"] }) {
  return <span className={`font-semibold ${level === "High" ? "text-rose-300" : level === "Medium" ? "text-amber-300" : "text-emerald-300"}`}>{level}</span>;
}

const accent: Record<string, string> = { QO_DUE: "border-l-sky-500", QO_TENDERED: "border-l-emerald-500", NEGOTIATING: "border-l-amber-500", ARB_FILED: "border-l-violet-500", AWARDED: "border-l-violet-500", OS_ELIGIBLE: "border-l-rose-500" };
const chip: Record<string, string> = { QO_DUE: "bg-sky-500/15 text-sky-300 border-sky-500/30", QO_TENDERED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", NEGOTIATING: "bg-amber-500/15 text-amber-300 border-amber-500/30", ARB_FILED: "bg-violet-500/15 text-violet-300 border-violet-500/30", AWARDED: "bg-violet-500/15 text-violet-300 border-violet-500/30", OS_ELIGIBLE: "bg-rose-500/15 text-rose-300 border-rose-500/30" };

function RfaRow({ r, pending, run }: { r: Row; pending: boolean; run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void }) {
  return <div className={`border-l-4 px-4 py-3 sm:px-5 ${accent[r.status] ?? "border-l-slate-700"}`}>
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
      <div className="min-w-0 flex-1">
        <PlayerLink id={r.player.id} name={r.player.name} className="font-semibold text-sm" />
        <span className="ml-2 text-xs text-slate-500">{r.player.position} · {r.player.age ?? "—"}r · {r.player.overall ?? "—"} OVR</span>
        {r.team.isAffiliate && <span className="ml-2 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-300">AHL · {r.team.code}</span>}
      </div>
      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${chip[r.status] ?? "border-slate-700 bg-slate-800 text-slate-300"}`}>{label[r.status] ?? r.status}</span>
    </div>
    <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
      <div className="rounded-lg bg-slate-950/50 px-2.5 py-1.5"><div className="text-[10px] uppercase tracking-wide text-slate-500">QO · 1 rok</div><b className="text-sky-300">{M(r.qoAmount)}</b>{r.qoContractType && <span className="ml-1.5 text-[10px] font-bold uppercase text-slate-400">{r.qoContractType === "TWO_WAY" ? "two-way" : "one-way"}</span>}</div>
      <div className="rounded-lg bg-slate-950/50 px-2.5 py-1.5"><div className="text-[10px] uppercase tracking-wide text-slate-500">Deadline</div><b className="text-slate-200">{new Date(r.qoDueAt).toISOString().slice(0, 10)}</b></div>
      <div className="rounded-lg bg-slate-950/50 px-2.5 py-1.5"><div className="text-[10px] uppercase tracking-wide text-slate-500">Arbitráž</div><b className={r.arbEligible ? "text-violet-300" : "text-slate-400"}>{r.arbEligible ? "eligible" : "nie"}</b></div>
      <div className="rounded-lg bg-slate-950/50 px-2.5 py-1.5"><div className="text-[10px] uppercase tracking-wide text-slate-500">OS riziko</div><Risk level={r.offerSheetRisk} /></div>
    </div>
    {r.status === "QO_DUE" && <p className={`mt-2 text-[11px] ${r.qoForm.oneWayRequired ? "text-amber-300" : "text-slate-500"}`}>{r.qoForm.oneWayRequired ? "⚠ CBA: povinná one-way QO — " : "Two-way QO je možná — "}{r.qoForm.gp3} GP za 3 sezóny (limit 180) · {r.qoForm.gpLast} GP minulú sezónu (limit 60) · {r.qoForm.waived ? "bol na waiveroch" : "bez waiverov"}</p>}
    {r.awardAav && <div className="mt-2 text-xs text-emerald-300">Arbitrážny verdikt: <b>{M(r.awardAav)} × {r.awardTerm}r · {r.awardContractType === "TWO_WAY" ? "two-way" : "one-way"}</b></div>}
    <div className="mt-3 flex flex-wrap gap-2 text-xs">
      {r.status === "QO_DUE" && <>
        <button disabled={pending} onClick={() => run(() => tenderQualifyingOfferAction(r.id, r.teamId, "ONE_WAY"))} className="rounded-lg bg-sky-700 px-2.5 py-1.5 font-semibold text-white hover:bg-sky-600 disabled:opacity-50">Tender QO · 1r one-way</button>
        <button disabled={pending || r.qoForm.oneWayRequired} title={r.qoForm.oneWayRequired ? "CBA: povinná one-way QO" : "Two-way QO"} onClick={() => run(() => tenderQualifyingOfferAction(r.id, r.teamId, "TWO_WAY"))} className="rounded-lg border border-sky-600 bg-sky-900/40 px-2.5 py-1.5 font-semibold text-sky-200 hover:bg-sky-800/60 disabled:cursor-not-allowed disabled:opacity-40">Tender QO · 1r two-way</button>
      </>}
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

type Org = Row["org"];
function TeamGroup({ org, rows, leagueView, pending, run }: { org: Org; rows: Row[]; leagueView: boolean; pending: boolean; run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void }) {
  const urgent = rows.filter((r) => r.status === "QO_DUE").length;
  const farm = rows.filter((r) => r.team.isAffiliate).length;
  const [open, setOpen] = useState(!leagueView);
  // NHL players first, then the farm ones — both under the same NHL club
  const sorted = [...rows].sort((a, b) => Number(a.team.isAffiliate) - Number(b.team.isAffiliate));
  return <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 shadow-sm">
    <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 bg-gradient-to-r from-slate-900 to-slate-900/30 px-4 py-3 text-left hover:from-slate-800/80 sm:px-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 text-xs font-black text-blue-300 ring-1 ring-blue-500/30">{org.code ?? "TM"}</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-100">{org.name}</span><span className="text-[11px] text-slate-500">{rows.length - farm} NHL{farm > 0 ? ` · ${farm} farm` : ""}</span></span>
      {urgent > 0 && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300">{urgent} QO due</span>}
      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300">{rows.length}</span>
      <span className="text-slate-500">{open ? "⌃" : "⌄"}</span>
    </button>
    {open && <div className="divide-y divide-slate-800/70 border-t border-slate-800/80">{sorted.map((r) => <RfaRow key={r.id} r={r} pending={pending} run={run} />)}</div>}
  </section>;
}

const FILTERS: { key: string; text: string; match: (s: string) => boolean }[] = [
  { key: "all", text: "All", match: () => true },
  { key: "due", text: "QO due", match: (s) => s === "QO_DUE" },
  { key: "tendered", text: "Tendered / negotiating", match: (s) => s === "QO_TENDERED" || s === "NEGOTIATING" },
  { key: "arb", text: "Arbitration", match: (s) => s === "ARB_FILED" || s === "AWARDED" },
  { key: "os", text: "Offer-sheet eligible", match: (s) => s === "OS_ELIGIBLE" },
];

export default function RfaDashboard({ rows, leagueView = false }: { rows: Row[]; leagueView?: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); setMessage(r.ok ? "Uložené." : (r.error ?? "Akciu sa nepodarilo vykonať.")); });
  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0];
    return rows.filter((r) => f.match(r.status) && `${r.player.name} ${r.org.name} ${r.org.code ?? ""} ${r.team.name}`.toLowerCase().includes(query.toLowerCase()));
  }, [rows, query, filter]);
  const groups = useMemo(() => {
    const map = new Map<number, { org: Org; rows: Row[] }>();
    for (const r of filtered) { const g = map.get(r.org.id) ?? { org: r.org, rows: [] }; g.rows.push(r); map.set(r.org.id, g); }
    return [...map.values()].sort((a, b) => a.org.name.localeCompare(b.org.name));
  }, [filtered]);
  const count = (key: string) => rows.filter((r) => (FILTERS.find((x) => x.key === key) ?? FILTERS[0]).match(r.status)).length;
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">RFA cases</div><div className="mt-1 text-xl font-black text-slate-100">{rows.length}</div></div>
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-sky-300">QO due</div><div className="mt-1 text-xl font-black text-sky-200">{count("due")}</div></div>
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-violet-300">Hearings</div><div className="mt-1 text-xl font-black text-violet-200">{count("arb")}</div></div>
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-rose-300">Offer-sheet eligible</div><div className="mt-1 text-xl font-black text-rose-200">{count("os")}</div></div>
    </div>
    <p className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-xs leading-relaxed text-slate-400">A normal <b>Re-sign</b> remains available throughout the final contract year. Tendering the QO preserves RFA rights; missing it releases the player to UFA. Arbitration is optional, and an award can only be walked away from when it meets the league threshold. Farm (AHL) players are listed under their NHL club.</p>
    <Card bodyClassName="p-3">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={leagueView ? "Hľadať hráča alebo tím…" : "Hľadať vo svojej organizácii…"} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none placeholder:text-slate-600 focus:border-sky-500" />
      <div className="mt-2 flex flex-wrap gap-1.5">{FILTERS.map((f) => <button key={f.key} onClick={() => setFilter(f.key)} className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${filter === f.key ? "border-sky-500 bg-sky-500/20 text-sky-200" : "border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200"}`}>{f.text} <span className="opacity-60">{count(f.key)}</span></button>)}</div>
      {message && <p className="mt-2 text-xs text-sky-300">{message}</p>}
    </Card>
    <div className="space-y-3">{groups.map((g) => <TeamGroup key={g.org.id} {...g} leagueView={leagueView} pending={pending} run={run} />)}{groups.length === 0 && <Card><p className="text-sm text-slate-500">Žiadny RFA nezodpovedá vyhľadávaniu.</p></Card>}</div>
  </div>;
}

