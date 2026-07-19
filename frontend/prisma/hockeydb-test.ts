import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://www.hockeydb.com/ihdb/stats/pdisplay.php?pid=123417",
    {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    }
  );

  const text = await page.locator("body").innerText();

  console.log(
    text.substring(0, 1500)
  );

  await browser.close();
}

main().catch(console.error);