import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://www.quanthockey.com/hockey-stats/en/profile.php?player=59291",
    {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    }
  );

  await page.waitForTimeout(3000);

  const text = await page.locator("body").innerText();

  const born =
    text.match(
      /Born on:\s*([^\n]+)/i
    )?.[1];

  const shoots =
    text.match(
      /shoots\s+(left|right)/i
    )?.[1];

  const height =
    text.match(
      /(\d+\s*'\s*\d+")/
    )?.[1];

  const weight =
    text.match(
      /(\d+)\s*lb/i
    )?.[1];

  console.log({
    born,
    shoots,
    height,
    weight,
  });

  await browser.close();
}

main().catch(console.error);