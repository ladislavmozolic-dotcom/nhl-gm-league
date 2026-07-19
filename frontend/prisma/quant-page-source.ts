import { chromium } from "playwright";
import fs from "fs";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://www.quanthockey.com/",
    {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    }
  );

  const html = await page.content();

  fs.writeFileSync(
    "quant-home.html",
    html
  );

  console.log("SAVED");
}

main().catch(console.error);