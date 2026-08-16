import Link from "next/link";
import type { BuiltLine, TeamLineBuild } from "@/lib/line-builder-server";

const scoreTone = (n: number) => (n >= 80 ? "text-emerald-400" : n >= 60 ? "text-sky-400" : n >= 45 ? "text-amber-400" : "text-rose-400");

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-[11px] text-slate-400 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400" style={{ width: `${value}%` }} />
      </div>
      <span className="w-7 text-right text-[11px] tabular-nums text-slate-400">{value}</span>
    </div>
  );
}

function LineCard({ line }: { line: BuiltLine }) {
  const p = line.profile;
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      {/* slots */}
      <div className="grid mb-3" style={{ gridTemplateColumns: `repeat(${line.slots.length}, 1fr)` }}>
        {line.slots.map((s, i) => (
          <div key={i} className="text-center px-1">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">{s.role}</div>
            {s.name ? (
              <Link href={s.slug ? `/players/${s.slug}` : "#"} className="font-bold text-sm hover:text-blue-400 leading-tight block truncate">{s.name}{s.offSlot && <span className="text-amber-400" title="Off natural position/side"> *</span>}</Link>
            ) : <span className="text-slate-600">—</span>}
            {s.overall != null && <div className="text-[11px] text-slate-500">{s.overall} OV</div>}
          </div>
        ))}
      </div>

      {/* chemistry + fit */}
      <div className="grid grid-cols-2 gap-3 mb-2">
        <div className="text-center bg-slate-800/40 rounded-lg py-2">
          <div className={`text-2xl font-black tabular-nums ${scoreTone(line.chemistry)}`}>{line.chemistry}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Chemistry{line.gelled ? "" : " (proj)"}</div>
        </div>
        <div className="text-center bg-slate-800/40 rounded-lg py-2">
          <div className={`text-2xl font-black tabular-nums ${scoreTone(line.tacticalFit)}`}>{line.tacticalFit}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Tactical Fit</div>
        </div>
      </div>

      {/* pairwise bonds */}
      {line.pairs.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {line.pairs.map((b, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded bg-slate-800/60 px-1.5 py-0.5 text-[11px]">
              <span className="text-slate-400">{b.label}</span>
              <span className={`font-bold tabular-nums ${scoreTone(b.value)}`}>{b.value}</span>
              {!b.gelled && <span className="text-slate-600 text-[9px]">proj</span>}
            </span>
          ))}
        </div>
      )}

      {/* offensive profile */}
      <div className="space-y-1 mb-3">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Profile</div>
        <Bar label="Playmaking" value={p.playmaking} />
        <Bar label="Shooting" value={p.shooting} />
        <Bar label="Transition" value={p.transition} />
        <Bar label="Physical" value={p.physical} />
        <Bar label="Defense" value={p.defense} />
      </div>

      <p className="text-xs text-slate-300 leading-snug">{line.summary}</p>
    </div>
  );
}

export default function LineBuilderView({ build }: { build: TeamLineBuild }) {
  if (!build) return <p className="text-slate-500 text-sm">No lines to analyse — set them in the Line Editor first.</p>;
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">Reads your current lines (from the Line Editor). Chemistry, tactical fit and the offensive profile are derived from the players — experiment before you sim.</p>

      <details className="bg-slate-900/40 border border-slate-800 rounded-xl px-4 py-2 text-sm">
        <summary className="cursor-pointer text-slate-300 font-medium select-none">How Chemistry &amp; Tactical Fit work</summary>
        <div className="mt-2 space-y-2 text-slate-400 text-[13px] leading-snug">
          <p><span className="font-semibold text-slate-300">🧪 Chemistry</span> — the average of the line&apos;s pairwise bonds (LW↔C, C↔RW, LW↔RW). Each bond <span className="text-emerald-400">grows</span> as those two play together and <span className="text-sky-400">fades slowly</span> when apart, so a split duo keeps most of its history when re-united (time-together memory). A brand-new combo has no shared history yet, so it shows a <span className="text-slate-300">projected</span> (&ldquo;proj&rdquo;) value from how well it&apos;s built; it climbs as they play. Capped lower if a player is off his natural position.</p>
          <p><span className="font-semibold text-slate-300">♟️ Tactical Fit</span> — how well the line is <em>constructed</em> (no games needed): role diversity (a playmaker + sniper + grinder, or an offensive D + a shutdown D, scores high; three snipers or two identical D score low) × position &amp; handedness correctness (centre at C, wingers on their side; LD shoots left, RD shoots right). It updates the moment you change players.</p>
        </div>
      </details>
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Forward Lines</div>
        <div className="grid gap-4 md:grid-cols-2">{build.forwards.map((l) => <LineCard key={`f${l.index}`} line={l} />)}</div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Defense Pairs</div>
        <div className="grid gap-4 md:grid-cols-2">{build.defense.map((l) => <LineCard key={`d${l.index}`} line={l} />)}</div>
      </div>
    </div>
  );
}
