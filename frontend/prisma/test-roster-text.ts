import { chromium } from "playwright";
import fs from "fs";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://www.eliteprospects.com/team/88/providence-bruins/2025-2026",
    {
      waitUntil: "networkidle",
      timeout: 60000,
    }
  );

  await page.waitForTimeout(5000);

  const text = await page.locator("body").innerText();

  fs.writeFileSync("providence-roster.txt", text);

  console.log("saved");

  await browser.close();
}

main().catch(console.error);