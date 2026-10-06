import Link from "next/link";
import PlayerAvatar from "@/components/playerAvatar";
import { cleanName } from "@/lib/playerName";
import InterestButton, { type InterestCtx } from "@/components/InterestButton";

export type SpotlightPlayer = {
  id: number;
  name: string;
  slug?: string | null;
  photoUrl?: string | null;
  position: string;
  age: number | null;
  overall: number;
  lastSeasonPts?: number | null;
  demandSalary: number;
  demandYears: number;
  deliberating?: {
    offers: number;
    remaining: string;
    countered?: boolean | null;
  } | null;
  isGoalie?: boolean;
};

export default function FreeAgentSpotlight({
  players,
  interestCtx,
  isEn,
}: {
  players: SpotlightPlayer[];
  interestCtx?: InterestCtx | null;
  isEn: boolean;
}) {
  if (!players || players.length === 0) return null;

  const ovrBadgeColor = (ovr: number) => {
    if (ovr >= 85) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    if (ovr >= 80) return "bg-sky-500/20 text-sky-300 border-sky-500/40";
    if (ovr >= 75) return "bg-blue-500/20 text-blue-300 border-blue-500/40";
    return "bg-slate-700/40 text-slate-300 border-slate-600/40";
  };

  const fmtM = (v: number) => (v > 0 ? `$${(v / 1_000_000).toFixed(2)}M` : "—");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
          <span>⭐</span> {isEn ? "Market Spotlight — Top Available Targets" : "Top dostupní voľní hráči na trhu"}
        </h3>
        <span className="text-[11px] text-slate-500">
          {isEn ? "Sorted by overall & market value" : "Podľa ratingu a trhovej hodnoty"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {players.map((p) => {
          const d = p.deliberating;
          return (
            <div
              key={p.id}
              className="group relative rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 to-[#0c1c31]/90 p-4 transition-all duration-300 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2.5">
                  <div className="relative">
                    <PlayerAvatar src={p.photoUrl ?? null} alt={p.name} size={52} />
                    <span
                      className={`absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded text-[10px] font-black font-mono border ${ovrBadgeColor(
                        p.overall
                      )}`}
                    >
                      {p.overall}
                    </span>
                  </div>

                  <div className="text-right">
                    {d ? (
                      <div className="space-y-0.5">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                          🕒 {d.offers} {isEn ? (d.offers === 1 ? "offer" : "offers") : (d.offers === 1 ? "ponuka" : "ponuky")}
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {d.countered ? (isEn ? "Improvement stage" : "Fáza vylepšenia") : `${isEn ? "decides in" : "rozhodnutie za"} ${d.remaining}`}
                        </div>
                      </div>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800/80 text-slate-400 border border-slate-700/60">
                        {isEn ? "Open Market" : "Otvorený trh"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  <Link
                    href={p.slug ? `/players/${p.slug}` : "#"}
                    className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors line-clamp-1 block"
                  >
                    {cleanName(p.name)}
                  </Link>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    <span className="font-semibold text-slate-300">{p.position}</span>
                    {p.age != null && <span> · {p.age} {isEn ? "yo" : "rokov"}</span>}
                    {p.lastSeasonPts != null && !p.isGoalie && (
                      <span className="text-slate-500"> · {p.lastSeasonPts} {isEn ? "pts" : "b"}</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/70 flex items-center justify-between gap-2">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-500 block tracking-wider">
                    {isEn ? "Market Demand" : "Požiadavka"}
                  </span>
                  <span className="text-xs font-black font-mono text-amber-400">
                    {fmtM(p.demandSalary)}{" "}
                    <span className="text-[10px] font-normal text-slate-400">
                      / {p.demandYears}{isEn ? "y" : "r"}
                    </span>
                  </span>
                </div>

                {interestCtx && (
                  <div>
                    <InterestButton
                      playerId={p.id}
                      name={cleanName(p.name)}
                      ctx={interestCtx}
                      label={isEn ? "Make Offer" : "Podať ponuku"}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-md shadow-blue-600/20"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
