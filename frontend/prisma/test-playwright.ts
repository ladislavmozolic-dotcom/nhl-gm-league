import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://frozenpool.dobbersports.com/frozenpool_ahl_players.php",
    {
      waitUntil: "networkidle",
      timeout: 60000,
    }
  );

  const text = await page.locator("body").innerText();

  console.log(text.substring(0, 5000));

  await browser.close();
}

main().catch(console.error);