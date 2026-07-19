import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://www.quanthockey.com/hockey-stats/en/profile.php?player=33575",
    {
      waitUntil: "networkidle",
      timeout: 60000,
    }
  );

  const text = await page.locator("body").innerText();

  console.log(text);

  await page.waitForTimeout(5000);

  await browser.close();
}

main().catch(console.error);