import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4026",
    {
      waitUntil: "networkidle",
    }
  );

  const text = await page.locator("body").innerText();

  console.log(text);

  await browser.close();
}

main().catch(console.error);