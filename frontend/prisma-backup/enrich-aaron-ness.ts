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
    headless: true,
  });

  const page = await browser.newPage();

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

  const position =
    text.match(
      /Position\s+([A-Z]{1,2})/i
    )?.[1];

  console.log({
    player: player.name,
    birthDate,
    position,
  });

  if (birthDate) {
    await prisma.player.update({
      where: {
        id: player.id,
      },
      data: {
        birthDate: new Date(birthDate),
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