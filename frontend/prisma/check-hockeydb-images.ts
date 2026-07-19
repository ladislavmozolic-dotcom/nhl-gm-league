import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://www.hockeydb.com/ihdb/stats/pdisplay.php?pid=208686",
    {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    }
  );

  const images = await page.evaluate(() => {
    return Array.from(document.images).map(img => ({
      src: img.src,
      width: img.width,
      height: img.height,
    }));
  });

  const playerImages = images.filter(img =>
  img.src.includes("/ihdb/photos/")
);

console.log(
  JSON.stringify(playerImages, null, 2)
);

  await browser.close();
}

main().catch(console.error);