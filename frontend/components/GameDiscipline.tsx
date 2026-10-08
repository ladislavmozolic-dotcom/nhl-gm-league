// Discipline card on a game page: every ejection (game misconduct / match penalty) with the
// infraction, the clock, and — once Player Safety has ruled — the suspension that followed.

export type DisciplineItem = {
  key: string;
  playerName: string;
  teamCode: string | null;
  teamName: string | null;
  infraction: string;          // e.g. "Head-butting (Major / Game Misconduct)"
  period: number;
  seconds: number;
  ruling: { kind: "SUSPENSION" | "FINE"; games: number; fine: number; status: string } | null;
};

const MULTI_WORD = ["Maple Leafs", "Blue Jackets", "Golden Knights", "Red Wings"];
function nickname(name: string | null): string | null {
  if (!name) return null;
  const t = name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const multi = MULTI_WORD.find((m) => t.endsWith(m));
  return multi ?? t.split(/\s+/).slice(-1)[0];
}
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const periodTxt = (p: number) => (p >= 4 ? "overtime" : `${["1st", "2nd", "3rd"][p - 1]} period`);

export default function GameDiscipline({ items, reviewable = true }: { items: DisciplineItem[]; reviewable?: boolean }) {
  if (!items.length) return null;
  return (
    <div className="mt-6 rounded-xl border border-rose-900/40 bg-rose-950/10 p-4">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-rose-300">⚖️ Discipline</div>
      <div className="space-y-4">
        {items.map((i) => (
          <div key={i.key} className="space-y-1 text-sm text-slate-200">
            <p><b className="text-white">{i.playerName}</b>{i.teamCode ? ` (${i.teamCode})` : ""} for {i.infraction} at {clock(i.seconds)}</p>
            <p><b className="text-white">{i.playerName}</b> ejected from game at {clock(i.seconds)} of {periodTxt(i.period)}</p>
            {i.ruling?.kind === "SUSPENSION" && (
              <p><b className="text-white">{i.playerName}</b> from {nickname(i.teamName) ?? "his club"} is suspended for {i.ruling.games} game(s){i.ruling.status === "OVERTURNED" ? " — overturned on appeal" : ""}</p>
            )}
            {i.ruling?.kind === "FINE" && (
              <p><b className="text-white">{i.playerName}</b> from {nickname(i.teamName) ?? "his club"} is fined ${i.ruling.fine.toLocaleString("en-US")} — no games</p>
            )}
            {!i.ruling && <p className="text-slate-500">{reviewable ? "Supplementary discipline: awaiting Player Safety review." : "Exhibition / minor-league game — no supplementary discipline."}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
