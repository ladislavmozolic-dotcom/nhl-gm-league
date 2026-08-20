import { Card, SectionTitle } from "@/components/ui";
import RosterRows from "@/components/RosterRows";

// Cap hit from contractText ("6,500,000$ / 4yrs" → 6500000)
export function parseCapFromContract(contractText: string | null): number {
  if (!contractText) return 0;
  const nums = contractText.match(/[\d,]+/);
  return nums ? parseInt(nums[0].replace(/,/g, ""), 10) : 0;
}
export function salaryOf(p: any): number {
  return p.capHit || parseCapFromContract(p.contractText);
}
export function fmtM(v: number): string {
  return v > 0 ? `$${(v / 1_000_000).toFixed(2)}M` : "—";
}

export type Grouped = { forwards: any[]; defense: any[]; goalies: any[] };
export function groupRoster(players: any[]): Grouped {
  const isFwd = (p: any) => !p.isGoalie && (p.position?.includes("C") || p.position?.includes("W") || p.position?.includes("F"));
  const isDef = (p: any) => !p.isGoalie && !isFwd(p) && p.position?.includes("D");
  return {
    forwards: players.filter(isFwd),
    defense: players.filter(isDef),
    // spread goalieRating for the goalie attrs, but keep the live Player.condition
    // (the sim writes CON to the Player row; goalieRating.condition is stale)
    goalies: players.filter((p) => p.isGoalie).map((p) => ({ ...p, ...(p.goalieRating ?? {}), condition: p.condition })),
  };
}

const SKATER_ATTRS = ["ck", "fg", "di", "sk", "st", "en", "du", "ph", "fo", "pa", "sc", "df", "ps", "ex", "ld", "mo"];
const GOALIE_ATTRS = ["sk", "du", "en", "sz", "ag", "rb", "sc", "hs", "rt", "ph", "ps", "ex", "ld", "mo"];

export function RosterSection({ title, players, accent, farm }: { title: string; players: any[]; accent?: string; farm?: boolean }) {
  const isGoalie = title === "Goalies";
  const attrs = isGoalie ? GOALIE_ATTRS : SKATER_ATTRS;

  return (
    <div>
      <SectionTitle count={players.length} accent={accent}>{title}</SectionTitle>
      <Card bodyClassName="p-0">
        <RosterRows players={players} attrs={attrs} isGoalie={isGoalie} farm={farm} />
      </Card>
    </div>
  );
}

/** Full NHL roster grouped into Forwards / Defensemen / Goalies. */
export function RosterTables({ players }: { players: any[] }) {
  const g = groupRoster(players);
  if (players.length === 0) return <Card><p className="text-slate-500 text-center py-8">No players on roster</p></Card>;
  return (
    <div className="space-y-6">
      {g.forwards.length > 0 && <RosterSection title="Forwards" players={g.forwards} />}
      {g.defense.length > 0 && <RosterSection title="Defensemen" players={g.defense} />}
      {g.goalies.length > 0 && <RosterSection title="Goalies" players={g.goalies} />}
    </div>
  );
}
