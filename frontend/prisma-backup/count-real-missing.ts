import fs from "fs";

function normalize(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const names: string[] = JSON.parse(
  fs.readFileSync("missing-final.json", "utf8")
);

const unique = new Set(
  names.map(normalize)
);

console.log({
  original: names.length,
  unique: unique.size,
});