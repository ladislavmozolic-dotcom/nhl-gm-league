"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export type ClauseTeam = { id: number; code: string | null; name: string; slug: string; logoUrl: string | null };

export const INFO: Record<string, { label: string; title: string; text: string; cls: string }> = {
  NTC: { label: "NTC", title: "No-Trade Clause", text: "Player must approve any trade, and can submit a list of teams he'd accept.", cls: "text-sky-300 border-sky-500/40 bg-sky-500/10" },
  NMC: { label: "NMC", title: "No-Movement Clause", text: "Player cannot be traded, waived or sent to the farm without his consent.", cls: "text-rose-300 border-rose-500/40 bg-rose-500/10" },
  M_NTC: { label: "M-NTC", title: "Modified No-Trade Clause", text: "Player cannot be traded to the clubs listed below without his consent.", cls: "text-amber-300 border-amber-500/40 bg-amber-500/10" },
};

/** Modal: clause explanation, protected-team count and club logos. */
export function ClauseModal({ clause, pending, effectiveFrom, teams, playerName, onClose }: {
  clause: string; pending?: boolean; effectiveFrom?: string; teams: ClauseTeam[]; playerName: string; onClose: () => void;
}) {
  const info = INFO[clause] ?? { label: clause, title: clause, text: "", cls: "" };
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 text-left whitespace-normal" onClick={() => onClose()}>
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-800/80 to-slate-900 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{playerName}</div>
            <div className="text-lg font-black text-white">{info.title}</div>
          </div>
          <button type="button" onClick={() => onClose()} className="text-slate-500 hover:text-white text-xl leading-none" aria-label="Close">×</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-slate-300">{info.text}</p>
          {pending && (
            <p className="text-xs rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 px-3 py-2">
              Signed with his extension — takes effect from <b>{effectiveFrom}</b>.
            </p>
          )}
          {clause === "M_NTC" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Protected against</span>
                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300">{teams.length} {teams.length === 1 ? "team" : "teams"}</span>
              </div>
              {teams.length ? (
                <div className="grid grid-cols-3 gap-2">
                  {teams.map((t) => (
                    <Link key={t.id} href={`/teams/${t.slug}`} title={t.name}
                      className="flex flex-col items-center gap-1 rounded-lg border border-slate-800 bg-slate-800/40 hover:bg-slate-800 hover:border-slate-600 py-2 transition">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {t.logoUrl ? <img src={t.logoUrl} alt={t.code ?? t.name} className="h-9 w-9 object-contain" /> : <div className="h-9 w-9 rounded-full bg-slate-700" />}
                      <span className="text-[11px] font-bold text-slate-300">{t.code ?? ""}</span>
                    </Link>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-500">No teams specified.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Clickable clause pill → ClauseModal. */
export default function ClauseBadge({ clause, pending, effectiveFrom, teams, playerName }: {
  clause: string; pending?: boolean; effectiveFrom?: string; teams: ClauseTeam[]; playerName: string;
}) {
  const [open, setOpen] = useState(false);
  const info = INFO[clause] ?? { label: clause, title: clause, text: "", cls: "text-slate-300 border-slate-600 bg-slate-800" };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[11px] font-bold hover:brightness-125 transition ${pending ? "text-amber-300/80 border-amber-500/30 bg-amber-500/5" : info.cls}`}>
        {info.label}{pending ? "*" : ""}
      </button>
      {open && <ClauseModal clause={clause} pending={pending} effectiveFrom={effectiveFrom} teams={teams} playerName={playerName} onClose={() => setOpen(false)} />}
    </>
  );
}
