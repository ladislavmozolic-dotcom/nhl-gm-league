import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/*
  Sem budeš postupne pridávať mapovanie:
  meno -> HockeyDB pid
*/

const hockeyDbMap: Record<string, number> = {
  "Aaron Ness": 113811,
  "Benoit-olivier Groulx": 195937,
  "Cameron Hebig": 170204,
  "T.j. Tynan": 123417,


};

async function main() {
  const players = await prisma.player.findMany({
    where: {
      OR: [
        { height: null },
        { weight: null },
        { shoots: null },
      ],
    },
    take: 10,
  });

  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();

  let updated = 0;

  for (const player of players) {
    const pid = hockeyDbMap[player.name];

    if (!pid) {
      console.log(`NO PID: ${player.name}`);
      continue;
    }

    try {
      await page.goto(
        `https://www.hockeydb.com/ihdb/stats/pdisplay.php?pid=${pid}`,
        {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        }
      );

      const text = await page.locator("body").innerText();

console.log("==========");
console.log(player.name);
console.log(text.substring(0, 1000));
console.log("==========");


      const shoots =
        text.match(/shoots\s+([LR])/i)?.[1];

      const height =
        text.match(/Height\s+([0-9.]+)/i)?.[1];

      const weight =
        text.match(/Weight\s+(\d+)/i)?.[1];

      console.log({
        player: player.name,
        shoots,
        height,
        weight,
      });


if (!shoots || !height || !weight) {
  console.log(`SKIPPED: ${player.name}`);
  continue;
}
      

await prisma.player.update({
        where: {
          id: player.id,
        },
        data: {
          shoots,
          height,
          weight: weight ? Number(weight) : null,
        },
      });

      updated++;

      console.log(
        `[${updated}] UPDATED ${player.name}`
      );
    } catch (err) {
      console.error(
        `FAILED: ${player.name}`
      );
    }
  }

  await browser.close();

  console.log(`UPDATED TOTAL: ${updated}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });