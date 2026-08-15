import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  // Buffalo Sabres tabuľka
  const table = $("table").eq(15);

  const existingTeam = await prisma.team.findFirst({
    where: {
      name: "Buffalo Sabres",
    },
  });

  let team;

  if (existingTeam) {
    team = existingTeam;
  } else {
    team = await prisma.team.create({
      data: {
        name: "Buffalo Sabres",
        slug: "buffalo-sabres",
        code: "BUF",
        gm: "Unknown",
        arena: "Unknown",
        league: "NHL",
      },
    });
  }

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

    // hráčske riadky majú presne 22 stĺpcov
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

    const existingPlayer =
      await prisma.player.findFirst({
        where: {
          slug,
        },
      });

    if (existingPlayer) {
      continue;
    }

    await prisma.player.create({
      data: {
        slug,
        name,
        position: cells[1],
        age: Number(cells[20]),
        overall: Number(cells[19]),
        contractText: cells[21],
        rosterType: "NHL",
        teamId: team.id,
      },
    });

    imported++;

    console.log(
      `Imported: ${name}`
    );
  }

  console.log("");
  console.log(
    `✅ Imported players: ${imported}`
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });