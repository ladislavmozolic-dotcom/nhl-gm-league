import fs from "fs";

const lines = fs
  .readFileSync("./data/PlayersNHL.csv", "utf8")
  .split(/\r?\n/)
  .filter(Boolean);

const bad = lines.filter(
  (line) =>
    line.includes("?") ||
    line.includes(" ")
);

console.log({
  total: lines.length,
  badNames: bad.length,
});

console.log("\nFIRST 30:\n");

for (const row of bad.slice(0, 30)) {
  console.log(row);
}