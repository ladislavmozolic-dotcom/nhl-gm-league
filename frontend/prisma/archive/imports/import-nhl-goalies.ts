import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  const goalieTables = [
    3, 10, 17, 24, 31, 38, 45, 52,
    59, 66, 73, 80, 87, 94, 101, 108,
    115, 122, 129, 136, 143, 150, 157, 164,
    171, 178, 185, 192, 199, 206, 213, 220
  ];

  let importedGoalies = 0;

  const teams = await prisma.team.findMany();

  for (let i = 0; i < goalieTables.length; i++) {
    const tableIndex = goalieTables[i];
    const table = $("table").eq(tableIndex);

    const team = teams[i];

    if (!team) {
      console.log(`Missing team index ${i}`);
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

      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const existingPlayer =
        await prisma.player.findUnique({
          where: {
            slug,
          },
        });

      if (existingPlayer) {
        continue;
      }

      const player = await prisma.player.create({
        data: {
          slug,
          name,

          position: "G",

          age: Number(cells[18]),

          overall: Number(cells[17]),

          contractText: cells[19],

          rosterType: "NHL",

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

      importedGoalies++;

      console.log(`  + ${name}`);
    }
  }

  console.log("");
  console.log(
    `✅ Goalies imported: ${importedGoalies}`
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });