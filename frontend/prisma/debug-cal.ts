import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const player = await prisma.player.findFirst({
    where: {
      name: "Cal Burke",
    },
    select: {
      name: true,
      birthDate: true,
    },
  });

  if (!player) {
    console.log("Player not found");
    return;
  }

  console.log("PLAYER:");
  console.log(player);

  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  const protocol = "https";
  const host = "www.hockeydb.com";

  const surname =
    player.name.split(" ").pop() || "";

  const searchUrl =
    protocol +
    "://" +
    host +
    "/ihdb/stats/find_player.php?full_name=" +
    encodeURIComponent(surname);

  console.log("SEARCH:");
  console.log(searchUrl);

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
      text: link.textContent?.trim() || "",
      href: (link as HTMLAnchorElement).href,
    }));
  });

  console.log(
    `FOUND: ${links.length}`
  );

  for (const link of links) {
    console.log(link.text);
  }

  await browser.close();
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });