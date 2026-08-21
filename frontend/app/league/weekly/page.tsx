import PlayerLink from "@/components/PlayerLink";
import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import { weeklyDigest } from "@/lib/weekly-digest";
import { tradeGrades, dynastyLeaderboard } from "@/lib/gm-awards";

export const dynamic = "force-dynamic";

type Tab = "stars" | "team" | "player" | "goalie" | "surprise" | "trade" | "gm" | "grades" | "dynasty";
const TABS: { key: Tab; label: string; allTime?: boolean }[] = [
  { key: "stars", label: "⭐ 3 Stars" }, { key: "team", label: "🏆 Team" }, { key: "player", label: "🌟 Player" },
  { key: "goalie", label: "🧤 Goalie" }, { key: "surprise", label: "😮 Surprise" }, { key: "trade", label: "🔁 Trade" },
  { key: "gm", label: "🧑‍💼 GM" }, { key: "grades", label: "📋 Trade Grades", allTime: true }, { key: "dynasty", label: "🏰 Dynasty", allTime: true },
];
const gradeColor = (g: string) => g.startsWith("A") ? "text-emerald-400" : g.startsWith("B") ? "text-sky-400" : g === "C" ? "text-amber-400" : "text-red-400";

function TeamLine({ name, slug, logo }: { name: string; slug: string | null; logo: string | null }) {
  const inner = <span className="inline-flex items-center gap-2">{logo && <img src={logo} alt="" className="w-7 h-7 object-contain" />}<span className="font-bold text-lg">{name}</span></span>;
  return slug ? <Link href={`/teams/${slug}`} className="hover:text-blue-400 transition-colors">{inner}</Link> : inner;
}
const svp = (v: number) => v.toFixed(3).replace(/^0/, "");

export default async function WeeklyPage({ searchParams }: { searchParams: Promise<{ tab?: string; period?: string }> }) {
  const sp = await searchParams;
  const period = sp.period === "month" ? "month" : "week";
  const tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "stars") as Tab;
  const d = await weeklyDigest(undefined, period === "month" ? 28 : 7);
  const grades = tab === "grades" ? await tradeGrades(10) : [];
  const dynasty = tab === "dynasty" ? await dynastyLeaderboard() : [];
  const P = period === "month" ? "Month" : "Week";
  const q = (t: Tab) => `/league/weekly?period=${period}&tab=${t}`;
  const qp = (p: string) => `/league/weekly?period=${p}&tab=${tab}`;

  const header = (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["week", "month"] as const).map((p) => (
          <Link key={p} href={qp(p)} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${period === p ? "bg-blue-600 text-white" : "border border-slate-700 text-slate-400 hover:bg-slate-800"}`}>{p === "week" ? "Weekly" : "Monthly"}</Link>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <Link key={t.key} href={q(t.key)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === t.key ? "bg-slate-700 text-white" : "border border-slate-800 text-slate-400 hover:bg-slate-800"}`}>{t.label}</Link>
        ))}
      </div>
    </div>
  );

  // all-time tabs render regardless of this period's games
  if (tab === "grades") {
    return (
      <div className="space-y-4 py-2">
        <PageHeader title="League Report" subtitle="Trade grades — most recent completed deals." />{header}
        <Card title="📋 Trade Grades" bodyClassName="p-0">
          <div className="divide-y divide-slate-800/60">
            {grades.length === 0 && <div className="px-4 py-4 text-slate-600 text-sm">No completed trades yet.</div>}
            {grades.map((g) => (
              <div key={g.id} className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold">{g.fromName} <span className={`ml-1 font-black ${gradeColor(g.fromGrade)}`}>{g.fromGrade}</span></span>
                  <span className="text-slate-600 text-xs">↔</span>
                  <span className="font-semibold text-right">{g.toName} <span className={`ml-1 font-black ${gradeColor(g.toGrade)}`}>{g.toGrade}</span></span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-500">
                  <div>gives: {g.fromGives.join(", ") || "—"}</div>
                  <div className="text-right">gives: {g.toGives.join(", ") || "—"}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }
  if (tab === "dynasty") {
    return (
      <div className="space-y-4 py-2">
        <PageHeader title="League Report" subtitle="Dynasty leaderboard — all-time GM success." />{header}
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[620px]">
              <thead><tr className="border-b border-slate-800 bg-slate-800/30 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-3 py-2.5 text-left">#</th><th className="px-3 py-2.5 text-left">Club · GM</th>
                <th className="px-3 py-2.5 text-center" title="Cups">🏆</th><th className="px-3 py-2.5 text-center" title="Finals">🥈</th>
                <th className="px-3 py-2.5 text-center" title="Playoff appearances">PO</th><th className="px-3 py-2.5 text-center">Wins</th><th className="px-3 py-2.5 text-center">Score</th>
              </tr></thead>
              <tbody>
                {dynasty.map((r, i) => (
                  <tr key={r.teamId} className="border-b border-slate-800/40 hover:bg-slate-800/30 last:border-0">
                    <td className="px-3 py-2 text-slate-500 tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2">
                      {r.slug ? <Link href={`/teams/${r.slug}`} className="inline-flex items-center gap-2 hover:text-blue-400">{r.logo && <img src={r.logo} alt="" className="w-5 h-5 object-contain" />}<span className="font-medium">{r.code}</span></Link> : <span>{r.code}</span>}
                      <span className="text-slate-500 text-xs ml-2">{r.gm}{r.ai ? " 🤖" : ""}</span>
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums font-bold text-amber-400">{r.cups || ""}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-slate-300">{r.finals || ""}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-slate-400">{r.playoffs || ""}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-slate-300">{r.wins}</td>
                    <td className="px-3 py-2 text-center tabular-nums font-bold text-white">{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  if (!d || d.games === 0) {
    return <div className="space-y-4 py-2"><PageHeader title={`${P}ly Report`} subtitle="The story from around the league." />{header}<Card><p className="text-sm text-slate-400">No games in this {period} yet — the report fills in as it&apos;s played.</p></Card></div>;
  }

  const section = (() => {
    if (tab === "stars") return (
      <Card title={`⭐ 3 Stars of the ${P}`} accent="text-amber-400" bodyClassName="p-0">
        <div className="divide-y divide-slate-800/60">
          {d.stars.length === 0 && <div className="px-4 py-4 text-slate-600 text-sm">no data</div>}
          {d.stars.map((s) => (
            <div key={s.rank} className="flex items-center gap-3 px-4 py-3">
              <span className="text-lg" title={`Star ${s.rank}`}>{"★".repeat(s.rank)}</span>
              {s.teamLogo && <img src={s.teamLogo} alt="" className="w-6 h-6 object-contain" />}
              <span className="flex-1 min-w-0 truncate"><PlayerLink id={s.id} name={s.name} slug={s.slug ?? undefined} clean={false} /> <span className="text-slate-500 text-xs">{s.team}{s.isGoalie ? " · G" : ""}</span></span>
              <span className="text-sm text-slate-300 tabular-nums whitespace-nowrap">{s.line}</span>
            </div>
          ))}
        </div>
      </Card>
    );
    if (tab === "team") return (
      <Card title={`🏆 Team of the ${P}`} accent="text-amber-400">
        {d.teamOfWeek ? (<><TeamLine name={d.teamOfWeek.name} slug={d.teamOfWeek.slug} logo={d.teamOfWeek.logo} /><p className="text-sm text-slate-300 mt-2 tabular-nums">{d.teamOfWeek.w}-{d.teamOfWeek.l}-{d.teamOfWeek.otl} · {d.teamOfWeek.points} pts · {d.teamOfWeek.gf}-{d.teamOfWeek.ga} goals</p></>) : <p className="text-slate-500 text-sm">—</p>}
      </Card>
    );
    if (tab === "player") return (
      <Card title={`🌟 Player of the ${P}`} accent="text-sky-400">
        {d.topScorer ? (<><span className="inline-flex items-center gap-2 text-lg font-bold"><PlayerLink id={d.topScorer.id} name={d.topScorer.name} slug={d.topScorer.slug ?? undefined} clean={false} />{d.topScorer.teamLogo && <img src={d.topScorer.teamLogo} alt="" className="w-5 h-5 object-contain" />}<span className="text-slate-500 text-sm font-normal">{d.topScorer.team}</span></span><p className="text-sm text-slate-300 mt-2 tabular-nums">{d.topScorer.pts} pts ({d.topScorer.g}G {d.topScorer.a}A) in {d.topScorer.gp} GP</p></>) : <p className="text-slate-500 text-sm">—</p>}
      </Card>
    );
    if (tab === "goalie") return (
      <Card title={`🧤 Goalie of the ${P}`} accent="text-emerald-400">
        {d.bestGoalie ? (<><span className="inline-flex items-center gap-2 text-lg font-bold"><PlayerLink id={d.bestGoalie.id} name={d.bestGoalie.name} slug={d.bestGoalie.slug ?? undefined} clean={false} />{d.bestGoalie.teamLogo && <img src={d.bestGoalie.teamLogo} alt="" className="w-5 h-5 object-contain" />}<span className="text-slate-500 text-sm font-normal">{d.bestGoalie.team}</span></span><p className="text-sm text-slate-300 mt-2 tabular-nums">{svp(d.bestGoalie.svPct)} SV% · {d.bestGoalie.record} · {d.bestGoalie.gp} GP</p></>) : <p className="text-slate-500 text-sm">No qualifying goalie this {period}.</p>}
      </Card>
    );
    if (tab === "surprise") return (
      <Card title={`😮 Surprise of the ${P}`} accent="text-fuchsia-400">
        {d.surprise ? (<><TeamLine name={d.surprise.name} slug={d.surprise.slug} logo={d.surprise.logo} /><p className="text-sm text-slate-300 mt-2 tabular-nums">{d.surprise.w}-{d.surprise.l}-{d.surprise.otl} — despite sitting {d.surprise.overallRank}th overall.</p></>) : <p className="text-slate-500 text-sm">No standout underdog this {period}.</p>}
      </Card>
    );
    if (tab === "gm") return (
      <Card title={`🧑‍💼 GM of the ${P}`} accent="text-indigo-400" bodyClassName="p-0">
        <div className="divide-y divide-slate-800/60">
          {d.gmOfPeriod.length === 0 && <div className="px-4 py-4 text-slate-600 text-sm">no data</div>}
          {d.gmOfPeriod.map((g) => (
            <div key={g.rank} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="w-5 text-right text-slate-500 tabular-nums">{g.rank}</span>
              {g.logo && <img src={g.logo} alt="" className="w-6 h-6 object-contain" />}
              <span className="flex-1 min-w-0 truncate"><span className="font-semibold">{g.gm}{g.ai ? " 🤖" : ""}</span> {g.slug ? <Link href={`/teams/${g.slug}`} className="text-slate-500 text-xs hover:text-blue-400">{g.team}</Link> : <span className="text-slate-500 text-xs">{g.team}</span>}</span>
              <span className="text-slate-300 tabular-nums whitespace-nowrap">{g.w}-{g.l}-{g.otl} · {g.points} pts</span>
            </div>
          ))}
        </div>
      </Card>
    );
    return (
      <Card title={`🔁 Trade of the ${P}`} accent="text-blue-400">
        {d.tradeOfWeek ? <p className="text-sm text-slate-200">{d.tradeOfWeek}</p> : <p className="text-slate-500 text-sm">No completed trades recently.</p>}
      </Card>
    );
  })();

  return (
    <div className="space-y-4 py-2">
      <PageHeader title={`${P}ly Report${period === "week" ? ` — Week ${d.weekNo}` : ""}`} subtitle={`${d.games} games · rounds ${d.roundFrom + 1}–${d.roundTo + 1}`} />
      {header}
      {section}
    </div>
  );
}
