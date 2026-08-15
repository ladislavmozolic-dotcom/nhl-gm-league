import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      frozenPoolId: {
        not: null,
      },
    },
  });

  let updated = 0;

  for (const player of players) {
    try {
      const url = `https://frozenpool.dobbersports.com/players/${player.slug}`;

      const { data } = await axios.get(url);

      const $ = cheerio.load(data);

      const shoots =
        $("#profile_shoots").text().trim() || null;

      const height =
        $("#profile_height").text().trim() || null;

      const weightText =
        $("#profile_weight").text().trim();

      const weight = weightText
        ? Number(weightText)
        : null;

      const birthDate =
        data.match(
          /Birth Date<\/td>\s*<td>(\d{4}-\d{2}-\d{2})/i
        )?.[1] ?? null;

      const country =
        data.match(
          /Country<\/td>\s*<td>([A-Z]{3})/i
        )?.[1] ?? null;

      await prisma.player.update({
        where: {
          id: player.id,
        },
        data: {
          birthDate,
          shoots,
          height,
          weight,
          nationality: country,
        },
      });

      updated++;

      console.log(
        `[${updated}/${players.length}] ${player.name}`
      );
    } catch (err) {
      console.log(
        `FAILED: ${player.name}`
      );
    }
  }

  console.log(`DONE: ${updated}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });