import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const team = await prisma.team.findFirst({
    where: {
      name: "ANAHEIM DUCKS",
    },
  });

  if (!team) {
    throw new Error("Anaheim not found");
  }

  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  const table = $("table").eq(6);

  const rows = table.find("tr").toArray();

  let imported = 0;

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

        draftYear: cells[1]
          ? Number(cells[1])
          : null,

        overallPick: cells[2]
          ? Number(cells[2])
          : null,

        teamId: team.id,
      },
    });

    imported++;
  }

  console.log(
    `✅ Prospects imported: ${imported}`
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });