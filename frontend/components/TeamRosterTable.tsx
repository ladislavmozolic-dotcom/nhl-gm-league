import { Card } from "@/components/ui";
import RosterRows from "@/components/RosterRows";

// Cap hit from contractText ("6,500,000$ / 4yrs" → 6500000)
export function parseCapFromContract(contractText: string | null): number {
  if (!contractText) return 0;
  const nums = contractText.match(/[\d,]+/);
  return nums ? parseInt(nums[0].replace(/,/g, ""), 10) : 0;
}

export function salaryOf(p: any): number {
  if ((p.contractYears ?? 0) <= 0) return 0;
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
    goalies: players.filter((p) => p.isGoalie).map((p) => ({
      ...p,
      ...(p.goalieRating ?? {}),
      condition: p.condition,
      mo: p.mo,
    })),
  };
}

const SKATER_ATTRS = ["ck", "fg", "di", "sk", "st", "en", "du", "ph", "fo", "pa", "sc", "df", "ps", "ex", "ld", "mo"];
const GOALIE_ATTRS = ["sk", "du", "en", "sz", "ag", "rb", "sc", "hs", "rt", "ph", "ps", "ex", "ld", "mo"];

export function RosterSection({
  title,
  players,
  accent,
  farm,
  hideAttrs,
  onOfferTwoWay,
}: {
  title: string;
  players: any[];
  accent?: string;
  farm?: boolean;
  hideAttrs?: boolean;
  onOfferTwoWay?: (player: any) => void;
}) {
  const isGoalie = title.toLowerCase().includes("goalie") || title.toLowerCase().includes("brankár");
  const isDef = title.toLowerCase().includes("defense") || title.toLowerCase().includes("obranc");
  const attrs = isGoalie ? GOALIE_ATTRS : SKATER_ATTRS;

  const totalCap = players.reduce((sum, p) => sum + salaryOf(p), 0);
  const avgOv = players.length > 0 ? (players.reduce((sum, p) => sum + (p.overall ?? 0), 0) / players.length).toFixed(1) : "—";

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-md">
      <div className="px-4 sm:px-5 py-3 border-b border-slate-800/80 bg-slate-850/50 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-base">{isGoalie ? "🥅" : isDef ? "🛡️" : "🏒"}</span>
          <h3 className={`text-sm sm:text-base font-extrabold tracking-tight ${accent || "text-white"}`}>
            {title}
          </h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 border border-slate-700/60 text-slate-300 tabular-nums">
            {players.length}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="hidden sm:inline">
            <span className="text-slate-500">Ø OVR:</span>{" "}
            <span className="font-bold text-slate-200">{avgOv}</span>
          </span>
          <span className="hidden sm:inline">•</span>
          <span>
            <span className="text-slate-500">Cap:</span>{" "}
            <span className="font-bold text-emerald-400">{fmtM(totalCap)}</span>
          </span>
        </div>
      </div>

      <RosterRows
        players={players}
        attrs={attrs}
        isGoalie={isGoalie}
        farm={farm}
        hideAttrs={hideAttrs}
        onOfferTwoWay={onOfferTwoWay}
      />
    </div>
  );
}

/** Full NHL roster grouped into Forwards / Defensemen / Goalies. */
export function RosterTables({ players }: { players: any[] }) {
  const g = groupRoster(players);
  if (players.length === 0)
    return (
      <Card>
        <p className="text-slate-500 text-center py-8">No players on roster</p>
      </Card>
    );

  return (
    <div className="space-y-6">
      {g.forwards.length > 0 && <RosterSection title="Forwards" players={g.forwards} />}
      {g.defense.length > 0 && <RosterSection title="Defensemen" players={g.defense} />}
      {g.goalies.length > 0 && <RosterSection title="Goalies" players={g.goalies} />}
    </div>
  );
}
