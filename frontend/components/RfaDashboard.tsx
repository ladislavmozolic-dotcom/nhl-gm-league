"use client";

import { useState, useTransition } from "react";
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

export default function RfaDashboard({ rows }: { rows: Row[] }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); setMessage(r.ok ? "Uložené." : (r.error ?? "Akciu sa nepodarilo vykonať.")); });
  return <Card bodyClassName="p-0">
    {message && <p className="m-3 text-xs text-sky-300">{message}</p>}
    <div className="divide-y divide-slate-800/60">
      {rows.map((r) => <div key={r.id} className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <PlayerLink id={r.player.id} name={r.player.name} className="font-semibold text-sm" />
          <span className="text-xs text-slate-500">{r.player.position} · {r.player.age ?? "—"}r · {r.player.overall ?? "—"} OVR</span>
          <span className={`text-[10px] font-bold uppercase ${r.team.isAffiliate ? "text-sky-300" : "text-slate-400"}`}>{r.team.code ?? r.team.name}{r.team.isAffiliate ? " · AHL" : ""}</span>
          <span className="ml-auto rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">{label[r.status] ?? r.status}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
          <span>QO <b className="text-sky-300">{M(r.qoAmount)}</b> · deadline {new Date(r.qoDueAt).toISOString().slice(0, 10)}</span>
          <span>Current AAV {M(r.player.capHit)}</span>
          <span>Arbitráž {r.arbEligible ? <b className="text-violet-300">eligible</b> : "not eligible"}</span>
          <span>OS riziko <b className={r.offerSheetRisk === "High" ? "text-rose-300" : r.offerSheetRisk === "Medium" ? "text-amber-300" : "text-emerald-300"}>{r.offerSheetRisk}</b></span>
          {r.awardAav && <span>Verdikt <b className="text-emerald-300">{M(r.awardAav)} × {r.awardTerm}r</b></span>}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {r.status === "QO_DUE" && <button disabled={pending} onClick={() => run(() => tenderQualifyingOfferAction(r.id, r.teamId))} className="rounded bg-sky-700 px-2 py-1.5 font-semibold disabled:opacity-50">Tender QO</button>}
          {["QO_TENDERED", "NEGOTIATING", "OS_ELIGIBLE"].includes(r.status) && r.arbEligible && <>
            <button disabled={pending} onClick={() => run(() => fileArbitrationAction(r.id, r.teamId, "CLUB"))} className="rounded bg-violet-700 px-2 py-1.5 font-semibold disabled:opacity-50">Klub podá arbitráž</button>
            <button disabled={pending} onClick={() => run(() => fileArbitrationAction(r.id, r.teamId, "PLAYER"))} className="rounded bg-slate-700 px-2 py-1.5 font-semibold disabled:opacity-50">Simulovať podanie hráča</button>
          </>}
          {r.status === "AWARDED" && <button disabled={pending} onClick={() => run(() => acceptArbitrationAwardAction(r.id, r.teamId))} className="rounded bg-emerald-700 px-2 py-1.5 font-semibold disabled:opacity-50">Prijať award</button>}
          {r.status === "AWARDED" && r.awardAav != null && r.walkAwayThreshold != null && r.awardAav >= r.walkAwayThreshold && <button disabled={pending} onClick={() => run(() => walkAwayArbitrationAction(r.id, r.teamId))} className="rounded bg-rose-800 px-2 py-1.5 font-semibold disabled:opacity-50">Walk away → UFA</button>}
        </div>
        <Hearing row={r} />
      </div>)}
    </div>
  </Card>;
}
