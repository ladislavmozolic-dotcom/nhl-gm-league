import { findSimilarPlayers, findCheaperReplacements } from "@/lib/gm-assistant/similarPlayers";
import { idealRole } from "@/lib/gm-assistant/idealRole";
import { Card } from "@/components/ui";
import { money } from "@/lib/finance";
import SortableTable, { type SortCol, type SortRow } from "@/components/SortableTable";

const similarCols = (isGoalie: boolean): SortCol[] => [
  { key: "name", label: "Player", kind: "player", sticky: true },
  { key: "team", label: "Team", kind: "team" },
  { key: "pos", label: "Pos", kind: "text" },
  { key: "age", label: "Age", kind: "num" },
  ...(isGoalie ? [] : ([
    { key: "ck", label: "CK", kind: "num" },
    { key: "pa", label: "PA", kind: "num" },
    { key: "sc", label: "SC", kind: "num" },
    { key: "df", label: "DF", kind: "num" },
  ] as SortCol[])),
  { key: "ovr", label: "OVR", kind: "ovr" },
  { key: "cap", label: "Cap Hit", kind: "money" },
  { key: "yrs", label: "Yrs", kind: "years" },
  { key: "status", label: "Status", kind: "text" },
];

// UNHL Intelligence — Player Intelligence panel: "Similar Players" / "Contract
// Comparables", "Ideal Role" and "Cheaper Replacement Options" (phase 4 — see
// memory: gm-assistant-intelligence). Same explainable-numbers rule
// throughout: every sort/rank is a plain distance or a league-median
// benchmark over CK/PA/SC/DF (or overall for goalies) + age, shown as-is in
// the tables — never a single hidden "match %" or "role" verdict.
export default async function PlayerIntelligenceCard({ playerId }: { playerId: number }) {
  const [similar, cheaper, role] = await Promise.all([
    findSimilarPlayers(playerId, 8),
    findCheaperReplacements(playerId, 8),
    idealRole(playerId),
  ]);

  const hasSimilar = !!similar && similar.players.length > 0;
  const hasCheaper = !!cheaper && cheaper.players.length > 0;
  const hasRole = !!role && role.slots.length > 0;
  if (!hasSimilar && !hasCheaper && !hasRole) return null;

  const bestRole = hasRole && role ? [...role.slots].sort((a, b) => a.rank - b.rank)[0] : null;

  const cheaperRows: SortRow[] | null = hasCheaper && cheaper ? cheaper.players.map((p) => ({
    _id: p.id, name: p.name, slug: p.slug, photo: p.photoUrl, teamCode: p.teamCode, teamSlug: p.teamSlug, teamLogo: p.teamLogo,
    pos: p.position, age: p.age,
    ck: p.ck, pa: p.pa, sc: p.sc, df: p.df,
    ovr: p.overall, cap: p.capHit, savings: p.savings, yrs: p.contractYears,
    status: p.rosterType,
  })) : null;

  return (
    <Card title="🧠 UNHL Intelligence — Player Intelligence" accent="text-blue-400" bodyClassName="p-3 flex flex-col gap-5">
      {hasRole && role && bestRole && (
        <div>
          <div className="text-sm font-bold text-slate-200 mb-1">Ideal role</div>
          <p className="text-xs text-slate-400 mb-2">
            Najbližšie jeho profilu ({role.playerRating.toFixed(1)}) zodpovedá{" "}
            <span className="text-emerald-400 font-semibold">{bestRole.slotLabel}</span> — tam by v lige rátingom skončil na{" "}
            {bestRole.rank}. mieste z {bestRole.outOf}. Rozpis podľa všetkých postov, na ktoré má nárok:
          </p>
          <div className="flex flex-col gap-1.5">
            {role.slots.map((s) => (
              <div key={s.slotId} className="flex items-center justify-between text-xs border border-slate-800 rounded-lg px-3 py-2">
                <span className="text-slate-300">{s.slotLabel}</span>
                <span className="text-slate-400">
                  Ligový medián {s.leagueMedian} · hráč {s.playerRating}
                  <span className={`ml-2 font-semibold ${s.delta > 0 ? "text-emerald-400" : s.delta < 0 ? "text-red-400" : "text-slate-500"}`}>
                    {s.delta > 0 ? `+${s.delta}` : s.delta}
                  </span>
                  <span className="text-slate-500"> · {s.rank}./{s.outOf} v lige</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasSimilar && similar && (
        <div>
          <div className="text-sm font-bold text-slate-200 mb-1">Similar Players</div>
          <p className="text-xs text-slate-400 mb-2">
            Najbližší profil podľa {similar.isGoalie ? "overall ratingu" : "CK/PA/SC/DF"} a veku — v poradí zoradenom od najbližšieho.
            Zmluvy v tabuľke slúžia aj ako contract comparables.
          </p>
          <SortableTable cols={similarCols(similar.isGoalie)} rows={similar.players.map((p) => ({
            _id: p.id, name: p.name, slug: p.slug, photo: p.photoUrl, teamCode: p.teamCode, teamSlug: p.teamSlug, teamLogo: p.teamLogo,
            pos: p.position, age: p.age,
            ck: p.ck, pa: p.pa, sc: p.sc, df: p.df,
            ovr: p.overall, cap: p.capHit, yrs: p.contractYears,
            status: p.rosterType,
          }))} minWidth={760} />
        </div>
      )}

      {hasCheaper && cheaper && cheaperRows && (
        <div>
          <div className="text-sm font-bold text-slate-200 mb-1">Cheaper Replacement Options</div>
          <p className="text-xs text-slate-400 mb-2">
            Podobný profil ako tento hráč (cap hit {money(cheaper.targetCapHit)}), ale za menej — zoradené od najbližšieho profilu.
            Nehovorí nič o tom, či je hráč dostupný alebo ochotný podpísať.
          </p>
          <SortableTable cols={[...similarCols(cheaper.isGoalie), { key: "savings", label: "Úspora", kind: "money" }]} rows={cheaperRows} minWidth={840} />
        </div>
      )}
    </Card>
  );
}
