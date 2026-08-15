import type { GameReport, ReportBit } from "@/lib/game-report-server";

function Bit({ title, icon, bit }: { title: string; icon: string; bit: ReportBit }) {
  if (!bit) return null;
  return (
    <div className="rounded-lg bg-slate-900/50 border border-slate-800 p-3">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-xs font-bold uppercase tracking-wide text-amber-400">{icon} {title}</span>
        <span className="text-[11px] text-slate-500 tabular-nums">{bit.time} · {bit.period <= 3 ? `${bit.period}${["st", "nd", "rd"][bit.period - 1]}` : "OT"}</span>
      </div>
      <p className="text-sm text-slate-300 leading-snug">{bit.text}</p>
    </div>
  );
}

export default function GameReportCard({ report }: { report: GameReport }) {
  return (
    <div className="bg-gradient-to-br from-slate-900/70 to-slate-900/40 border border-slate-800 rounded-xl p-5">
      <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Game Report</div>
      <p className="text-[15px] text-slate-100 leading-relaxed">{report.summary}</p>
      {(report.turningPoint || report.playOfGame || report.saveOfGame) && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          <Bit title="Turning Point" icon="🔀" bit={report.turningPoint} />
          <Bit title="Play of the Game" icon="🎯" bit={report.playOfGame} />
          <Bit title="Save of the Game" icon="🧤" bit={report.saveOfGame} />
        </div>
      )}
    </div>
  );
}
