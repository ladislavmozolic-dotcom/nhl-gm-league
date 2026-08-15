import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  const table = $("table").eq(15);

  const team = await prisma.team.findFirst({
    where: {
      name: "Buffalo Sabres",
    },
  });

  if (!team) {
    throw new Error(
      "Buffalo Sabres team not found"
    );
  }

  const rows = table.find("tr").toArray();

  let updated = 0;

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

    await prisma.player.updateMany({
      where: {
        slug,
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
      },
    });

    updated++;

    console.log(`Updated: ${name}`);
  }

  console.log("");
  console.log(`✅ Updated ratings: ${updated}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });