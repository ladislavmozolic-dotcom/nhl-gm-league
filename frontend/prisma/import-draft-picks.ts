import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const draftTables = [
  7, 14, 21, 28, 35, 42, 49, 56,
  63, 70, 77, 84, 91, 98, 105, 112,
  119, 126, 133, 140, 147, 154, 161, 168,
  175, 189, 196, 203, 210, 217, 224, 231
];

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  const teams = await prisma.team.findMany({
    orderBy: {
      profinhlLogoId: "asc",
    },
  });

  let imported = 0;

  for (let t = 0; t < draftTables.length; t++) {
    const team = teams[t];

    if (!team) continue;

    const table = $("table").eq(draftTables[t]);

    const rows = table.find("tr").toArray();

    for (let r = 1; r < rows.length; r++) {
      const cells = $(rows[r]).find("td").toArray();

      if (cells.length < 8) continue;

      const year = Number(
        $(cells[0]).text().trim()
      );

      if (!year) continue;

      for (let round = 1; round <= 7; round++) {
        const logos = $(cells[round])
          .find("img")
          .map((_, img) => {
            const src =
              $(img).attr("src") || "";

            const match =
              src.match(/\/(\d+)\.png$/);

            return match
              ? Number(match[1])
              : null;
          })
          .get()
          .filter(Boolean);

        for (const ownerLogoId of logos) {
          await prisma.draftPick.create({
            data: {
              year,
              round,
              ownerLogoId,
              teamId: team.id,
            },
          });

          imported++;
        }
      }
    }
  }

  console.log(
    `✅ Draft picks imported: ${imported}`
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });