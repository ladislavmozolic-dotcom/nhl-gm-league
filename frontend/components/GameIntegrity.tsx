// Simulation Integrity footer — every FINAL game carries the engine version + RNG
// seed that produced it, who ran it, and a warning if it was ever re-simulated.
export default function GameIntegrity({ engineVersion, seed, simCount, lastSimBy, lastSimAt }: {
  engineVersion: string | null; seed: number | null; simCount: number; lastSimBy: string | null; lastSimAt: string | null;
}) {
  const when = lastSimAt ? new Date(lastSimAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
  const resimmed = simCount > 1;
  return (
    <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">🔒 Simulation Integrity</span>
        {resimmed && <span className="text-[11px] font-bold uppercase tracking-wide text-amber-400">⚠ Re-simulated ×{simCount}</span>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div><div className="text-[11px] uppercase tracking-wide text-slate-500">Engine</div><div className="font-mono text-slate-200">{engineVersion ?? "—"}</div></div>
        <div><div className="text-[11px] uppercase tracking-wide text-slate-500">Seed</div><div className="font-mono text-slate-200 tabular-nums">{seed ?? "—"}</div></div>
        <div><div className="text-[11px] uppercase tracking-wide text-slate-500">Simulated by</div><div className="text-slate-200 truncate">{lastSimBy ?? "—"}</div></div>
        <div><div className="text-[11px] uppercase tracking-wide text-slate-500">When</div><div className="text-slate-200">{when ?? "—"}</div></div>
      </div>
      {resimmed && <p className="mt-2 text-[11px] text-amber-400/80">This game was simulated more than once. The result shown is the most recent run — see the League Audit Log for the full history.</p>}
      <p className="mt-2 text-[11px] text-slate-600">Same engine + seed + rosters always reproduces this exact game. Results are logged and can&apos;t be silently re-rolled.</p>
    </div>
  );
}
