import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  const protocol = "https";
  const host = "www.hockeydb.com";

  const url =
    protocol +
    "://" +
    host +
    "/ihdb/stats/pdisplay.php?pid=196276";

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  const text =
    await page.locator("body").innerText();

  console.log(text);
  
  await browser.close();
}

main().catch(console.error);