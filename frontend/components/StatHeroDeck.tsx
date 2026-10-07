import Link from "next/link";
import PlayerAvatar from "@/components/playerAvatar";
import PlayerLink from "@/components/PlayerLink";

export type HeroCardItem = {
  badge: string;
  subBadge?: string;
  playerId?: number;
  slug?: string | null;
  name: string;
  photoUrl?: string | null;
  position?: string;
  teamId?: number | null;
  teamCode?: string | null;
  teamSlug?: string | null;
  teamLogo?: string | null;
  value: React.ReactNode;
  unit?: string;
  sub?: string;
  accentColor?: "amber" | "emerald" | "blue" | "rose" | "purple" | "sky";
};

export default function StatHeroDeck({
  cards,
  managedTeamIds = new Set(),
}: {
  cards: HeroCardItem[];
  managedTeamIds?: Set<number>;
}) {
  if (!cards || cards.length === 0) return null;

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${cards.length >= 4 ? "lg:grid-cols-4" : cards.length === 3 ? "lg:grid-cols-3" : ""} gap-3.5`}>
      {cards.map((c, idx) => {
        const isMine = c.teamId != null && managedTeamIds.has(c.teamId);

        // Color accenting
        const accent = isMine
          ? {
              border: "border-emerald-500/40 hover:border-emerald-400/80",
              gradient: "from-emerald-950/30 via-[#0b1120] to-[#0c1c31]",
              badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
              ring: "ring-emerald-400 bg-emerald-950",
              numBg: "bg-emerald-400 text-slate-950",
              valColor: "text-emerald-300",
              glow: "bg-emerald-500/10",
            }
          : c.accentColor === "rose"
          ? {
              border: "border-rose-500/30 hover:border-rose-500/70",
              gradient: "from-rose-950/20 via-[#0b1120] to-[#0c1c31]",
              badgeBg: "bg-rose-500/20 text-rose-300 border-rose-500/30",
              ring: "ring-rose-400/80 bg-slate-900",
              numBg: "bg-rose-400 text-slate-950",
              valColor: "text-rose-300",
              glow: "bg-rose-500/10",
            }
          : c.accentColor === "blue" || c.accentColor === "sky"
          ? {
              border: "border-sky-500/30 hover:border-sky-500/70",
              gradient: "from-sky-950/20 via-[#0b1120] to-[#0c1c31]",
              badgeBg: "bg-sky-500/20 text-sky-300 border-sky-500/30",
              ring: "ring-sky-400/80 bg-slate-900",
              numBg: "bg-sky-400 text-slate-950",
              valColor: "text-sky-300",
              glow: "bg-sky-500/10",
            }
          : c.accentColor === "purple"
          ? {
              border: "border-purple-500/30 hover:border-purple-500/70",
              gradient: "from-purple-950/20 via-[#0b1120] to-[#0c1c31]",
              badgeBg: "bg-purple-500/20 text-purple-300 border-purple-500/30",
              ring: "ring-purple-400/80 bg-slate-900",
              numBg: "bg-purple-400 text-slate-950",
              valColor: "text-purple-300",
              glow: "bg-purple-500/10",
            }
          : {
              border: "border-amber-500/30 hover:border-amber-500/70",
              gradient: "from-amber-500/15 via-[#0b1120] to-[#0c1c31]",
              badgeBg: "bg-amber-500/20 text-amber-300 border-amber-500/30",
              ring: "ring-amber-400/80 bg-slate-900",
              numBg: "bg-amber-400 text-slate-950",
              valColor: "text-amber-400",
              glow: "bg-amber-500/10",
            };

        const isTeamOnly = c.playerId == null;

        return (
          <div
            key={idx}
            className={`bg-gradient-to-br ${accent.gradient} border ${accent.border} rounded-2xl p-4 relative overflow-hidden shadow-xl flex flex-col justify-between transition-all group hover:scale-[1.01]`}
          >
            <div className={`absolute -right-8 -bottom-8 w-28 h-28 ${accent.glow} rounded-full blur-2xl pointer-events-none`} />

            <div>
              {/* Badge row */}
              <div className="flex items-center justify-between mb-3 gap-2">
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border truncate ${accent.badgeBg}`}
                >
                  {c.badge}
                </span>
                {c.subBadge && (
                  <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0">
                    {c.subBadge}
                  </span>
                )}
              </div>

              {/* Entity info (player or team) */}
              <div className="flex items-center gap-3">
                {isTeamOnly ? (
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900/90 border border-slate-700 p-2 flex items-center justify-center shadow-md">
                      {c.teamLogo ? (
                        <img src={c.teamLogo} alt={c.name} className="w-full h-full object-contain" />
                      ) : (
                        <span className="font-bold text-xs text-slate-400">{c.teamCode ?? "—"}</span>
                      )}
                    </div>
                    <span
                      className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full font-black text-[9px] flex items-center justify-center border border-slate-950 shadow font-mono ${accent.numBg}`}
                    >
                      1
                    </span>
                  </div>
                ) : (
                  <div className="relative shrink-0">
                    <div className={`rounded-full p-0.5 overflow-hidden shadow-lg ring-2 ${accent.ring}`}>
                      <PlayerAvatar src={c.photoUrl ?? null} alt={c.name} size={46} />
                    </div>
                    <span
                      className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full font-black text-[9px] flex items-center justify-center border border-slate-950 shadow font-mono ${accent.numBg}`}
                    >
                      1
                    </span>
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  {c.playerId != null ? (
                    <div className="font-black text-white text-sm hover:text-blue-400 truncate">
                      <PlayerLink
                        id={c.playerId}
                        name={c.name}
                        clean={false}
                        className={isMine ? "text-emerald-300 font-bold hover:text-emerald-200" : undefined}
                      />
                    </div>
                  ) : c.teamSlug ? (
                    <Link
                      href={`/teams/${c.teamSlug}`}
                      className="font-black text-white text-sm hover:text-blue-400 transition-colors truncate block"
                    >
                      {c.name}
                    </Link>
                  ) : (
                    <div className="font-black text-white text-sm truncate">{c.name}</div>
                  )}

                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5 flex-wrap">
                    {c.teamCode && (
                      <Link
                        href={c.teamSlug ? `/teams/${c.teamSlug}` : "#"}
                        className="inline-flex items-center gap-1 text-slate-300 hover:text-blue-400 transition-colors font-bold"
                      >
                        {c.teamLogo && <img src={c.teamLogo} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />}
                        <span>{c.teamCode}</span>
                      </Link>
                    )}
                    {c.position && <span className="text-slate-500">· {c.position}</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Metric Footer */}
            <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-slate-400 font-mono truncate">{c.sub ?? ""}</span>
              <div className="text-right shrink-0">
                <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${accent.valColor}`}>
                  {c.value}
                </span>
                {c.unit && (
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">
                    {c.unit}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
