import fs from "fs";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalize(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

async function main() {
  const dbPlayers = await prisma.player.findMany({
    select: {
      name: true,
    },
  });

  const dbSet = new Set(
    dbPlayers.map((p) => normalize(p.name))
  );

  const sourcePlayers = new Map<string, string>();

  // NHL
  const nhlLines = fs
    .readFileSync("./data/PlayersNHL.csv", "utf8")
    .split(/\r?\n/)
    .filter(Boolean);

  for (const line of nhlLines) {
    const cols = line.split(";");

    if (cols.length < 2) continue;

    const name = cols[1]?.trim();

    if (!name) continue;

    sourcePlayers.set(
      normalize(name),
      name
    );
  }

  // AHL
  const ahlCsv = fs.readFileSync(
    "./data/PlayersAHL.csv",
    "utf8"
  );

  const ahlRows = parse(ahlCsv, {
    columns: true,
    delimiter: ";",
    skip_empty_lines: true,
  });

  for (const row of ahlRows as any[]) {
    const name = row.Name?.trim();

    if (!name) continue;

    const key = normalize(name);

    if (!sourcePlayers.has(key)) {
      sourcePlayers.set(key, name);
    }
  }

  const missingPlayers: string[] = [];

  for (const [key, name] of sourcePlayers) {
    if (!dbSet.has(key)) {
      missingPlayers.push(name);
    }
  }

  fs.writeFileSync(
    "missing-final.json",
    JSON.stringify(
      missingPlayers.sort(),
      null,
      2
    )
  );

  console.log({
    csvPlayers: sourcePlayers.size,
    dbPlayers: dbPlayers.length,
    missingPlayers: missingPlayers.length,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });