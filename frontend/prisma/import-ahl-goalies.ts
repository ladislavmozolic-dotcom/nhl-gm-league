import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  const ahlGoalieTables = [
    5, 12, 19, 26, 33, 40, 47, 54,
    61, 68, 75, 82, 89, 96, 103, 110,
    117, 124, 131, 138, 145, 152, 159, 166,
    173, 187, 194, 201, 208, 215, 222, 229
  ];

  const teams = await prisma.team.findMany({
    orderBy: {
      id: "asc",
    },
  });

  let imported = 0;

  for (let i = 0; i < ahlGoalieTables.length; i++) {
    const table = $("table").eq(ahlGoalieTables[i]);

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

      if (cells.length !== 20) {
        continue;
      }

      const name = cells[0];

      if (
        !name ||
        name === "GOALIE" ||
        name === "Scratches"
      ) {
        continue;
      }

      const slug =
        (
          name +
          "-ahl-g-" +
          team.id
        )
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

      const player = await prisma.player.create({
        data: {
          slug,
          name,

          position: "G",

          age: Number(cells[18]),

          overall: Number(cells[17]),

          contractText: cells[19],

          rosterType: "AHL",
          sourceType: "AHL_GOALIE",

          isGoalie: true,

          teamId: team.id,
        },
      });

      await prisma.goalieRating.create({
        data: {
          playerId: player.id,

          condition: Number(cells[2]),

          sk: Number(cells[3]),
          du: Number(cells[4]),
          en: Number(cells[5]),

          sz: Number(cells[6]),
          ag: Number(cells[7]),
          rb: Number(cells[8]),
          sc: Number(cells[9]),
          hs: Number(cells[10]),
          rt: Number(cells[11]),

          ph: Number(cells[12]),
          ps: Number(cells[13]),

          ex: Number(cells[14]),
          ld: Number(cells[15]),
          mo: Number(cells[16]),

          overall: Number(cells[17]),
        },
      });

      imported++;
    }
  }

  console.log("");
  console.log(`✅ AHL goalies imported: ${imported}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });