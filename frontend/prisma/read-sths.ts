import fs from "fs";

const data = fs.readFileSync(
  "data/rosters.sths",
  "utf8"
);

console.log(data.substring(0, 1000));