import { chromium } from "playwright";
import fs from "fs";

async function main() {
  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://frozenpool.dobbersports.com/frozenpool_ahl_stats.php",
    {
      waitUntil: "networkidle",
      timeout: 60000,
    }
  );

  fs.writeFileSync(
    "ahl-stats.html",
    await page.content()
  );

  console.log("saved");

  await browser.close();
}

main().catch(console.error);