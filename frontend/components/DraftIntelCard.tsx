import { draftIntelligence, type BpaEntry, type RiskEntry } from "@/lib/gm-assistant/draftIntel";
import type { DraftSourceWhere } from "@/lib/draft-source";
import { Card } from "@/components/ui";
import { countryFlag } from "@/lib/flags";

const posColor: Record<string, string> = { C: "text-sky-400", LW: "text-emerald-400", RW: "text-emerald-400", D: "text-amber-400", G: "text-rose-400" };
const POS_LABEL: Record<string, string> = { C: "Center", LW: "Left Wing", RW: "Right Wing", D: "Defense", G: "Goalie" };

/** Personal info line: age · height/weight (metric) · shoots · league. */
function bioLine(p: BpaEntry): string {
  const parts: string[] = [];
  const m = p.birthDate ? /^(\d{4})-(\d{2})/.exec(p.birthDate) : null;
  if (m) {
    const now = new Date();
    let age = now.getUTCFullYear() - +m[1];
    if (now.getUTCMonth() + 1 < +m[2]) age--;
    parts.push(`${age} r.`);
  }
  if (p.heightIn) parts.push(`${Math.round(p.heightIn * 2.54)} cm`);
  if (p.weightLb) parts.push(`${Math.round(p.weightLb * 0.4536)} kg`);
  if (p.shoots) parts.push(p.shoots === "L" ? "shoots L" : "shoots R");
  const lg = [p.amateurClub, p.amateurLeague].filter(Boolean).join(" · ");
  if (lg) parts.push(lg);
  return parts.join(" · ");
}

function ProspectRow({ p, note }: { p: BpaEntry | RiskEntry; note?: string }) {
  return (
    <div className="flex items-center justify-between text-xs border border-slate-800 rounded-lg px-3 py-2">
      <span className="text-slate-200 font-medium">
        {countryFlag(p.country)} {p.name} <span className={`ml-1 ${posColor[p.position] ?? "text-slate-400"}`}>{p.position}</span>
      </span>
      <span className="text-slate-400">
        {bioLine(p) || "—"}{p.csRank != null && ` · CS #${p.csRank}`}{note}
      </span>
    </div>
  );
}

// UNHL Intelligence — "Draft Intelligence" (phase 5 — see memory:
// gm-assistant-intelligence). Multiple independent lenses on the pick — Best
// Player Available, Highest Upside, Lowest Risk, Position Need, Best Org Fit,
// and real past-class outcomes where the data supports it — never a single
// auto-pick recommendation. Shown to any signed-in GM (own team's needs),
// not gated to whoever's currently on the clock, so a club can prep ahead.
export default async function DraftIntelCard({ teamId, draftYear, available, sourceWhere }: {
  teamId: number; draftYear: number;
  available: { id: number; name: string; position: string; country: string | null; ov: number; potential: number; csRank: number | null; birthDate?: string | null; heightIn?: number | null; weightLb?: number | null; shoots?: string | null; amateurLeague?: string | null; amateurClub?: string | null }[];
  sourceWhere: DraftSourceWhere;
}) {
  const intel = await draftIntelligence(teamId, draftYear, available, sourceWhere);
  if (!intel) return null;

  return (
    <Card title="🧠 UNHL Intelligence — Draft Intelligence" accent="text-blue-400" bodyClassName="p-3 flex flex-col gap-5">
      <div>
        <div className="text-sm font-bold text-slate-200 mb-1">Position Need</div>
        <p className="text-xs text-slate-400 mb-2">Your team by the CK/PA/SC/DF average (or overall for goalies) at that position, versus the league median.</p>
        <div className="flex flex-col gap-1.5">
          {intel.positionNeeds.map((n) => (
            <div key={n.position} className="flex items-center justify-between text-xs border border-slate-800 rounded-lg px-3 py-2">
              <span className={posColor[n.position] ?? "text-slate-300"}>{POS_LABEL[n.position]}</span>
              <span className="text-slate-400">
                {n.teamRating != null ? <>Your average {n.teamRating} · median {n.leagueMedian}</> : "you have no one here"}
                {n.delta != null && (
                  <span className={`ml-2 font-semibold ${n.delta > 0 ? "text-emerald-400" : n.delta < 0 ? "text-red-400" : "text-slate-500"}`}>
                    {n.delta > 0 ? `+${n.delta}` : n.delta}
                  </span>
                )}
                {n.rank != null && <span className="text-slate-500"> · {n.rank}./{n.outOf} v lige</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      {intel.bestOrgFit && intel.bestOrgFit.prospects.length > 0 && (
        <div>
          <div className="text-sm font-bold text-slate-200 mb-1">Best Org Fit — {POS_LABEL[intel.bestOrgFit.position]}</div>
          <p className="text-xs text-slate-400 mb-2">
            Your relatively weakest position on your own roster ({intel.bestOrgFit.delta != null ? (intel.bestOrgFit.delta > 0 ? `+${intel.bestOrgFit.delta}` : intel.bestOrgFit.delta) : "—"} vs. the league median) — best available prospects at this position.
          </p>
          <div className="flex flex-col gap-1.5">
            {intel.bestOrgFit.prospects.map((p) => <ProspectRow key={p.id} p={p} />)}
          </div>
        </div>
      )}

      <div>
        <div className="text-sm font-bold text-slate-200 mb-1">Best Player Available</div>
        <p className="text-xs text-slate-400 mb-2">Highest-ranked in the draft by board order, regardless of team need.</p>
        <div className="flex flex-col gap-1.5">
          {intel.bpa.map((p) => <ProspectRow key={p.id} p={p} />)}
        </div>
      </div>

      <div>
        <div className="text-sm font-bold text-slate-200 mb-1">Highest Upside</div>
        <p className="text-xs text-slate-400 mb-2">Highest projected ceiling — the most room to grow.</p>
        <div className="flex flex-col gap-1.5">
          {intel.upside.map((p) => <ProspectRow key={p.id} p={p} />)}
        </div>
      </div>

      <div>
        <div className="text-sm font-bold text-slate-200 mb-1">Lowest Risk</div>
        <p className="text-xs text-slate-400 mb-2">Among the top 40, those closest to a finished product — less dependent on projection.</p>
        <div className="flex flex-col gap-1.5">
          {intel.lowestRisk.map((p) => <ProspectRow key={p.id} p={p} />)}
        </div>
      </div>

      {intel.comparables.picks.length > 0 && (
        <div>
          <div className="text-sm font-bold text-slate-200 mb-1">Comparable Past Prospects — {intel.comparables.forProspect}</div>
          <p className="text-xs text-slate-400 mb-2">
            Past prospects at the same position with a similar draft-day OV/POT, and what they actually became in this league. Missing rating = the player did not stick on an NHL roster.
          </p>
          <div className="flex flex-col gap-1.5">
            {intel.comparables.picks.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs border border-slate-800 rounded-lg px-3 py-2">
                <span className="text-slate-300">{c.name} <span className="text-slate-500">({c.draftYear}{c.overallPick ? `, #${c.overallPick}` : ""})</span></span>
                <span className="text-slate-400">
                  draft OV {c.draftOv}/POT {c.draftPotential} → teraz {c.nowRating != null ? c.nowRating.toFixed(1) : "nie je v NHL"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
