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

async function main() {
  const players = await prisma.player.findMany();

  const playerMap = new Map();

  for (const player of players) {
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

  let updated = 0;

  for (const link of links) {
    try {
      const { data } = await axios.get(link);

      const $profile = cheerio.load(data);

      let name = "";

      $profile("a").each((_, el) => {
        const href =
          $profile(el).attr("href");

        if (
          href &&
          href.includes("nhl.com/player")
        ) {
          name = $profile(el)
            .text()
            .trim();
        }
      });

      const text =
        $profile("body").text();

      const positionMatch =
        text.match(
          /Position:\s*([A-Z\/]+)/
        );

      if (*name || !positionMatch) {
        *ontinue;
      }

      const play*r =
        playerMap.get(
       *  normalize(name)
        );

    * if (!player) {
        continue;
*     }

      const positions =
  *     positionMatch[1];

      awai* prisma.player.update({
        wh*re: {
          id: player.id,
   *    },
        data: {
          p*sitions,
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