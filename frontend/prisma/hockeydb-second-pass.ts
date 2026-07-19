import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

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
      id: true,
      name: true,
    },
  });

  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();

  const protocol = "https";
  const host = "www.hockeydb.com";

  let updated = 0;

  for (const player of players) {
    try {
      const surname =
        player.name.split(" ").pop() ||
        player.name;

      const searchUrl =
        protocol +
        "://" +
        host +
        "/ihdb/stats/find_player.php?full_name=" +
        encodeURIComponent(surname);

      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      const links = await page.evaluate(() => {
        return Array.from(
          document.querySelectorAll(
            'a[href*="pdisplay.php?pid="]'
          )
        ).map(link => ({
          text:
            link.textContent?.trim() || "",
          href:
            (link as HTMLAnchorElement)
              .href,
        }));
      });

      const exactLink = links.find(
        link =>
          normalize(link.text) ===
          normalize(player.name)
      );

      if (!exactLink) {
        continue;
      }

      await page.goto(exactLink.href, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      const text =
        await page
          .locator("body")
          .innerText();

      const shoots =
        text.match(
          /shoots\s+([LR])/i
        )?.[1] || null;

      const height =
        text.match(
          /Height\s+([0-9.]+)/i
        )?.[1] || null;

      const weight =
        text.match(
          /Weight\s+(\d+)/i
        )?.[1];

      if (
        !shoots &&
        !height &&
        !weight
      ) {
        continue;
      }

      await prisma.player.update({
        where: {
          id: player.id,
        },
        data: {
          shoots,
          height,
          weight: weight
            ? Number(weight)
            : null,
        },
      });

      updated++;

      console.log(
        `[${updated}] ${player.name}`
      );

    } catch {
      // ignore
    }
  }

  await browser.close();

  console.log({
    updated,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });