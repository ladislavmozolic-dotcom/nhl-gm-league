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

  console.log("READY");

  await page.pause();
}

main().catch(console.error);