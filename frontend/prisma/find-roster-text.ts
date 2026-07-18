import fs from "fs";

const html = fs.readFileSync(
  "providence.html",
  "utf8"
);

const keywords = [
  "Roster",
  "Forwards",
  "Defensemen",
  "Defencemen",
  "Goalies",
  "2025-2026",
];

for (const keyword of keywords) {
  const index = html.indexOf(keyword);

  if (index !== -1) {
    console.log(`\n=== ${keyword} ===\n`);

    console.log(
      html.substring(
        Math.max(0, index - 500),
        index + 3000
      )
    );
  }
}