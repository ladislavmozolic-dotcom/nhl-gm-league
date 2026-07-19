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

  const birthDate =
    text.match(
      /Date of birth\s+(\d{4}-\d{2}-\d{2})/i
    )?.[1];

  console.log("MATCH:");
  console.log(birthDate);

  await browser.close();
}

main().catch(console.error);