import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      birthDate: null,
      frozenPoolId: {
        not: null,
      },
    },
    select: {
      id: true,
      name: true,
      frozenPoolId: true,
    },
  });

  console.log(`Players to process: ${players.length}`);

  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();

  let updated = 0;

  for (const player of players) {
    try {
      await page.goto(
        `https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=${player.frozenPoolId}`,
        {
          waitUntil: "networkidle",
        }
      );

      const text = await page.locator("body").innerText();

      const birthDate =
        text.match(
          /Date of birth\s+(\d{4}-\d{2}-\d{2})/i
        )?.[1];

      if (!birthDate) {
        console.log(`NO DOB: ${player.name}`);
        continue;
      }

      await prisma.player.update({
        where: {
          id: player.id,
        },
        data: {
          birthDate,
        },
      });

      updated++;

      console.log(
        `[${updated}] ${player.name} -> ${birthDate}`
      );
    } catch (error) {
      console.log(`FAILED: ${player.name}`);
      console.error(error);
    }
  }

  await browser.close();

  console.log(`UPDATED: ${updated}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });