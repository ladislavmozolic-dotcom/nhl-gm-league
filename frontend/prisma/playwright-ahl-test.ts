import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5540",
    {
      waitUntil: "networkidle",
    }
  );

  const content = await page.content();

  console.log(
    content.includes("Birth Date")
  );

  console.log(
    content.includes("Country")
  );

  await browser.close();
}

main().catch(console.error);