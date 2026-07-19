import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5540",
    {
      waitUntil: "networkidle",
    }
  );

  await page.waitForTimeout(5000);

  const bodyText = await page.locator("body").innerText();

  console.log(
    bodyText.includes("Birth Date")
  );

  console.log(
    bodyText.includes("1992-02-25")
  );

  console.log(
    bodyText.substring(
      bodyText.indexOf("Birth Date") - 100,
      bodyText.indexOf("Birth Date") + 500
    )
  );

  await browser.close();
}

main().catch(console.error);