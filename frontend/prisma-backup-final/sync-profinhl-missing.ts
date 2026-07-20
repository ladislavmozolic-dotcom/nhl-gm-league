import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const aliases: Record<string, string> = {
  "cam york": "cameron york",
  "josh norris": "joshua norris",
  "matt coronato": "matthew coronato",
  "will cuylle": "william cuylle",
  "will borgen": "william borgen",
  "mikey anderson": "michael anderson",
};

function normalize(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

async function getPlayerProfile(url: string) {
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

  console.log(
    `Players needing update: ${playersNeedingUpdate.length}`
  );

  const playerMap = new Map();

  for (const player of playersNeedingUpdate) {
    playerMap.set(
      normalize(player.name),
      player
    );
  }

  const roster = await axios.get(
    "https://profinhl.cz/PlayersRoster.php"
  );

  const $ = cheerio.load(roster.data);

  const links: string[] = [];

  $("a").each((_, el) => {
    const href = $(el).attr("href");

    if (
      href &&
      href.includes("PlayerReport.php?Player=")
    ) {
      links.push(
        `https://profinhl.cz/${href}`
      );
    }
  });

  console.log(
    `Profiles found: ${links.length}`
  );

  let updated = 0;

  for (const link of links) {
    try {
      const profile =
        await getPlayerProfile(link);

      if (!profile.name) {
        continue;
      }

      const normalizedProfileName =
        aliases[normalize(profile.name)] ??
        normalize(profile.name);

      const player =
        playerMap.get(
          normalizedProfileName
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
    } catch (error) {
      console.log(
        `FAILED: ${link}`
      );
    }
  }

  console.log({
    updated,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });