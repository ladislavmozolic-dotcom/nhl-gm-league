import { chromium } from "playwright";
import fs from "fs";

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

  await page.screenshot({
    path: "tj-tynan.png",
    fullPage: true,
  });

  const html = await page.content();

  fs.writeFileSync(
    "tj-tynan.html",
    html
  );

  console.log("saved");

  await browser.close();
}

main().catch(console.error);