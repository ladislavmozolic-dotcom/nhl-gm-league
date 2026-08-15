import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  let imported = 0;

  const tables = $("table").toArray();

  for (let i = 0; i < tables.length; i++) {
    const text = $(tables[i])
      .text()
      .replace(/\s+/g, " ")
      .trim();

    // hlavná NHL tabuľka tímu
    if (
      !text.includes("PLAYER POS CON CK FG DI") ||
      text.startsWith("PLAYER POS")
    ) {
      continue;
    }

    const teamName = text
      .split("PLAYER")[0]
      .trim();

    const team = await prisma.team.findFirst({
      where: {
        profinhlName: teamName,
      },
    });

    if (!team) {
      continue;
    }

    // NHL goalie tabuľka býva o 2 ďalej
    const goalieTable = tables[i + 2];

    if (!goalieTable) {
      continue;
    }

    const goalieText = $(goalieTable)
      .text()
      .replace(/\s+/g, " ")
      .trim();

    if (
      !goalieText.startsWith(
        "GOALIE POS CON SK DU EN SZ AG RB"
      )
    ) {
      continue;
    }

    console.log(`TEAM: ${teamName}`);

    const rows = $(goalieTable).find("tr").toArray();

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

      const existing =
        await prisma.player.findUnique({
          where: {
            slug,
          },
        });

      if (existing) {
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
          sourceType: "NHL_GOALIE",

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

      console.log(`  + ${name}`);
    }
  }

  console.log("");
  console.log(`✅ Goalies imported: ${imported}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });