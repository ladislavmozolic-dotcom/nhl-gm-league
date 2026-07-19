import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://www.hockeydb.com/ihdb/stats/find_player.php?full_name=tomasino",
    {
      waitUntil: "domcontentloaded",
    }
  );

  const text = await page.locator("body").innerText();

  console.log(text.substring(0, 3000));

  const links = await page
    .locator('a[href*="pdisplay.php?pid="]')
    .evaluateAll(nodes =>
      nodes.map(n => ({
        text: n.textContent,
        href: (n as HTMLAnchorElement).href,
      }))
    );

  console.log(links);

  await browser.close();
}

main().catch(console.error);