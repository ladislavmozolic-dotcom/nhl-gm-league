import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalize(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

async function getGoalieProfile(url: string) {
  const { data } = await axios.get(url);

  const $ = cheerio.load(data);
  const text = $("body").text();

  let name = "";

  $("a").each((_, el) => {
    const href = $(el).attr("href");

    if (
      href &&
      href.includes("nhl.com/player")
    ) {
      name = $(el).text().trim();
    }
  });

  const dobMatch = text.match(
    /Date of Birth:\s*([A-Za-z]+\s+\d{2},\s+\d{4})/
  );

  const heightMatch = text.match(
    /Height:\s*(\d+)\s*cm/
  );

  const weightMatch = text.match(
    /Weight:\s*(\d+)\s*kg/
  );

  const nhlMatch = data.match(
    /nhl\.com\/player\/(\d+)/
  );

  return {
    name,
    birthDate: dobMatch?.[1] ?? null,
    height: heightMatch?.[1]
      ? `${heightMatch[1]} cm`
      : null,
    weight: weightMatch?.[1]
      ? parseInt(weightMatch[1], 10)
      : null,
    nhlId: nhlMatch?.[1]
      ? parseInt(nhlMatch[1], 10)
      : null,
  };
}

async function main() {
  const playersNeedingUpdate =
    await prisma.player.findMany({
      where: {
        OR: [
          { birthDate: null },
          { height: null },
          { weight: null },
          { nhlId: null },
        ],
      },
    });

  const playerMap = new Map();

  for (const player of playersNeedingUpdate) {
    playerMap.set(
      normalize(player.name),
      player
    );
  }

  const roster = await axios.get(
    "https://profinhl.cz/GoaliesRoster.php"
  );

  const $ = cheerio.load(roster.data);

  const links: string[] = [];

  $("a").each((_, el) => {
    const href = $(el).attr("href");

    if (
      href &&
      href.includes("GoalieReport.php?Goalie=")
    ) {
      links.push(
        `https://profinhl.cz/${href}`
      );
    }
  });

  console.log(
    `Goalie profiles found: ${links.length}`
  );

  let updated = 0;

  for (const link of links) {
    try {
      const profile =
        await getGoalieProfile(link);

      if (!profile.name) {
        continue;
      }

      const player = playerMap.get(
        normalize(profile.name)
      );

      if (!player) {
        continue;
      }

      await prisma.player.update({
        where: {
          id: player.id,
        },
        data: {
          birthDate:
            player.birthDate ||
            profile.birthDate,

          height:
            player.height ||
            profile.height,

          weight:
            player.weight ||
            profile.weight,

          nhlId:
            player.nhlId ||
            profile.nhlId,
        },
      });

      updated++;

      console.log(
        `[${updated}] ${player.name}`
      );

    } catch {
      console.log(
        `FAILED: ${link}`
      );
    }
  }

  console.log({ updated });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });