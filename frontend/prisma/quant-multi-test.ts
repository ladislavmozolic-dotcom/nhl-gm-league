import { chromium } from "playwright";

const profiles = [
  {
    name: "Charle-Edouard D'Astous",
    id: 44048,
  },
  {
    name: "Cameron Hebig",
    id: 49248,
  },
  {
    name: "Benoit-Olivier Groulx",
    id: 103323,
  },
  {
    name: "T.J. Tynan",
    id: 17523,
  },
  {
    name: "Philippe Daoust",
    id: 41019,
  },
];

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  for (const player of profiles) {
    await page.goto(
      `https://www.quanthockey.com/hockey-stats/en/profile.php?player=${player.id}`,
      {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      }
    );

    await page.waitForTimeout(3000);

    const text = await page.locator("body").innerText();

    const shoots =
      text.match(/shoots\s+(left|right)/i)?.[1];

    const weight =
      text.match(/(\d+)\s*lb/i)?.[1];

    const height =
      text.match(/(\d+\s*'\s*\d+")/)?.[1];

    console.log({
      player: player.name,
      shoots,
      weight,
      height,
    });
  }

  await browser.close();
}

main().catch(console.error);