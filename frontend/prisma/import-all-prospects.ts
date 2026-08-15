import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  const prospectTables = [
    6, 13, 20, 27, 34, 41, 48, 55,
    62, 69, 76, 83, 90, 97, 104, 111,
    118, 125, 132, 139, 146, 153, 160, 167,
    174, 188, 195, 202, 209, 216, 223, 230
  ];

  const teams = await prisma.team.findMany({
    orderBy: {
      id: "asc",
    },
  });

  let imported = 0;

  for (let i = 0; i < prospectTables.length; i++) {
    const table = $("table").eq(prospectTables[i]);

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

      if (cells.length !== 3) {
        continue;
      }

      const name = cells[0];

      if (!name) {
        continue;
      }

      await prisma.prospect.create({
        data: {
          name,

          draftYear:
            cells[1] !== ""
              ? Number(cells[1])
              : null,

          overallPick:
            cells[2] !== ""
              ? Number(cells[2])
              : null,

          teamId: team.id,
        },
      });

      imported++;
    }
  }

  console.log("");
  console.log(
    `✅ Prospects imported: ${imported}`
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });