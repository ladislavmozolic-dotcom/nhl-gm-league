import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://www.quanthockey.com/hockey-stats/en/profile.php?player=49248",
    {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    }
  );

  const text = await page.locator("body").innerText();

  console.log("URL:");
  console.log(page.url());

  console.log(text.substring(0, 1000));

  await browser.close();
}

main().catch(console.error);
main().catch(console.error);