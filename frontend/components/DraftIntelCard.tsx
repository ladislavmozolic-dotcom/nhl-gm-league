import { draftIntelligence, type BpaEntry, type RiskEntry } from "@/lib/gm-assistant/draftIntel";
import type { DraftSourceWhere } from "@/lib/draft-source";
import { Card } from "@/components/ui";
import { countryFlag } from "@/lib/flags";

const posColor: Record<string, string> = { C: "text-sky-400", LW: "text-emerald-400", RW: "text-emerald-400", D: "text-amber-400", G: "text-rose-400" };
const POS_LABEL: Record<string, string> = { C: "Center", LW: "Left Wing", RW: "Right Wing", D: "Defense", G: "Goalie" };

function ProspectRow({ p, note }: { p: BpaEntry | RiskEntry; note?: string }) {
  return (
    <div className="flex items-center justify-between text-xs border border-slate-800 rounded-lg px-3 py-2">
      <span className="text-slate-200 font-medium">
        {countryFlag(p.country)} {p.name} <span className={`ml-1 ${posColor[p.position] ?? "text-slate-400"}`}>{p.position}</span>
      </span>
      <span className="text-slate-400">
        OV {p.ov} · POT {p.potential}{p.csRank != null && ` · CS #${p.csRank}`}{note}
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
  available: { id: number; name: string; position: string; country: string | null; ov: number; potential: number; csRank: number | null }[];
  sourceWhere: DraftSourceWhere;
}) {
  const intel = await draftIntelligence(teamId, draftYear, available, sourceWhere);
  if (!intel) return null;

  return (
    <Card title="🧠 UNHL Intelligence — Draft Intelligence" accent="text-blue-400" bodyClassName="p-3 flex flex-col gap-5">
      <div>
        <div className="text-sm font-bold text-slate-200 mb-1">Position Need</div>
        <p className="text-xs text-slate-400 mb-2">Váš tím podľa priemeru CK/PA/SC/DF (resp. overall pre brankárov) na danom poste, oproti ligovému mediánu.</p>
        <div className="flex flex-col gap-1.5">
          {intel.positionNeeds.map((n) => (
            <div key={n.position} className="flex items-center justify-between text-xs border border-slate-800 rounded-lg px-3 py-2">
              <span className={posColor[n.position] ?? "text-slate-300"}>{POS_LABEL[n.position]}</span>
              <span className="text-slate-400">
                {n.teamRating != null ? <>Váš priemer {n.teamRating} · medián {n.leagueMedian}</> : "nemáte tu nikoho"}
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
            Váš relatívne najslabší post spomedzi vlastného rosteru ({intel.bestOrgFit.delta != null ? (intel.bestOrgFit.delta > 0 ? `+${intel.bestOrgFit.delta}` : intel.bestOrgFit.delta) : "—"} oproti ligovému mediánu) — najlepšie dostupní prospekti na tomto poste.
          </p>
          <div className="flex flex-col gap-1.5">
            {intel.bestOrgFit.prospects.map((p) => <ProspectRow key={p.id} p={p} />)}
          </div>
        </div>
      )}

      <div>
        <div className="text-sm font-bold text-slate-200 mb-1">Best Player Available</div>
        <p className="text-xs text-slate-400 mb-2">Zoradené podľa OV (draft-day rating), bez ohľadu na potrebu tímu.</p>
        <div className="flex flex-col gap-1.5">
          {intel.bpa.map((p) => <ProspectRow key={p.id} p={p} />)}
        </div>
      </div>

      <div>
        <div className="text-sm font-bold text-slate-200 mb-1">Highest Upside</div>
        <p className="text-xs text-slate-400 mb-2">Zoradené podľa POT (odvodený strop) — najväčší priestor na rast, bez ohľadu na súčasný OV.</p>
        <div className="flex flex-col gap-1.5">
          {intel.upside.map((p) => <ProspectRow key={p.id} p={p} />)}
        </div>
      </div>

      <div>
        <div className="text-sm font-bold text-slate-200 mb-1">Lowest Risk</div>
        <p className="text-xs text-slate-400 mb-2">Najmenší rozdiel medzi OV a POT spomedzi top 40 podľa OV — bližšie k hotovému produktu, menej závislé od projekcie.</p>
        <div className="flex flex-col gap-1.5">
          {intel.lowestRisk.map((p) => <ProspectRow key={p.id} p={p} note={` · gap +${p.gap}`} />)}
        </div>
      </div>

      {intel.comparables.picks.length > 0 && (
        <div>
          <div className="text-sm font-bold text-slate-200 mb-1">Comparable Past Prospects — {intel.comparables.forProspect}</div>
          <p className="text-xs text-slate-400 mb-2">
            Minulí prospekti na rovnakom poste s podobným draft-day OV/POT a tým, čím sa reálne stali v tejto lige. Chýbajúci rating = hráč sa neudržal na NHL rostri.
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
