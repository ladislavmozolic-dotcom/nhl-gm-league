import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalize(name: string) {
  let normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "");

  const aliases: Record<string, string> = {
    "zach lheureux": "zachary lheureux",
    "cam york": "cameron york",
    "josh norris": "joshua norris",
    "matt coronato": "matthew coronato",
    "will borgen": "william borgen",
    "will cuylle": "william cuylle",
    "mikey anderson": "michael anderson",
    "ben kindel": "benjamin kindel",
  };

  return aliases[normalized] ?? normalized;
}


async function main() {
  const players = await prisma.player.findMany();

 const playerMap = new Map();
const nhlIdMap = new Map();

for (const player of players) {

  playerMap.set(
    normalize(player.name),
    player
  );

  if (player.nhlId) {
    nhlIdMap.set(
      player.nhlId,
      player
    );
  }
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

  let updated = 0;

  for (const link of links) {
    try {
      const { data } = await axios.get(link);

      const $profile = cheerio.load(data);

      let name = "";
let nhlId: number | null = null;

     $profile("a").each((_, el) => {

  const href =
    $profile(el).attr("href");

  if (
    href &&
    href.includes("nhl.com/player")
  ) {

    name = $profile(el)
      .text()
      .replace(/''.*?''/g, "")
      .replace(/\(.*?\)/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const match =
      href.match(/player\/(\d+)/);

    if (match) {
      nhlId =
        parseInt(match[1], 10);
    }
  }
});

      const text =
        $profile("body").text();

      const positionMatch =
        text.match(
          /Position:\s*([A-Z\/]+)/
        );

      if (!name || !positionMatch) {
        continue;
      }

      let player = null;

if (nhlId) {
  player =
    nhlIdMap.get(nhlId);
}

if (!player) {
  player =
    playerMap.get(
      normalize(name)
    );
}

if (!player) {
  continue;
}

      const positions =
        positionMatch[1];

      await prisma.player.update({
        where: {
          id: player.id,
        },
        data: {
          positions,
        },
      });

      updated++;

      console.log(
        `${player.name} -> ${positions}`
      );

    } catch {}
  }

  console.log({ updated });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });