"use client";

import { useState, useTransition } from "react";
import { runCalibrationAction } from "@/app/admin/calibration/actions";
import type { CalReport, CalMetric } from "@/lib/sim/calibration";

const DOT: Record<string, string> = { ok: "bg-emerald-500", warn: "bg-amber-500", fail: "bg-red-500" };
const TEXT: Record<string, string> = { ok: "text-emerald-400", warn: "text-amber-400", fail: "text-red-400" };

function Row({ m }: { m: CalMetric }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2 border-t border-slate-800 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[m.status]}`} />
        <span className="truncate">{m.label}{m.hint && <span className="text-slate-600 hidden md:inline"> · {m.hint}</span>}</span>
      </div>
      <span className={`tabular-nums font-bold ${TEXT[m.status]}`}>{m.value}</span>
      <span className="tabular-nums text-slate-500 text-xs w-24 text-right">{m.target}</span>
    </div>
  );
}

export default function CalibrationLab() {
  const [report, setReport] = useState<CalReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () => start(async () => {
    setErr(null);
    const res = await runCalibrationAction();
    if (res.ok) setReport(res.report); else setErr(res.error);
  });

  const groups = report ? [...new Set(report.metrics.map((m) => m.group))] : [];
  const fails = report?.metrics.filter((m) => m.status === "fail").length ?? 0;
  const warns = report?.metrics.filter((m) => m.status === "warn").length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <button onClick={run} disabled={pending}
          className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold transition-colors">
          {pending ? "Simulating a season…" : report ? "Re-run calibration" : "Run calibration"}
        </button>
        {report && (
          <div className="text-sm text-slate-400">
            {report.games} games · {report.teams} teams · {(report.ms / 1000).toFixed(1)}s ·{" "}
            <span className={fails ? "text-red-400 font-semibold" : "text-emerald-400 font-semibold"}>
              {fails === 0 ? "all green" : `${fails} fail`}
            </span>
            {warns > 0 && <span className="text-amber-400"> · {warns} warn</span>}
          </div>
        )}
      </div>

      {pending && !report && <p className="text-slate-500 text-sm">Running a full double round-robin (~1000 games) in memory — a few seconds…</p>}
      {err && <p className="text-red-400 text-sm">{err}</p>}

      {report && groups.map((g) => (
        <div key={g} className="bg-slate-900/40 rounded-lg border border-slate-800 overflow-hidden">
          <div className="px-4 py-2 bg-slate-800/60 text-xs font-bold uppercase tracking-wide text-slate-400 flex items-center justify-between">
            <span>{g}</span>
            <span className="text-slate-600 normal-case">value · target</span>
          </div>
          {report.metrics.filter((m) => m.group === g).map((m) => <Row key={m.label} m={m} />)}
        </div>
      ))}

      {!report && !pending && (
        <p className="text-slate-500 text-sm max-w-2xl">
          Runs an in-memory double round-robin (every club home & away) and grades the engine: core rates
          (goals, shots, save %, home ice, OT), competitive balance (does quality win? upset &amp; blowout rates,
          top scorer), shot quality (xG vs goals, high-danger %, GSAx), EDGE tracking (zone time, hits) and injuries.
          No games are saved — it never touches the season.
        </p>
      )}
    </div>
  );
}
