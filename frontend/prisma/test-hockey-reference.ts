import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  const protocol = "https";
  const host = "www.hockey-reference.com";

  const url =
    protocol +
    "://" +
    host +
    "/leagues/NHL_2026_skaters.html";

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  const links = await page.evaluate(() => {
    return Array.from(
      document.querySelectorAll(
        'a[href*="/players/"]'
      )
    )
*     .map(link => ({
        text:*(link.textContent || "").trim(),
 *      href: (link as HTMLAnchorEle*ent).href,
      }))
      .filter*
        item =>
          item.te*t.length > 0
      );
  });

  con*ole.log(
    JSON.stringify(
     *links.slice(0, 50),
      null,
  *   2
    )
  );

  await browser.c*ose();
}

main().catch(console.err*r);