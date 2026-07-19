import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const player = await prisma.player.findFirst({
    where: {
      frozenPoolId: 4026,
    },
  });

  if (!player) {
    console.log("Player not found");
    return;
  }

  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://www.quanthockey.com/hockey-stats/en/profile.php?player=9522",
    {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    }
  );

  await page.waitForTimeout(3000);

  const text = await page.locator("body").innerText();

  const shoots =
    text.match(/shoots\s+(left|right)/i)?.[1];

  const weight =
    text.match(/(\d+)\s*lb/i)?.[1];

  const height =
    text.match(/(\d+\s*'\s*\d+")/)?.[1];

  console.log({
    shoots,
    weight,
    height,
  });

  await prisma.player.update({
    where: {
      id: player.id,
    },
    data: {
      shoots,
      weight: Number(weight),
      height,
    },
  });

  console.log("UPDATED");

  await browser.close();
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });