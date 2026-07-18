import fs from "fs";

const html = fs.readFileSync(
  "providence.html",
  "utf8"
);

const rosterIndex = html.indexOf("Roster");

console.log(
  html.substring(
    rosterIndex - 500,
    rosterIndex + 10000
  )
);