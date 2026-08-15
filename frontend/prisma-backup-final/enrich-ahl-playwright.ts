import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  page.on("request", req => {
    if (
      req.url().includes("search") ||
      req.url().includes("player") ||
      req.url().includes("suggest")
    ) {
      console.log(req.url());
    }
  });

  await page.goto("https://www.quanthockey.com/");

  await page.pause();
}

main();