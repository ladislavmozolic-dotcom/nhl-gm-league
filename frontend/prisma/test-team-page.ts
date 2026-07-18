import { chromium } from "playwright";
import fs from "fs";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://www.eliteprospects.com/team/88/providence-bruins",
    {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    }
  );

  console.log(await page.title());

  fs.writeFileSync(
    "providence.html",
    await page.content()
  );

  await browser.close();
}

main().catch(console.error);