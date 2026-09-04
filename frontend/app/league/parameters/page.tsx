import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import SortableTable, { type SortCol, type SortRow } from "@/components/SortableTable";
import { ratingColor, ovColor, posGroup } from "@/lib/ratingBands";
import { isLoggedIn } from "@/lib/auth";
import { edgeRatings, edgeGoalieRatings, edgeAhlSkaterRatings, type EdgeRow } from "@/lib/edge-params-server";
import { SKATER_PARAM_LABELS, GOALIE_PARAM_LABELS, SKATER_PARAM_ORDER, GOALIE_PARAM_ORDER } from "@/lib/param-labels";

export const dynamic = "force-dynamic";

type SetKey = "sths" | "unhl" | "nextgen";
type PosKey = "skaters" | "goalies";

const SETS: { key: SetKey; label: string; blurb: string }[] = [
  { key: "sths", label: "STHS Parameters", blurb: "The classic set — what actually drives the simulation today." },
  { key: "unhl", label: "UNHL Parameters", blurb: "A second, independently-editable copy of the STHS set (seeded from it, now diverging)." },
  { key: "nextgen", label: "Next Gen Parameters", blurb: "Built live from real NHL performance data — Passing, Scoring, Defense and Skating are formula-driven; not wired into the live site or the sim." },
];

export default async function LeagueParametersPage({ searchParams }: { searchParams: Promise<{ set?: string; pos?: string }> }) {
  const loggedIn = await isLoggedIn();

  const sp = await searchParams;
  const set: SetKey = sp.set === "unhl" || sp.set === "nextgen" ? sp.set : "sths";
  const pos: PosKey = sp.pos === "goalies" ? "goalies" : "skaters";
  const active = SETS.find((s) => s.key === set)!;

  const linkFor = (s: SetKey, p: PosKey) => `/league/parameters?set=${s}&pos=${p}`;

  let cols: SortCol[] = [];
  let rows: SortRow[] = [];
  let count = 0;

  if (loggedIn) {
    const isGoalie = pos === "goalies";
    const labels = isGoalie ? GOALIE_PARAM_LABELS : SKATER_PARAM_LABELS;
    const order = isGoalie ? GOALIE_PARAM_ORDER : SKATER_PARAM_ORDER;

    cols = [
      { key: "name", label: isGoalie ? "Goalie" : "Player", kind: "player", sticky: true },
      { key: "team", label: "Team", kind: "team" },
      { key: "pos", label: "Pos", kind: "text" },
      ...order.map((k): SortCol => ({ key: k.toLowerCase(), label: k, kind: k === "OV" ? "ovr" : "num", info: labels[k] })),
    ];

    if (set === "nextgen") {
      // AHL goalies have no MoneyPuck-driven data source, so the Next Gen formula
      // only ever covers NHL netminders — skaters get an AHL-specific (simpler)
      // translation instead, so both leagues show up on that tab.
      let edge: EdgeRow[];
      if (isGoalie) {
        edge = await edgeGoalieRatings("NHL", true);
      } else {
        const nhl = await edgeRatings("NHL", true);
        // edgeAhlSkaterRatings() covers everyone with AHL stats on file, including a
        // current NHL call-up — drop those here so he isn't listed twice (once per
        // branch) with the same row id, which corrupts the sortable table.
        const nhlIds = new Set(nhl.map((r) => r.playerId));
        const ahl = (await edgeAhlSkaterRatings(true)).filter((r) => !nhlIds.has(r.playerId));
        edge = [...nhl, ...ahl];
      }
      const ids = edge.map((r) => r.playerId);
      const meta = await prisma.player.findMany({
        where: { id: { in: ids } },
        select: { id: true, slug: true, photoUrl: true, position: true, team: { select: { code: true, slug: true, logoUrl: true } } },
      });
      const metaById = new Map(meta.map((m) => [m.id, m]));
      rows = edge.map((r) => {
        const m = metaById.get(r.playerId);
        const grp = isGoalie ? ("G" as const) : posGroup(m?.position ?? r.position, false);
        const row: SortRow = {
          _id: r.playerId, name: r.name, slug: m?.slug ?? null, photo: m?.photoUrl ?? null,
          teamCode: m?.team?.code ?? r.teamCode, teamSlug: m?.team?.slug ?? null, teamLogo: m?.team?.logoUrl ?? null,
          pos: m?.position ?? r.position,
        };
        for (const k of order) {
          const v = r.ratings[k] ?? null;
          row[k.toLowerCase()] = v;
          if (k === "OV" && v != null) row._c_ov = ovColor(grp, v);
          else if (v != null) row[`_c_${k.toLowerCase()}`] = ratingColor(grp, k.toLowerCase(), v);
        }
        return row;
      });
      count = rows.length;
    } else {
      const field = set === "unhl" ? "unhl" : "";
      const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
      if (!isGoalie) {
        const players = await prisma.player.findMany({
          where: { rosterType: { in: ["NHL", "AHL"] }, isGoalie: false },
          select: {
            id: true, name: true, slug: true, photoUrl: true, position: true,
            team: { select: { code: true, slug: true, logoUrl: true } },
            ck: true, fg: true, di: true, sk: true, st: true, en: true, du: true, ph: true, fo: true, pa: true,
            sc: true, df: true, ps: true, ex: true, ld: true, mo: true, overall: true,
            unhlCk: true, unhlFg: true, unhlDi: true, unhlSk: true, unhlSt: true, unhlEn: true, unhlDu: true, unhlPh: true,
            unhlFo: true, unhlPa: true, unhlSc: true, unhlDf: true, unhlPs: true, unhlEx: true, unhlLd: true, unhlMo: true, unhlOverall: true,
          },
        });
        count = players.length;
        rows = players.map((p) => {
          const grp = posGroup(p.position, false);
          const row: SortRow = { _id: p.id, name: p.name, slug: p.slug, photo: p.photoUrl, teamCode: p.team?.code ?? null, teamSlug: p.team?.slug ?? null, teamLogo: p.team?.logoUrl ?? null, pos: p.position };
          for (const k of order) {
            const dbKey = (field ? `${field}${cap(k.toLowerCase())}` : k.toLowerCase()) as keyof typeof p;
            const v = (p as any)[k === "OV" ? (field ? "unhlOverall" : "overall") : dbKey] ?? null;
            row[k.toLowerCase()] = v;
            if (v != null) row[k === "OV" ? "_c_ov" : `_c_${k.toLowerCase()}`] = k === "OV" ? ovColor(grp, v) : ratingColor(grp, k.toLowerCase(), v);
          }
          return row;
        });
      } else {
        const goalies = await prisma.player.findMany({
          where: { rosterType: { in: ["NHL", "AHL"] }, isGoalie: true },
          select: {
            id: true, name: true, slug: true, photoUrl: true, position: true,
            team: { select: { code: true, slug: true, logoUrl: true } },
            goalieRating: {
              select: {
                sk: true, du: true, en: true, sz: true, ag: true, rb: true, sc: true, hs: true, rt: true, ph: true, ps: true, ex: true, ld: true, mo: true, overall: true,
                unhlSk: true, unhlDu: true, unhlEn: true, unhlSz: true, unhlAg: true, unhlRb: true, unhlSc: true, unhlHs: true, unhlRt: true, unhlPh: true, unhlPs: true, unhlEx: true, unhlLd: true, unhlMo: true, unhlOverall: true,
              },
            },
          },
        });
        count = goalies.length;
        rows = goalies.map((g) => {
          const gr: any = g.goalieRating ?? {};
          const row: SortRow = { _id: g.id, name: g.name, slug: g.slug, photo: g.photoUrl, teamCode: g.team?.code ?? null, teamSlug: g.team?.slug ?? null, teamLogo: g.team?.logoUrl ?? null, pos: g.position };
          for (const k of order) {
            const dbKey = k === "OV" ? (field ? "unhlOverall" : "overall") : (field ? `${field}${cap(k.toLowerCase())}` : k.toLowerCase());
            const v = gr[dbKey] ?? null;
            row[k.toLowerCase()] = v;
            if (v != null) row[k === "OV" ? "_c_ov" : `_c_${k.toLowerCase()}`] = k === "OV" ? ovColor("G", v) : ratingColor("G", k.toLowerCase(), v);
          }
          return row;
        });
      }
    }
  }

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Parameters" subtitle="Compare every player-rating system the league tracks, side by side." />

      <div className="flex flex-wrap gap-2">
        {SETS.map((s) => (
          <Link key={s.key} href={linkFor(s.key, pos)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${set === s.key ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
            {s.label}
          </Link>
        ))}
      </div>
      <p className="text-sm text-slate-500 -mt-3">{active.blurb}</p>

      {!loggedIn ? (
        <Card>
          <p className="text-center text-slate-400 py-10 text-sm">
            🔒 <Link href="/login" className="text-blue-400 hover:underline">Sign in as a GM</Link> to see player parameters.
          </p>
        </Card>
      ) : (
        <>
          <div className="flex gap-2">
            {(["skaters", "goalies"] as const).map((p) => (
              <Link key={p} href={linkFor(set, p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${pos === p ? "bg-slate-700 text-white" : "border border-slate-700 text-slate-400 hover:bg-slate-800"}`}>
                {p}
              </Link>
            ))}
          </div>
          <Card bodyClassName="p-0">
            <div className="p-4">
              <p className="text-xs text-slate-500 mb-3">
                {count} {pos} · hover the ⓘ on a column to see what it stands for
                {set === "nextgen" && pos === "goalies" && " · AHL goalies aren't shown here — the Next Gen formula needs real NHL shot data that doesn't exist for them"}
              </p>
              <SortableTable cols={cols} rows={rows} initialSort="ov" minWidth={1400} csvFilename={`${set}-parameters-${pos}`} />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
