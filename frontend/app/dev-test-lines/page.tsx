import LineEditor from "@/components/LineEditor";
import { autoLines } from "@/lib/sim/lines-core";

export const dynamic = "force-dynamic";

const mk = (id: number, name: string, position: string, overall: number, number: number, con = 90) => ({
  id, name, position, overall, con, number, injured: false, cap: null as null,
});

const players = [
  mk(1, "Rickard Rakell", "LW", 84, 67), mk(2, "Sidney Crosby", "C", 96, 87), mk(3, "Bryan Rust", "RW", 82, 17),
  mk(4, "Michael Bunting", "LW", 78, 10), mk(5, "Evgeni Malkin", "C", 88, 71), mk(6, "Reilly Smith", "RW", 80, 24),
  mk(7, "Noel Acciari", "LW", 74, 20), mk(8, "Blake Lizotte", "C", 72, 15), mk(9, "Valtteri Puustinen", "RW", 70, 89),
  mk(10, "Connor Dewar", "LW", 71, 21), mk(11, "Calle Jarnkrok", "C", 75, 19), mk(12, "Sammy Helenius", "RW", 69, 38),
  mk(13, "Erik Karlsson", "D", 90, 65), mk(14, "Kris Letang", "D", 85, 58),
  mk(15, "Ty Reese", "D", 73, 6), mk(16, "David Friedman", "D", 71, 4),
];
const goalies = [mk(20, "Tristan Jarry", "G", 82, 35), mk(21, "Alex Nedeljkovic", "G", 76, 39)];

async function noopSave() {
  "use server";
}

export default async function DevTestLines() {
  const lines = autoLines(players, goalies);
  return (
    <LineEditor
      teamName="Pittsburgh Penguins"
      teamSlug="pittsburgh-penguins"
      players={players}
      goalies={goalies}
      initial={lines}
      onSave={noopSave}
    />
  );
}
