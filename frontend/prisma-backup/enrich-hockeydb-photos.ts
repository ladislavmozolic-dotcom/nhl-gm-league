import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      photoUrl: null,
    },
    take: 20,
    select: {
      id: true,
      name: true,
    },
  });

  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();

  let updated = 0;

  for (const player of players) {
    try {
      console.log(`SEARCHING: ${player.name}`);

      await page.goto(
        `https://www.hockeydb.com/ihdb/stats/find_player.php?full_name=${encodeURIComponent(
          player.name
        )}`,
        {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        }
      );

      const links = await page.evaluate(() => {
        return Array.from(
          document.querySelectorAll(
            'a[href*="pdisplay.php?pid="]'
          )
        ).map(link => ({
          text: (link.textContent || "").trim(),
          href: (link as HTMLAnchorElement).href,
        }));
      });

      if (!links.length) {
        console.log(`NO RESULTS: ${player.name}`);
        continue;
      }

      const profile = links[0];

      await page.goto(profile.href, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
await page.waitForTimeout(3000);

      console.log("PROFILE:", profile.href);

const html = await page.content();

console.log(
  html.includes("/ihdb/photos/")
);

const images = await page.evaluate(() => {
        return Array.from(document.images).map(img => ({
          src: img.src,
          width: img.width,
          height: img.height,
        }));
      });
console.log(
  JSON.stringify(images, null, 2)
);

      const photo = images.find(
        img =>
          img.src.includes("/ihdb/photos/") &&
          img.width > 100
      );

      if (!photo) {
        console.log(`NO PHOTO: ${player.name}`);
        continue;
      }

      await prisma.player.update({
        where: {
          id: player.id,
        },
        data: {
          photoUrl: photo.src,
        },
      });

      updated++;

      console.log(
        `[${updated}] PHOTO UPDATED: ${player.name}`
      );

      console.log(photo.src);
    } catch (err) {
      console.log(`FAILED: ${player.name}`);
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