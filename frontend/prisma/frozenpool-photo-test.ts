import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://frozenpool.dobbersports.com/players/jakob-pelletier",
    {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    }
  );

  await page.waitForTimeout(3000);

  const images = await page.evaluate(() => {
    return Array.from(document.images).map(img => ({
      src: img.src,
      width: img.width,
      height: img.height,
    }));
  });

  console.log(
    JSON.stringify(images, null, 2)
  );

  await browser.close();
}

main().catch(console.error);