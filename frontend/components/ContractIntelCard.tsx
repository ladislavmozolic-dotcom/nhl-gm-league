import { contractIntel } from "@/lib/gm-assistant/contractIntel";
import { Card } from "@/components/ui";
import { money } from "@/lib/finance";
import { cleanName } from "@/lib/playerName";

const CONFIDENCE_LABEL: Record<string, string> = { high: "vysoká", medium: "stredná", low: "nízka" };
const CONFIDENCE_COLOR: Record<string, string> = { high: "text-emerald-400", medium: "text-amber-400", low: "text-red-400" };

// UNHL Intelligence — "Contract & Market Intelligence" (Player Intelligence,
// phase 4 — see memory: gm-assistant-intelligence). A range with a stated
// confidence, never one number; four separate risk factors, never a blended
// score — market value here is a reference for the GM, not a mandated price.
export default async function ContractIntelCard({ playerId }: { playerId: number }) {
  const intel = await contractIntel(playerId);
  if (!intel) return null;

  const elevatedCount = intel.risk.filter((r) => r.elevated).length;

  return (
    <Card title="🧠 UNHL Intelligence — Contract & Market" accent="text-blue-400" bodyClassName="p-3 flex flex-col gap-4">
      {intel.market && (
        <div>
          <div className="text-sm font-bold text-slate-200 mb-1">Market Range</div>
          <p className="text-xs text-slate-400 mb-2">
            Rozsah cap hitu z {intel.market.sampleSize} najbližších profilov (Similar Players) — spoľahlivosť{" "}
            <span className={`font-semibold ${CONFIDENCE_COLOR[intel.market.confidence]}`}>{CONFIDENCE_LABEL[intel.market.confidence]}</span>
            {intel.market.confidence !== "high" && " (málo alebo rozptýlených porovnaní)"}. Referenčný rozsah, nie odporúčaná cena.
          </p>
          <div className="flex flex-wrap gap-3 text-xs mb-2">
            {[
              ["Min", intel.market.min], ["P25", intel.market.p25], ["Medián", intel.market.median],
              ["P75", intel.market.p75], ["Max", intel.market.max],
            ].map(([label, val]) => (
              <div key={label as string} className="border border-slate-800 rounded-lg px-3 py-2">
                <div className="text-slate-500">{label}</div>
                <div className="text-slate-200 font-semibold">{money(val as number)}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {intel.market.comps.map((c) => (
              <a key={c.id} href={`/players/${c.id}`} className="text-xs border border-slate-800 rounded-lg px-2 py-1 bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:border-slate-600">
                {cleanName(c.name)} · {money(c.capHit)}
              </a>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-sm font-bold text-slate-200 mb-1">Contract Risk</div>
        <p className="text-xs text-slate-400 mb-2">
          {elevatedCount === 0 ? "Žiadny faktor nie je zvýšený." : `${elevatedCount} zo ${intel.risk.length} faktorov je zvýšených.`}{" "}
          Cap hit {money(intel.capHit)}, zmluva do {intel.expiryYear} ({intel.expiryStatus}).
        </p>
        <div className="flex flex-col gap-1.5">
          {intel.risk.map((r) => (
            <div key={r.key} className="flex items-center justify-between text-xs border border-slate-800 rounded-lg px-3 py-2">
              <span className="text-slate-300">{r.label}</span>
              <span className={`font-semibold ${r.elevated ? "text-red-400" : "text-slate-400"}`}>
                {r.value}{r.elevated && " · zvýšené"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
