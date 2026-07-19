import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://www.hockeydb.com/ihdb/stats/pdisplay.php?pid=132890",
    {
      waitUntil: "domcontentloaded",
    }
  );

  const images = await page.evaluate(() => {
    return Array.from(document.images).map(img => img.src);
  });

  console.log(
    images.filter(src =>
      src.includes("/photos/")
    )
  );

  await browser.close();
}

main().catch(console.error);