import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cleanName } from "@/lib/playerName";
import { Card } from "@/components/ui";
import { posGroup, ratingColor, ovColor } from "@/lib/ratingBands";
import { playerType } from "@/lib/player-type";

export const dynamic = "force-dynamic";

const SEASON = "2026-27";

// Accept either a numeric id or a slug (links across the app use the slug).
async function getPlayer(idOrSlug: string) {
  const where = /^\d+$/.test(idOrSlug) ? { id: parseInt(idOrSlug, 10) } : { slug: idOrSlug };
  const player = await prisma.player.findFirst({
    where,
    include: { team: true, goalieRating: true },
  });
  if (!player) notFound();
  return player;
}

const SKATER_ATTRS: { key: string; label: string }[] = [
  { key: "ck", label: "CK" }, { key: "fg", label: "FG" }, { key: "di", label: "DI" },
  { key: "sk", label: "SK" }, { key: "st", label: "ST" }, { key: "en", label: "EN" },
  { key: "du", label: "DU" }, { key: "ph", label: "PH" }, { key: "fo", label: "FO" },
  { key: "pa", label: "PA" }, { key: "sc", label: "SC" }, { key: "df", label: "DF" },
  { key: "ps", label: "PS" }, { key: "ex", label: "EX" }, { key: "ld", label: "LD" },
  { key: "mo", label: "MO" },
];
const GOALIE_ATTRS: { key: string; label: string }[] = [
  { key: "sk", label: "SK" }, { key: "du", label: "DU" }, { key: "en", label: "EN" },
  { key: "sz", label: "SZ" }, { key: "ag", label: "AG" }, { key: "rb", label: "RB" },
  { key: "sc", label: "SC" }, { key: "hs", label: "HS" }, { key: "rt", label: "RT" },
  { key: "ph", label: "PH" }, { key: "ps", label: "PS" }, { key: "ex", label: "EX" },
  { key: "ld", label: "LD" }, { key: "mo", label: "MO" },
];

function attrColor(val: number | null | undefined): string {
  if (val == null) return "text-slate-600";
  if (val >= 90) return "text-green-400 font-bold";
  if (val >= 80) return "text-blue-400";
  if (val >= 70) return "text-yellow-400";
  if (val < 50) return "text-red-400";
  return "text-slate-300";
}

// Common nationality codes → flag emoji. Unmapped/null → empty string.
const NAT_FLAGS: Record<string, string> = {
  CAN: "🇨🇦", USA: "🇺🇸", SWE: "🇸🇪", FIN: "🇫🇮", RUS: "🇷🇺", CZE: "🇨🇿",
  SVK: "🇸🇰", SUI: "🇨🇭", CHE: "🇨🇭", GER: "🇩🇪", DEU: "🇩🇪", DEN: "🇩🇰",
  DNK: "🇩🇰", NOR: "🇳🇴", LAT: "🇱🇻", LVA: "🇱🇻", AUT: "🇦🇹", FRA: "🇫🇷",
  SLO: "🇸🇮", SVN: "🇸🇮", BLR: "🇧🇾", UKR: "🇺🇦", GBR: "🇬🇧", AUS: "🇦🇺",
  KAZ: "🇰🇿", ITA: "🇮🇹", NED: "🇳🇱", NLD: "🇳🇱", POL: "🇵🇱", JPN: "🇯🇵",
  CRO: "🇭🇷", HRV: "🇭🇷", EST: "🇪🇪", LTU: "🇱🇹",
};
function natFlag(nat: string | null | undefined): string {
  if (!nat) return "";
  return NAT_FLAGS[nat.toUpperCase().trim()] ?? "";
}

const mmss = (secs: number) => `${Math.floor(secs / 60)}:${Math.floor(secs % 60).toString().padStart(2, "0")}`;

function formatDOB(birthDate: string | null | undefined): string {
  if (!birthDate) return "—";
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return birthDate;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

// aggregate skater per-game rows into a single stat line
function aggSkater(rows: {
  goals: number; assists: number; points: number; shots: number; pim: number;
  plusMinus: number; ppGoals: number; shGoals: number; gwg: number;
  hits: number; blocks: number; faceoffWins: number; faceoffLosses: number; toi: number;
}[]) {
  const gp = rows.length;
  const sum = (k: keyof (typeof rows)[number]) => rows.reduce((s, r) => s + (r[k] as number), 0);
  const goals = sum("goals"), shots = sum("shots"), fw = sum("faceoffWins"), fl = sum("faceoffLosses"), toi = sum("toi"), points = sum("points");
  return {
    gp,
    g: goals, a: sum("assists"), pts: points, pm: sum("plusMinus"), pim: sum("pim"),
    ppg: sum("ppGoals"), shg: sum("shGoals"), gwg: sum("gwg"),
    s: shots, sPct: shots ? (goals / shots) * 100 : null,
    hits: sum("hits"), bks: sum("blocks"),
    foPct: fw + fl ? (fw / (fw + fl)) * 100 : null,
    toi: gp ? mmss(toi / gp) : "—",
    pPg: gp ? points / gp : 0,
  };
}

// aggregate goalie per-game rows into a single stat line
function aggGoalie(rows: {
  started: boolean; shotsAgainst: number; saves: number; goalsAgainst: number; decision: string | null;
}[]) {
  const started = rows.filter((r) => r.started);
  const gp = started.length || rows.length;
  const sa = rows.reduce((s, r) => s + r.shotsAgainst, 0);
  const sv = rows.reduce((s, r) => s + r.saves, 0);
  const ga = rows.reduce((s, r) => s + r.goalsAgainst, 0);
  return {
    gp,
    w: rows.filter((r) => r.decision === "W").length,
    l: rows.filter((r) => r.decision === "L").length,
    otl: rows.filter((r) => r.decision === "OTL").length,
    svPct: sa ? sv / sa : null,
    gaa: gp ? ga / gp : 0,
    so: rows.filter((r) => r.started && r.goalsAgainst === 0).length,
    sa, sv, ga,
    toi: `${gp * 60}:00`,
  };
}

type SkAgg = ReturnType<typeof aggSkater>;
type GlAgg = ReturnType<typeof aggGoalie>;
const cellCls = "px-3 py-2.5 text-right tabular-nums whitespace-nowrap";
const headRowCls = "bg-slate-800/30 border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider";
const secHdr = "px-4 py-2 bg-slate-800/60 text-xs font-bold uppercase tracking-wide text-slate-300";
const pmFmt = (v: number) => (v > 0 ? `+${v}` : String(v));
const pctFmt = (v: number | null, d = 1) => (v == null ? "—" : v.toFixed(d));
const svpFmt = (v: number | null) => (v == null ? "—" : v.toFixed(3).replace(/^0/, ""));

const SK_COLS = ["GP", "G", "A", "PTS", "+/-", "PIM", "PPG", "SHG", "GWG", "S", "S%", "HITS", "BKS", "FO%", "TOI", "P/PG"];
const skCells = (a: SkAgg) => [a.gp, a.g, a.a, a.pts, pmFmt(a.pm), a.pim, a.ppg, a.shg, a.gwg, a.s, pctFmt(a.sPct), a.hits, a.bks, a.foPct == null ? "—" : a.foPct.toFixed(1), a.toi, a.pPg.toFixed(2)];
const GL_COLS = ["GP", "W", "L", "OTL", "SV%", "GAA", "SO", "SA", "SV", "GA", "TOI"];
const glCells = (a: GlAgg) => [a.gp, a.w, a.l, a.otl, svpFmt(a.svPct), a.gaa.toFixed(2), a.so, a.sa, a.sv, a.ga, a.toi];

// A league block: "<LEAGUE> Seasons" (season row + career) and, if any, "<LEAGUE> Playoffs".
function StatBlock({ league, cols, reg, po, cellsOf, team }: {
  league: string; cols: string[]; reg: any; po: any; cellsOf: (a: any) => (string | number)[]; team: React.ReactNode;
}) {
  if (!reg && !po) return null;
  const Head = () => (
    <thead><tr className={headRowCls}>
      <th className="px-3 py-2.5 text-left font-medium">Season</th>
      <th className="px-3 py-2.5 text-left font-medium">Team</th>
      {cols.map((h) => <th key={h} className="px-3 py-2.5 text-right font-medium whitespace-nowrap">{h}</th>)}
    </tr></thead>
  );
  const Row = ({ label, a, bold, accent, teamNode }: { label: string; a: any; bold?: boolean; accent?: boolean; teamNode: React.ReactNode }) => (
    <tr className={`border-b border-slate-800/40 last:border-0 ${bold ? "bg-slate-800/40 font-semibold" : accent ? "text-amber-300/90" : ""}`}>
      <td className="px-3 py-2.5 text-left font-medium">{label}</td>
      <td className="px-3 py-2.5 text-left">{teamNode}</td>
      {cellsOf(a).map((c, i) => <td key={i} className={cellCls}>{c}</td>)}
    </tr>
  );
  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-4 py-2 bg-blue-950/40 border-b border-blue-500/30 text-xs font-bold uppercase tracking-wide text-blue-300">{league} Seasons</div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><Head /><tbody>
        {reg && <Row label={SEASON} a={reg} teamNode={team} />}
        {reg && <Row label="CAREER" a={reg} bold teamNode={<span className="text-slate-500">—</span>} />}
      </tbody></table></div>
      {po && (
        <>
          <div className="px-4 py-2 bg-amber-950/30 border-y border-amber-500/30 text-xs font-bold uppercase tracking-wide text-amber-300">{league} Playoffs</div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><Head /><tbody>
            <Row label={SEASON} a={po} teamNode={team} />
            <Row label="CAREER" a={po} bold teamNode={<span className="text-slate-500">—</span>} />
          </tbody></table></div>
        </>
      )}
    </div>
  );
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = (await getPlayer(id)) as any;
  const isGoalie: boolean = p.isGoalie || p.position === "G";
  const ratings = isGoalie ? { ...(p.goalieRating ?? {}) } : p;
  const attrs = isGoalie ? GOALIE_ATTRS : SKATER_ATTRS;
  const overall: number | null = isGoalie ? (p.goalieRating?.overall ?? p.overall) : p.overall;
  const grp = posGroup(p.position, isGoalie);
  const ptype = playerType(isGoalie
    ? { isGoalie: true, position: p.position, ag: p.goalieRating?.ag, rb: p.goalieRating?.rb, sz: p.goalieRating?.sz }
    : { position: p.position, sc: p.sc, pa: p.pa, df: p.df, ck: p.ck, st: p.st });

  // Aggregate the simulated 2026-27 season, split by league (NHL / AHL) and regular / playoffs.
  // If a player suited up in both leagues, both blocks show; NHL-only players hide the AHL block.
  const bucketKey = (league: string | null, seriesId: number | null) =>
    `${league === "AHL" ? "ahl" : "nhl"}${seriesId != null ? "Po" : "Reg"}`;
  const skB: Record<string, any[]> = { nhlReg: [], nhlPo: [], ahlReg: [], ahlPo: [] };
  const gB: Record<string, any[]> = { nhlReg: [], nhlPo: [], ahlReg: [], ahlPo: [] };

  if (isGoalie) {
    const rows = await prisma.goalieGameStat.findMany({
      where: { playerId: p.id, game: { season: SEASON, status: "FINAL" } },
      select: { started: true, shotsAgainst: true, saves: true, goalsAgainst: true, decision: true, game: { select: { league: true, seriesId: true } } },
    });
    for (const r of rows) gB[bucketKey(r.game.league, r.game.seriesId)].push(r);
  } else {
    const rows = await prisma.playerGameStat.findMany({
      where: { playerId: p.id, game: { season: SEASON, status: "FINAL" } },
      select: {
        goals: true, assists: true, points: true, shots: true, pim: true, plusMinus: true,
        ppGoals: true, shGoals: true, gwg: true, hits: true, blocks: true, faceoffWins: true, faceoffLosses: true, toi: true,
        game: { select: { league: true, seriesId: true } },
      },
    });
    for (const r of rows) skB[bucketKey(r.game.league, r.game.seriesId)].push(r);
  }

  const sk = {
    nhlReg: skB.nhlReg.length ? aggSkater(skB.nhlReg) : null, nhlPo: skB.nhlPo.length ? aggSkater(skB.nhlPo) : null,
    ahlReg: skB.ahlReg.length ? aggSkater(skB.ahlReg) : null, ahlPo: skB.ahlPo.length ? aggSkater(skB.ahlPo) : null,
  };
  const gl = {
    nhlReg: gB.nhlReg.length ? aggGoalie(gB.nhlReg) : null, nhlPo: gB.nhlPo.length ? aggGoalie(gB.nhlPo) : null,
    ahlReg: gB.ahlReg.length ? aggGoalie(gB.ahlReg) : null, ahlPo: gB.ahlPo.length ? aggGoalie(gB.ahlPo) : null,
  };
  const hasNhl = isGoalie ? !!(gl.nhlReg || gl.nhlPo) : !!(sk.nhlReg || sk.nhlPo);
  const hasAhl = isGoalie ? !!(gl.ahlReg || gl.ahlPo) : !!(sk.ahlReg || sk.ahlPo);

  const team = p.team as any;
  const teamCode: string = team?.code ?? team?.name ?? "—";
  const backHref = team ? `/teams/${team.slug}` : "/free-agents";

  // Bio field values
  const flag = natFlag(p.nationality);
  const status = p.injuryDaysLeft > 0 ? "Injured" : (p.rosterType ?? "—");
  const contractType = p.contractType === "TWO_WAY" ? "Two-Way" : p.contractType === "ONE_WAY" ? "One-Way" : "—";
  const capHit = p.capHit != null ? `$${(p.capHit / 1_000_000).toFixed(2)}M` : "—";

  const leftInfo: [string, React.ReactNode][] = [
    ["Position", p.position ?? "—"],
    ["Date of Birth", formatDOB(p.birthDate)],
    ["Age", p.age != null ? String(p.age) : "—"],
    ["Height", p.height || "—"],
    ["Weight", p.weight != null ? `${p.weight} kg` : "—"],
    ["Condition", `${Math.round(p.condition ?? 100)}%`],
    ...(!isGoalie ? [["Morale", `${Math.round(p.morale ?? 75)}%`] as [string, React.ReactNode]] : []),
    ["Status", status],
    [isGoalie ? "Catches" : "Shoots", p.shoots ?? "—"],
  ];
  const rightInfo: [string, React.ReactNode][] = [
    ["Contract Length", p.contractYears != null ? `${p.contractYears} yr${p.contractYears === 1 ? "" : "s"}` : "—"],
    ["Type", contractType],
    ["Cap Hit", capHit],
    ["Last Year Salary", p.capHit != null ? capHit : "—"],
    ["Overall", overall != null ? String(overall) : "—"],
  ];

  const InfoRow = ({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) => (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-xs uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`text-sm font-semibold text-right ${valueClass ?? "text-slate-100"}`}>{value}</span>
    </div>
  );

  const th = "px-3 py-2.5 font-medium whitespace-nowrap";
  const headRow = "bg-slate-800/30 border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider";
  const cell = "px-3 py-2.5 text-right tabular-nums whitespace-nowrap";

  const TeamCell = () =>
    team ? (
      <span className="inline-flex items-center gap-1.5">
        {team.logoUrl && <img src={team.logoUrl} alt={teamCode} className="w-4 h-4 object-contain" />}
        <span className="font-medium">{teamCode}</span>
      </span>
    ) : (
      <span className="text-slate-600">—</span>
    );

  const pm = (v: number) => (v > 0 ? `+${v}` : String(v));
  const pct = (v: number | null, d = 1) => (v == null ? "—" : v.toFixed(d));
  const svp = (v: number | null) => (v == null ? "—" : v.toFixed(3).replace(/^0/, ""));

  return (
    <div className="space-y-6 py-2">
      <Link href={backHref} className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        {team ? team.name : "Free Agents"}
      </Link>

      {/* ── PLAYER BIO ─────────────────────────────────────────────── */}
      <Card title="Player Bio" bodyClassName="p-0">
        <div className="relative overflow-hidden bg-gradient-to-r from-[#0a1628] via-[#1e3a5f] to-[#0a1628]">
          {/* player action shot (NHL CDN) as the background; hidden gracefully if none */}
          {p.nhlId && (
            <img src={`https://assets.nhle.com/mugs/actionshots/1296x729/${p.nhlId}.jpg`} alt=""
              className="pointer-events-none absolute inset-0 w-full h-full object-cover object-[center_top] opacity-30" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0a1628] via-[#0a1628]/80 to-transparent" />
          {/* faint team logo, right */}
          {team?.logoUrl && (
            <img src={team.logoUrl} alt="" className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 w-56 h-56 object-contain opacity-[0.07]" />
          )}
          <div className="relative p-5 md:p-6">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              {/* photo */}
              <div className="w-28 h-28 shrink-0 rounded-2xl overflow-hidden bg-slate-800/80 ring-1 ring-white/10 shadow-lg shadow-black/40">
                {p.photoUrl ? (
                  <img src={p.photoUrl} alt={cleanName(p.name)} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl font-black text-slate-600">{p.name?.[0] ?? "?"}</div>
                )}
              </div>

              <div className="flex-1 min-w-0 w-full">
                {/* name row */}
                <div className="flex items-center gap-2.5 flex-wrap mb-1">
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">{cleanName(p.name)}</h1>
                  <span className="text-2xl md:text-3xl font-black text-slate-500">| #{p.number ?? "—"}</span>
                  {flag && <span className="text-2xl leading-none" title={p.nationality}>{flag}</span>}
                  {ptype && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30" title="Player type — derived from ratings">{ptype}</span>}
                  <a href={`https://www.eliteprospects.com/search/player?q=${encodeURIComponent(cleanName(p.name))}`} target="_blank" rel="noopener noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600/40 transition-colors">
                    EliteProspects <span aria-hidden>↗</span>
                  </a>
                </div>
                {/* team line */}
                <div className="mb-4">
                  {team ? (
                    <Link href={`/teams/${team.slug}`} className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-blue-300 transition-colors">
                      {team.logoUrl && <img src={team.logoUrl} alt="" className="w-5 h-5 object-contain" />}
                      <span className="font-semibold">{team.name}</span>
                    </Link>
                  ) : (
                    <span className="text-sm text-slate-400">Free Agent</span>
                  )}
                </div>

                {/* 2-column info grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
                  <div>
                    {leftInfo.map(([label, value]) => (
                      <InfoRow key={label} label={label} value={value} valueClass={label === "Status" && status === "Injured" ? "text-red-400" : undefined} />
                    ))}
                  </div>
                  <div>
                    {rightInfo.map(([label, value]) => (
                      <InfoRow key={label} label={label} value={value} valueClass={label === "Overall" ? "text-yellow-400" : undefined} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

        {/* action-shot hero ends here */}
        </div>

        {/* ── ATTRIBUTES — solid strip below the hero so the background never hides them ── */}
        <div className="border-t border-slate-800 bg-slate-900">
          <div className="overflow-x-auto">
            <div className="flex min-w-max">
              {attrs.map((a) => {
                const val = ratings[a.key] as number | null | undefined;
                return (
                  <div key={a.key} className="flex-1 min-w-[52px] text-center px-2 py-2.5 border-r border-slate-800">
                    <div className="text-[10px] font-bold text-slate-500 tracking-wide">{a.label}</div>
                    <div className={`text-lg font-semibold tabular-nums leading-tight ${ratingColor(grp, a.key, val)}`}>{val ?? "—"}</div>
                  </div>
                );
              })}
              <div className="min-w-[64px] text-center px-2 py-2.5 bg-slate-800/60 border-l border-slate-700">
                <div className="text-[10px] font-bold text-slate-400 tracking-wide">OV</div>
                <div className={`text-lg font-black tabular-nums leading-tight ${ovColor(grp, overall)}`}>{overall ?? "—"}</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── PLAYER STATS ─────────────────────────────────────────── */}
      <Card title="Player Stats" bodyClassName="p-4">
        {hasNhl || hasAhl ? (
          <div className="space-y-6">
            {hasNhl && <StatBlock league="NHL" cols={isGoalie ? GL_COLS : SK_COLS} reg={isGoalie ? gl.nhlReg : sk.nhlReg} po={isGoalie ? gl.nhlPo : sk.nhlPo} cellsOf={isGoalie ? glCells : skCells} team={<TeamCell />} />}
            {hasAhl && <StatBlock league="AHL" cols={isGoalie ? GL_COLS : SK_COLS} reg={isGoalie ? gl.ahlReg : sk.ahlReg} po={isGoalie ? gl.ahlPo : sk.ahlPo} cellsOf={isGoalie ? glCells : skCells} team={<TeamCell />} />}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500">No games played in {SEASON}.</div>
        )}
      </Card>

      {/* ── INJURY ─────────────────────────────────────────────────── */}
      {p.injuryDaysLeft > 0 && (
        <Card title="Injury" accent="text-red-400">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-300">{p.injuryDesc || "Injured"}</span>
            <span className="text-xs text-slate-500">{p.injuryDaysLeft} days left</span>
          </div>
        </Card>
      )}
    </div>
  );
}
