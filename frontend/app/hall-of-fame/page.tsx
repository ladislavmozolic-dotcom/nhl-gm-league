import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { hallOfFame, type Resume } from "@/lib/hof-server";

export const dynamic = "force-dynamic";

const AWARD_ICON: Record<string, string> = {
  Hart: "🏆", "Ted Lindsay": "⭐", "Art Ross": "🎯", "Rocket Richard": "🚀", Norris: "🛡️",
  Vezina: "🧤", Selke: "🔒", "Lady Byng": "🎩", "Conn Smythe": "👑", Calder: "🐣",
};

function ResumeLine({ r }: { r: Resume }) {
  const stat = r.isGoalie
    ? `${r.wins} W · ${r.shutouts} SO · ${r.svPct ? (r.svPct * 100).toFixed(1) + "%" : "—"}`
    : `${r.gp} GP · ${r.goals}-${r.assists}-${r.points}`;
  return (
    <span className="text-xs text-slate-500">
      {r.seasons} season{r.seasons === 1 ? "" : "s"} · {stat}
      {r.cups > 0 && <span className="text-amber-400"> · {r.cups}× 🏆</span>}
    </span>
  );
}

function Awards({ r }: { r: Resume }) {
  if (!r.awards.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {r.awards.map((a, i) => (
        <span key={i} className="inline-flex items-center gap-0.5 rounded bg-slate-800/70 px-1.5 py-0.5 text-[10px] text-slate-300" title={a.category}>
          {AWARD_ICON[a.category] ?? "🏅"}{a.category}{a.count > 1 ? `×${a.count}` : ""}
        </span>
      ))}
    </div>
  );
}

const nameEl = (r: Resume) => r.slug
  ? <Link href={`/players/${r.slug}`} className="font-semibold hover:text-blue-400">{r.name}</Link>
  : <span className="font-semibold">{r.name}</span>;

export default async function HallOfFamePage() {
  const { inducted, watch, threshold } = await hallOfFame();
  return (
    <div className="space-y-8 py-2">
      <PageHeader title="Hall of Fame" subtitle="Inducted on a career résumé — production, hardware, cups, longevity. The Hall fills in as legends retire." />

      {/* Inducted */}
      <section>
        <div className="text-xs uppercase tracking-wide text-amber-400 mb-3">Inducted Members</div>
        {inducted.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-8 text-center">
            <p className="text-slate-400">The Hall is waiting for its first class.</p>
            <p className="text-sm text-slate-600 mt-1">Players are inducted when they retire with a résumé score of {threshold}+. Today&apos;s stars are building their cases on the Watch below.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {inducted.map((r) => (
              <div key={r.playerId} className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-950/30 to-slate-900/40 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-lg">{nameEl(r)} <span className="text-slate-500 text-sm">{r.position}</span></div>
                  <span className="text-2xl font-black text-amber-400 tabular-nums">{r.score}</span>
                </div>
                <div className="mt-0.5"><ResumeLine r={r} /></div>
                <Awards r={r} />
                {r.hofSeason && <div className="mt-2 text-[10px] uppercase tracking-wide text-amber-500/70">Class of {r.hofSeason}</div>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Watch */}
      <section>
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-3">🔭 Hall of Fame Watch — active players by résumé</div>
        <div className="rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800/60">
          {watch.map((r, i) => {
            const pct = Math.min(100, Math.round((r.score / threshold) * 100));
            return (
              <div key={r.playerId} className="flex items-center gap-3 px-4 py-2.5 bg-slate-900/40">
                <span className="w-6 text-slate-600 text-sm tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">{nameEl(r)} <span className="text-slate-500 text-xs">{r.teamCode}</span></div>
                  <ResumeLine r={r} />
                  <Awards r={r} />
                </div>
                <div className="w-28 shrink-0">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5"><span className="tabular-nums font-bold text-slate-300">{r.score}</span><span>{pct}%</span></div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-gradient-to-r from-sky-500 to-amber-400" style={{ width: `${pct}%` }} /></div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-600 mt-2">Induction bar: {threshold} résumé points. Score = career points (or goalie 2·W + 6·SO) + award weights + 40 per cup + 5 per season + peak-season bonus.</p>
      </section>
    </div>
  );
}
