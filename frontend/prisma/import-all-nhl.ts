import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  let currentTeamId: number | null = null;
  let importedTeams = 0;
  let importedPlayers = 0;

  for (const table of $("table").toArray()) {
    const text = $(table)
      .text()
      .replace(/\s+/g, " ")
      .trim();

    const rows = $(table).find("tr");

    // hlavná NHL tabuľka tímu
    if (
      text.includes("PLAYER POS CON CK FG DI") &&
      !text.startsWith("PLAYER POS")
    ) {
      const firstCell = rows
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim();

      const teamName = firstCell
        .split("PLAYER")[0]
        .trim();

      if (
        teamName &&
        teamName.length > 3
      ) {
        const createdTeam =
          await prisma.team.create({
            data: {
              name: teamName,
              slug: teamName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, ""),
              gm: "Unknown",
              arena: "Unknown",
              league: "NHL",
            },
          });

        currentTeamId = createdTeam.id;

        importedTeams++;

        console.log(
          `TEAM: ${teamName}`
        );
      }

      rows.toArray().forEach(async (row) => {
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
          return;
        }

        const name = cells[0];

        if (
          !name ||
          name === "PLAYER" ||
          name === "Scratches"
        ) {
          return;
        }

        await prisma.player.create({
          data: {
            slug: name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, ""),
            name,
            position: cells[1],

            age: Number(cells[20]),
            overall: Number(cells[19]),

            contractText: cells[21],
            rosterType: "NHL",

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

            teamId: currentTeamId!,
          },
        });

        importedPlayers++;
      });
    }
  }

  console.log("");
  console.log(
    `✅ Teams: ${importedTeams}`
  );
  console.log(
    `✅ Players: ${importedPlayers}`
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });