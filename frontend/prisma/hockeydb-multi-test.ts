import { chromium } from "playwright";

const players = [
  {
    name: "Aaron Ness",
    pid: 113811,
  },
  {
    name: "Benoit-Olivier Groulx",
    pid: 195937,
  },
  {
    name: "Cameron Hebig",
    pid: 170204,
  },
];

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  for (const player of players) {
    await page.goto(
      `https://www.hockeydb.com/ihdb/stats/pdisplay.php?pid=${player.pid}`,
      {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      }
    );

    const text = await page.locator("body").innerText();

    const shoots =
      text.match(/shoots\s+([LR])/i)?.[1];

    const height =
      text.match(/Height\s+([0-9.]+)/i)?.[1];

    const weight =
      text.match(/Weight\s+(\d+)/i)?.[1];

    console.log({
      player: player.name,
      shoots,
      height,
      weight,
    });
  }

  await browser.close();
}

main().catch(console.error);