import { postGameIntel, type TeamGameSwing, type GoalieGameSwing, type TeamPostGame } from "@/lib/gm-assistant/postGameIntel";
import { Card } from "@/components/ui";
import { cleanName } from "@/lib/playerName";

function SwingRow({ s, unit = "" }: { s: TeamGameSwing; unit?: string }) {
  return (
    <div className="flex items-center justify-between text-xs border border-slate-800 rounded-lg px-3 py-2">
      <span className="text-slate-300">{s.label}</span>
      <span className="text-slate-400">
        {s.gameValue}{unit} vs. sezónny priemer {s.seasonAvg}{unit} ({s.gamesInBaseline} zápasov)
        <span className={`ml-2 font-semibold ${s.delta > 0 ? "text-emerald-400" : s.delta < 0 ? "text-red-400" : "text-slate-500"}`}>
          {s.delta > 0 ? `+${s.delta}` : s.delta}{unit}
        </span>
      </span>
    </div>
  );
}

function TeamSwings({ team }: { team: TeamPostGame }) {
  if (!team.swings.length) return null;
  return (
    <div>
      <div className="text-sm font-bold text-slate-200 mb-1">{team.teamCode ?? "Team"}</div>
      <div className="flex flex-col gap-1.5">
        {team.swings.map((s) => <SwingRow key={s.key} s={s} unit={s.key === "faceoff" ? "%" : ""} />)}
      </div>
    </div>
  );
}

// UNHL Intelligence — "Post-game Intelligence" (phase 5 — see memory:
// gm-assistant-intelligence, completing the phase). Every number here is the
// team's/goalie's own real season-to-date baseline vs. this game's real
// result — never a "how well did they play" verdict, just what actually
// deviated and by how much. Shown for any FINAL game with at least one prior
// game this season to compare against.
export default async function PostGameIntelCard({ gameId }: { gameId: number }) {
  const intel = await postGameIntel(gameId);
  if (!intel) return null;
  const hasTeamSwings = intel.home.swings.length > 0 || intel.away.swings.length > 0;
  if (!hasTeamSwings && intel.goalies.length === 0) return null;

  return (
    <Card title="🧠 UNHL Intelligence — Post-Game" accent="text-blue-400" bodyClassName="p-3 flex flex-col gap-4">
      {hasTeamSwings && (
        <div>
          <div className="text-xs text-slate-400 mb-2">Tímové čísla tohto zápasu oproti vlastnému sezónnemu priemeru — najväčšie výkyvy hore.</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TeamSwings team={intel.home} />
            <TeamSwings team={intel.away} />
          </div>
        </div>
      )}

      {intel.goalies.length > 0 && (
        <div>
          <div className="text-sm font-bold text-slate-200 mb-1">Brankári</div>
          <div className="flex flex-col gap-1.5">
            {intel.goalies.map((g: GoalieGameSwing) => {
              const svDelta = Math.round((g.savePct - g.seasonSavePct) * 10) / 10;
              const gsaxDelta = Math.round((g.gsax - g.seasonGsaxPerGame) * 10) / 10;
              return (
                <div key={g.playerId} className="border border-slate-800 rounded-lg px-3 py-2 text-xs">
                  <div className="text-slate-200 font-medium mb-1">{cleanName(g.name)}</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-400">
                    <span>
                      SV% {g.savePct}% vs. priemer {g.seasonSavePct}% ({g.gamesInBaseline} zápasov)
                      <span className={`ml-1.5 font-semibold ${svDelta > 0 ? "text-emerald-400" : svDelta < 0 ? "text-red-400" : "text-slate-500"}`}>
                        {svDelta > 0 ? `+${svDelta}` : svDelta}%
                      </span>
                    </span>
                    <span>
                      GSAx {g.gsax} vs. priemer {g.seasonGsaxPerGame}/zápas
                      <span className={`ml-1.5 font-semibold ${gsaxDelta > 0 ? "text-emerald-400" : gsaxDelta < 0 ? "text-red-400" : "text-slate-500"}`}>
                        {gsaxDelta > 0 ? `+${gsaxDelta}` : gsaxDelta}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
