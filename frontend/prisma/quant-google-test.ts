import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://www.quanthockey.com/",
    {
      waitUntil: "domcontentloaded",
    }
  );

  await page.waitForTimeout(3000);

  const html = await page.content();

  console.log(
    html.includes("Aaron Ness")
  );

  console.log(
    html.includes("player=")
  );

  await browser.close();
}

main().catch(console.error);