import fs from "fs";

const text = fs.readFileSync(
  "providence-roster.txt",
  "utf8"
);

const lines = text.split("\n");

for (const line of lines) {
  if (
    /\((C|LW|RW|D|G|C\/LW|LW\/RW|RW\/LW|C\/RW)\)/i.test(
      line
    )
  ) {
    console.log(line.trim());
  }
}