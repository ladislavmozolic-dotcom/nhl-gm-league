import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  page.on("response", async (response) => {
    const url = response.url();

    if (
      url.includes("5540") ||
      url.includes("player") ||
      url.includes("ajax")
    ) {
      console.log(url);
    }
  });

  await page.goto(
    "https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5540",
    {
      waitUntil: "networkidle",
    }
  );

  await page.waitForTimeout(10000);

  await browser.close();
}

main().catch(console.error);