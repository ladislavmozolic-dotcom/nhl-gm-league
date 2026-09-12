import { fitForMyTeam, whoCouldWantHim } from "@/lib/gm-assistant/playerFit";
import { Card } from "@/components/ui";
import { money } from "@/lib/finance";

// UNHL Intelligence — "Fit for my team" + "Who could want him" (Player
// Intelligence, phase 4 — see memory: gm-assistant-intelligence). Every
// number here is the same per-slot rating Analyze My Roster and Find Trade
// Partner already show — this just holds one specific player up against it.
export default async function PlayerFitCard({
  playerId, playerTeamId, viewerTeamId,
}: { playerId: number; playerTeamId: number | null; viewerTeamId: number | null }) {
  if (viewerTeamId == null) return null;

  const showFit = playerTeamId !== viewerTeamId;
  const [fit, interest] = await Promise.all([
    showFit ? fitForMyTeam(playerId, viewerTeamId) : Promise.resolve(null),
    whoCouldWantHim(playerId, 6),
  ]);

  const hasFit = !!fit && fit.slots.some((s) => s.teamRating != null || s.playerRating != null);
  const hasInterest = !!interest && interest.teams.length > 0;
  if (!hasFit && !hasInterest) return null;

  return (
    <Card title="🧠 UNHL Intelligence — Fit & Interest" accent="text-blue-400" bodyClassName="p-3 flex flex-col gap-4">
      {hasFit && fit && (
        <div>
          <div className="text-sm font-bold text-slate-200 mb-1">Fit for my team ({fit.teamName})</div>
          <p className="text-xs text-slate-400 mb-2">
            Cap hit {money(fit.playerCapHit)} vs. vaše cap space {money(fit.capSpace)} —{" "}
            <span className={fit.capFits ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
              {fit.capFits ? "zmestí sa pod cap" : "presiahol by cap"}
            </span>.
          </p>
          <div className="flex flex-col gap-1.5">
            {fit.slots.map((s) => (
              <div key={s.slotId} className="flex items-center justify-between text-xs border border-slate-800 rounded-lg px-3 py-2">
                <span className="text-slate-300">{s.slotLabel}</span>
                <span className="text-slate-400">
                  {s.teamRating != null ? <>Váš priemer {s.teamRating}{s.teamAuto && " (auto)"}</> : "nemáte tu nikoho"}
                  {" · hráč "}{s.playerRating ?? "?"}
                  {s.delta != null && (
                    <span className={`ml-2 font-semibold ${s.delta > 0 ? "text-emerald-400" : s.delta < 0 ? "text-red-400" : "text-slate-500"}`}>
                      {s.delta > 0 ? `+${s.delta} zlepšenie` : s.delta < 0 ? `${s.delta} pokles` : "rovnaká úroveň"}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasInterest && interest && (
        <div>
          <div className="text-sm font-bold text-slate-200 mb-1">Who could want him</div>
          <p className="text-xs text-slate-400 mb-2">
            Kluby, ktorých zodpovedajúci slot momentálne ratuje nižšie než tento hráč — reálna potreba, nie ochota obchodovať.
          </p>
          <div className="flex flex-wrap gap-2">
            {interest.teams.map((t) => (
              <span key={`${t.teamId}-${t.slotId}`} className="text-xs border border-slate-800 rounded-lg px-3 py-2 bg-slate-900/40">
                <span className="text-slate-200 font-semibold">{t.teamName}</span>
                <span className="text-slate-500"> — {t.slotLabel} {t.teamRating}</span>{" "}
                <span className="text-emerald-400 font-semibold">+{t.delta}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
