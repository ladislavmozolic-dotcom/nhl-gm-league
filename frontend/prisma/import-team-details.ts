import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  for (let profinhlId = 1; profinhlId <= 32; profinhlId++) {
    const { data } = await axios.get(
      `https://profinhl.cz/ProTeam.php?Team=${profinhlId}`
    );

    const $ = cheerio.load(data);

    const links = $('a[href*="ProTeam.php?Team="]');

    let teamName = "";

    links.each((_, el) => {
      const href = $(el).attr("href");

      if (
        href === `ProTeam.php?Team=${profinhlId}`
      ) {
        const text = $(el).text().trim();

        if (text.length > teamName.length) {
          teamName = text;
        }
      }
    });

    if (!teamName) {
      console.log(
        `SKIPPED TEAM ${profinhlId}`
      );
      continue;
    }

    const rows = $("tr").toArray();

    let gm = "";
    let coach = "";
    let conference = "";
    let division = "";
    let arena = "";
    let capacity: number | null = null;

    for (const row of rows) {
      const tds = $(row)
        .find("td")
        .map((_, td) =>
          $(td)
            .text()
            .replace(/\s+/g, " ")
            .trim()
        )
        .get();

      if (tds.length < 2) continue;

      if (tds[0] === "General Manager" && tds[1]) {
        gm = tds[1];
      }

      if (tds[0] === "Head Coach" && tds[1].trim().length > 0) {
        coach = tds[1];
      }

      if (tds[0] === "Conference" && tds[1]) {
        conference = tds[1];
      }

      if (tds[0] === "Division" && tds[1]) {
        division = tds[1];
      }
      if (tds[0] === "Stadium" && tds[1]) {
        arena = tds[1];
      }

    if (tds[0] === "Capacity" && tds[1]) {
  const parsedCapacity = parseInt(
    tds[1].replace(/,/g, "").trim(),
    10
  );

  if (!Number.isNaN(parsedCapacity)) {
    capacity = parsedCapacity;
  }
}
}

const logoUrl =
  `https://profinhl.cz/images/LogoTeams/Pro/${profinhlId}.png`;

    const nhlTeam = await prisma.team.findFirst({
      where: {
        name: teamName.toUpperCase(),
        league: "NHL",
      },
    });

    if (!nhlTeam) {
      console.log(`NOT FOUND: ${teamName}`);
      continue;
    }

    console.log({
  teamName,
  arena,
  capacity,
});
    await prisma.team.update({
  where: {
    id: nhlTeam.id,
  },
  data: {
    gm,
    coach,
    conference,
    division,
    arena,
    capacity,
    logoUrl,
  },
});

    console.log({
      gm,
      coach,
      conference,
      division,
    });

    await prisma.team.updateMany({
      where: {
        parentTeamId: nhlTeam.id,
      },
      data: {
        gm,
        coach,
        conference,
        division,
        capacity,
    logoUrl,
      },
    });

    console.log(
      `UPDATED: ${teamName} | GM: ${gm}`
    );
  }

  console.log("");
  console.log("✅ Team details imported");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });