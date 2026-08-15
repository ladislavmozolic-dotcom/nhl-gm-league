import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  const ahlTables = [
    4, 11, 18, 25, 32, 39, 46, 53,
    60, 67, 74, 81, 88, 95, 102, 109,
    116, 123, 130, 137, 144, 151, 158, 165,
    172, 186, 193, 200, 207, 214, 221, 228
  ];

  const teams = await prisma.team.findMany({
    orderBy: {
      id: "asc",
    },
  });

  let imported = 0;

  for (let i = 0; i < ahlTables.length; i++) {
    const table = $("table").eq(ahlTables[i]);

    const team = teams[i];

    if (!team) {
      continue;
    }

    console.log(`TEAM: ${team.name}`);

    const rows = table.find("tr").toArray();

    for (const row of rows) {
      const cells = $(row)
        .find("td")
        .map((_, td) =>
          $(td)
            .text()
            .replace(/\s+/g, " ")
            .trim()
        )
        .get();

      if (cells.length !== 22) {
        continue;
      }

      const name = cells[0];

      if (
        !name ||
        name === "PLAYER" ||
        name === "Scratches"
      ) {
        continue;
      }

      const slug =
        (
          name +
          "-ahl-" +
          team.id
        )
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
const existingPlayer = await prisma.player.findFirst({
  where: {
    name,
    teamId: team.id,
  },
});

console.log(
  "CHECK:",
  name,
  existingPlayer ? "FOUND" : "NOT FOUND"
);
      let player;

if (existingPlayer) {
  player = await prisma.player.update({
    where: {
      id: existingPlayer.id,
    },
    data: {
      rosterType: "AHL",
      sourceType: "AHL_SKATER",
      overall: Number(cells[19]),
      age: Number(cells[20]),
      contractText: cells[21],
    },
  });

  console.log("UPDATED:", name);
} else {
  player = await prisma.player.create({
    data: {
      slug,
      name,
      position: cells[1],
      age: Number(cells[20]),
      overall: Number(cells[19]),
      contractText: cells[21],
      rosterType: "AHL",
      sourceType: "AHL_SKATER",
      teamId: team.id,
    },
  });

  console.log("CREATED:", name);
}

const existingRating =
  await prisma.skaterRating.findUnique({
    where: {
      playerId: player.id,
    },
  });

if (existingRating) {
  await prisma.skaterRating.update({
    where: {
      playerId: player.id,
    },
    data: {
      condition: Number(cells[2]),
      ck: Number(cells[3]),
      fg: Number(cells[4]),
      di: Number(cells[5]),
      sk: Number(cells[6]),
      st: Number(cells[7]),
      en: Number(cells[8]),
      du: Number(cells[9]),
      ph: Number(cells[10]),
      fo: Number(cells[11]),
      pa: Number(cells[12]),
      sc: Number(cells[13]),
      df: Number(cells[14]),
      ps: Number(cells[15]),
      ex: Number(cells[16]),
      ld: Number(cells[17]),
      mo: Number(cells[18]),
      overall: Number(cells[19]),
    },
  });
} else {
  await prisma.skaterRating.create({
    data: {
      playerId: player.id,
      condition: Number(cells[2]),
      ck: Number(cells[3]),
      fg: Number(cells[4]),
      di: Number(cells[5]),
      sk: Number(cells[6]),
      st: Number(cells[7]),
      en: Number(cells[8]),
      du: Number(cells[9]),
      ph: Number(cells[10]),
      fo: Number(cells[11]),
      pa: Number(cells[12]),
      sc: Number(cells[13]),
      df: Number(cells[14]),
      ps: Number(cells[15]),
      ex: Number(cells[16]),
      ld: Number(cells[17]),
      mo: Number(cells[18]),
      overall: Number(cells[19]),
    },
  });
}
      imported++;
    }
  }

  console.log("");
  console.log(`✅ AHL skaters imported: ${imported}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });