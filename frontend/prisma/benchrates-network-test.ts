import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  page.on("response", async response => {
    const url = response.url();

    if (
      url.includes("search") ||
      url.includes("player") ||
      url.includes("api")
    ) {
      console.log(url);
    }
  });

  await page.goto(
    "https://benchrates.com/search?q=jakob-pelletier",
    {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    }
  );

  console.log("Page loaded");
}

main().catch(console.error);