import { chromium } from "playwright";

async function main() {
  const playerName = "Ryan Carpenter";

  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  const surname =
    playerName.split(" ").pop()!;

  await page.goto(
    `https://www.hockeydb.com/ihdb/stats/find_player.php?full_name=${surname}`,
    {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    }
  );

  const links = await page.evaluate(() => {
    return Array.from(
      document.querySelectorAll(
        'a[href*="pdisplay.php?pid="]'
      )
    ).map(link => ({
      text: link.textContent?.trim(),
      href: (link as HTMLAnchorElement).href,
    }));
  });

  console.log(
    JSON.stringify(links, null, 2)
  );

  await browser.close();
}

main().catch(console.error);