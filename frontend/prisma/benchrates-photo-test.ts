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

  const images = await page.evaluate(() => {
    return Array.from(document.images).map(img => ({
      src: img.src,
      width: img.width,
      height: img.height,
    }));
  });

  const playerImages = images.filter(img =>
    img.src.includes("playerprofileimages")
  );

  console.log(
    JSON.stringify(playerImages, null, 2)
  );

  await browser.close();
}

main().catch(console.error);