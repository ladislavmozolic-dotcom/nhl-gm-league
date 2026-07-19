import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const player = await prisma.player.findFirst({
    where: {
      name: "Phil Tomasino",
    },
  });

  if (!player) {
    console.log("Player not found");
    return;
  }

  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://www.hockeydb.com/ihdb/stats/pdisplay.php?pid=208686",
    {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    }
  );

  const images = await page.evaluate(() => {
    return Array.from(document.images).map(img => ({
      src: img.src,
    }));
  });

  const photo = images.find(img =>
    img.src.includes("/ihdb/photos/")
  );

  console.log(photo);

  if (photo) {
    await prisma.player.update({
      where: {
        id: player.id,
      },
      data: {
        photoUrl: photo.src,
      },
    });

    console.log("UPDATED");
  }

  await browser.close();
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });