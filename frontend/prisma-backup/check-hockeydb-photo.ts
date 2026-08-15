import { chromium } from   const browser = await chromium.launch({
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
    return Array.from(document.images).map(
      img => ({
        src: img.src,
        width: img.width,
        height: img.height,
      })
    );
  });

  console.log(
    JSON.stringify(images, null, 2)
  );

  await browser.close();
}

main().catch(console.error);