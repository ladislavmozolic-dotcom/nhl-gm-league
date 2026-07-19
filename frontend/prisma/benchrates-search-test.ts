import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://benchrates.com/search?q=jakob-pelletier",
    {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    }
  );

  console.log("TITLE:");
  console.log(await page.title());

  console.log("URL:");
  console.log(page.url());

  const html = await page.content();

  console.log(
    html.substring(0, 3000)
  );

  await browser.close();
}

main().catch(console.error);
