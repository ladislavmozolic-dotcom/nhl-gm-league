import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://www.eliteprospects.com/team/88/providence-bruins",
    {
      waitUntil: "networkidle",
      timeout: 60000,
    }
  );

  const links = await page.locator("a").evaluateAll((els) =>
    els.map((e: any) => ({
      text: e.textContent?.trim(),
      href: e.href,
    }))
  );

  console.log(
    JSON.stringify(
      links.filter(
        (l: any) =>
          l.href?.includes("/team/88/")
      ),
      null,
      2
    )
  );

  await browser.close();
}

main().catch(console.error);