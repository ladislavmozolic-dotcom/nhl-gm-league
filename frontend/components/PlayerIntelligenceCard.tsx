import { findSimilarPlayers } from "@/lib/gm-assistant/similarPlayers";
import { Card } from "@/components/ui";
import SortableTable, { type SortCol, type SortRow } from "@/components/SortableTable";

// UNHL Intelligence — "Similar Players" / "Contract Comparables" panel on the
// player profile. Same explainable-numbers rule as the rest of the tool: the
// sort is a plain distance over CK/PA/SC/DF (or overall for goalies) + age —
// shown as-is in the table, not hidden behind a single "match %" verdict.
// See memory: gm-assistant-intelligence.
export default async function PlayerIntelligenceCard({ playerId }: { playerId: number }) {
  const result = await findSimilarPlayers(playerId, 8);
  if (!result || result.players.length === 0) return null;

  const rows: SortRow[] = result.players.map((p) => ({
    _id: p.id, name: p.name, slug: p.slug, teamCode: p.teamCode, teamSlug: p.teamSlug, teamLogo: p.teamLogo,
    pos: p.position, age: p.age,
    ck: p.ck, pa: p.pa, sc: p.sc, df: p.df,
    ovr: p.overall, cap: p.capHit, yrs: p.contractYears,
    status: p.rosterType,
  }));

  const cols: SortCol[] = [
    { key: "name", label: "Player", kind: "player", sticky: true },
    { key: "team", label: "Team", kind: "team" },
    { key: "pos", label: "Pos", kind: "text" },
    { key: "age", label: "Age", kind: "num" },
    ...(result.isGoalie ? [] : ([
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

  return (
    <Card title="🧠 UNHL Intelligence — Similar Players" accent="text-blue-400" bodyClassName="p-2">
      <p className="text-xs text-slate-400 px-2 pt-1 pb-2">
        Najbližší profil podľa {result.isGoalie ? "overall ratingu" : "CK/PA/SC/DF"} a veku — v poradí zoradenom od najbližšieho.
        Zmluvy v tabuľke slúžia aj ako contract comparables.
      </p>
      <SortableTable cols={cols} rows={rows} minWidth={760} />
    </Card>
  );
}
