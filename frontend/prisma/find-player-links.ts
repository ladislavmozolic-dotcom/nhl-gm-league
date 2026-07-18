import fs from "fs";

const html = fs.readFileSync(
  "providence.html",
  "utf8"
);

const matches = [
  ...html.matchAll(/\/player\/\d+\/[^"']+/g),
];

const unique = [...new Set(matches.map(m => m[0]))];

console.log(unique.slice(0, 50));
console.log("TOTAL:", unique.length);