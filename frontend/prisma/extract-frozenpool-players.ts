import fs from "fs";

const html = fs.readFileSync(
  "ahl-stats.html",
  "utf8"
);

const matches = [
  ...html.matchAll(
    /frozenpool_ahl_player\.php\?id=(\d+)/g
  ),
];

const ids = [...new Set(matches.map(m => m[1]))];

console.log("UNIQUE PLAYERS:", ids.length);

console.log(ids.slice(0, 20));