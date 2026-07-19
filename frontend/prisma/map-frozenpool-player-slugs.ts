import axios from "axios";
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

      const match = data.match(
        /\/players\/([a-z0-9.\-]+)/i
      );

      if (!match) {
        continue;
      }

      await prisma.player.update({
        where: {
          id: player.id,
        },
        data: {
          frozenPoolPlayerSlug: match[1],
        },
      });

      updated++;

      console.log(
        `${player.name} -> ${match[1]}`
      );
    } catch {
      console.log(`FAILED: ${player.name}`);
    }
  }

  console.log(`UPDATED: ${updated}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
