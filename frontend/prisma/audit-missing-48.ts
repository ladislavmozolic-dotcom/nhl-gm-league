import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      OR: [
        { height: null },
        { weight: null },
        { shoots: null },
      ],
    },
    select: {
      name: true,
      birthDate: true,
    },
  });

  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();

  const protocol = "https";
  const host = "www.hockeydb.com";

  for (const player of players) {
    const surname =
      player.name.split(" ").pop() ||
      player.name;

    const searchUrl =
      protocol +
      "://" +
      host +
      "/ihdb/stats/find_player.php?full_name=" +
      encodeURIComponent(surname);

    try {
      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      const links =
        await page.evaluate(() => {
          return Array.from(
            document.querySelectorAll(
              'a[href*="pdisplay.php?pid="]'
            )
          ).map(link => ({
            text:
              link.textContent?.trim() || "",
          }));
        });

      console.log(
        `${player.name} | DOB=${player.birthDate} | FOUND=${links.length}`
      );
    } catch {
      console.log(
        `${player.name} | ERROR`
      );
    }
  }

  await browser.close();
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });