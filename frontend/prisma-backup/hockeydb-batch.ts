import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeBirthDate(
  value: string
): string | null {
  const months: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };

  const match =
    value.match(
      /([A-Za-z]{3})\s+(\d+)\s+(\d{4})/
    );

  if (!match) {
    return null;
  }

  return (
    match[3] +
    "-" +
    months[match[1]] +
    "-" +
    match[2].padStart(2, "0")
  );
}

async function main() {
  const players = await prisma.player.findMany({
    where: {
      OR: [
        { height: null },
        { weight: null },
        { shoots: null },
      ],
    },
    take: 300,
  });

  console.log(
    `PLAYERS TO PROCESS: ${players.length}`
  );

  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();

  const protocol = "https";
  const host = "www.hockeydb.com";

  let updated = 0;

  for (const player of players) {
    try {
      console.log(
        `\nPROCESSING: ${player.name}`
      );

      const surname =
        player.name.split(" ").pop() || "";

      const searchUrl =
        protocol +
        "://" +
        host +
        "/ihdb/stats/find_player.php?full_name=" +
        encodeURIComponent(surname);

      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      const links = await page.evaluate(() => {
        return Array.from(
          document.querySelectorAll(
            'a[href*="pdisplay.php?pid="]'
          )
        ).map(link => ({
          text:
            link.textContent?.trim() || "",
          href:
            (link as HTMLAnchorElement)
              .href,
        }));
      });

      let matched = false;

      for (const link of links) {
        try {
          await page.goto(link.href, {
            waitUntil:
              "domcontentloaded",
            timeout: 60000,
          });

          const text =
            await page
              .locator("body")
              .innerText();

          const born =
            text.match(
              /Born\s+([A-Za-z]{3}\s+\d+\s+\d{4})/i
            )?.[1];

          if (!born) {
            continue;
          }

          const hockeyDob =
            normalizeBirthDate(
              born
            );

          if (
            hockeyDob !==
            player.birthDate
          ) {
            continue;
          }

          const shoots =
            text.match(
              /shoots\s+([LR])/i
            )?.[1] || null;

          const height =
            text.match(
              /Height\s+([0-9.]+)/i
            )?.[1] || null;

          const weight =
            text.match(
              /Weight\s+(\d+)/i
            )?.[1];

          await prisma.player.update({
            where: {
              id: player.id,
            },
            data: {
              shoots,
              height,
              weight: weight
                ? Number(weight)
                : null,
            },
          });

          updated++;
          matched = true;

          console.log(
            `[${updated}] UPDATED ${player.name}`
          );

          console.log({
            shoots,
            height,
            weight,
          });

          break;
        } catch {
          continue;
        }
      }

      if (!matched) {
        console.log(
          `NO MATCH: ${player.name}`
        );
      }
    } catch (err) {
      console.log(
        `FAILED: ${player.name}`
      );
    }
  }

  await browser.close();

  console.log(
    `\nUPDATED TOTAL: ${updated}`
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });