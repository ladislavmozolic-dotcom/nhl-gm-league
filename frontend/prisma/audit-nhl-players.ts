import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import * as fs from "fs";

const prisma = new PrismaClient();

function normalize(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

async function main() {
  const workbook = XLSX.readFile("data/PlayersNHL.xlsx");


  const sheet = workbook.Sheets[
    workbook.SheetNames[0]
  ];

  const rows: any[] =
    XLSX.utils.sheet_to_json(sheet, {
      header: 1,
    });

  const players = await prisma.player.findMany({
    select: {
      id: true,
      name: true,
      nhlId: true,
    },
  });

  const dbMap = new Map();

  for (const player of players) {
    dbMap.set(
      normalize(player.name),
      player
    );
  }

  const missingPlayers: any[] = [];
  const playersWithoutNhlId: any[] = [];

  for (const row of rows) {
    const name = row[1];

    if (
      !name ||
      typeof name !== "string"
    ) {
      continue;
    }

    const match = dbMap.get(
      normalize(name)
    );

    if (!match) {
      missingPlayers.push({
        name,
      });

      continue;
    }

    if (!match.nhlId) {
      playersWithoutNhlId.push({
        name,
        dbName: match.name,
      });
    }
  }

  fs.writeFileSync(
    "missing-nhl-players.json",
    JSON.stringify(
      missingPlayers,
      null,
      2
    )
  );

  fs.writeFileSync(
    "nhl-players-without-nhlid.json",
    JSON.stringify(
      playersWithoutNhlId,
      null,
      2
    )
  );

  console.log({
    missingPlayers:
      missingPlayers.length,
    playersWithoutNhlId:
      playersWithoutNhlId.length,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });