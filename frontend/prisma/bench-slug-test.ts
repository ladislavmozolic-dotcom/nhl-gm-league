import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://benchrates.com/player/4287/wyatt-aamodt/power-score",
    {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    }
  );

  const title = await page.title();

  console.log(title);

  const url = page.url();

  console.log(url);

  await browser.close();
}

main().catch(console.error);