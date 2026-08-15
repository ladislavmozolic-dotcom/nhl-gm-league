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
      const url =
        `https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=${player.frozenPoolId}`;

      const { data } = await axios.get(url);

      const $ = cheerio.load(data);

      const text = $("body").text();

      const birthDate =
        text.match(/Birth Date\s+([0-9\-]+)/)?.[1] ?? null;

      const shoots =
        text.match(/Shoots\s+([LR])/i)?.[1] ?? null;

      const height =
        text.match(/Height\s+([0-9']+)/)?.[1] ?? null;

      const weight =
        text.match(/Weight\s+([0-9]+)/)?.[1] ?? null;

      const country =
        text.match(/Country\s+([A-Z]{3})/)?.[1] ?? null;

      await prisma.player.update({
        where: {
          id: player.id,
        },
        data: {
          birthDate,
          shoots,
          height,
          weight: weight ? Number(weight) : null,
          nationality: country,
        },
      });

      updated++;

      console.log(
        `[${updated}/${players.length}] ${player.name}`
      );
    } catch {
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