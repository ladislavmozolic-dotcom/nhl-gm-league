import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  const nhlTables = [1, 8, 15, 22, 29, 36, 43, 50, 57, 64, 71, 78, 85, 92, 99, 106, 113, 120, 127, 134, 141, 148, 155, 162, 169, 183, 190, 197, 204, 211, 218, 225];

  let importedTeams = 0;
  let importedPlayers = 0;

  for (const tableIndex of nhlTables) {
    const table = $("table").eq(tableIndex);

    const text = table.text()
      .replace(/\s+/g, " ")
      .trim();

    const teamName = text.split("PLAYER")[0].trim();

    const team = await prisma.team.create({
      data: {
        name: teamName,
        profinhlName: teamName,
        slug: teamName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
        gm: "Unknown",
        arena: "Unknown",
        league: "NHL",
      },
    });

    importedTeams++;

    console.log(`TEAM: ${teamName}`);

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

      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      await prisma.player.create({
        data: {
          slug,
          name,

          position: cells[1],

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
          age: Number(cells[20]),

          contractText: cells[21],

          rosterType: "NHL",

          teamId: team.id,
        },
      });

      importedPlayers++;
    }
  }

  console.log("");
  console.log(`✅ Teams: ${importedTeams}`);
  console.log(`✅ Players: ${importedPlayers}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });