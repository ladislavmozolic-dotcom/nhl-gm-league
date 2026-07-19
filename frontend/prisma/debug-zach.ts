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
  const player = await prisma.player.findFirst({
    where: {
      name: "Zach Aston-reese",
    },
    select: {
      id: true,
      name: true,
      birthDate: true,
    },
  });

  if (!player) {
    console.log("Player not found");
    return;
  }

  console.log("PLAYER:");
  console.log(player);

  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  const protocol = "https";
  const host = "www.hockeydb.com";

  const surname =
    player.name.split(" ").pop() ||
    player.name;

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

  console.log(
    `FOUND: ${links.length}`
  );

  for (const link of links) {
    try {
      console.log(
        "\n===================="
      );

      console.log(
        "PROFILE:"
      );
      console.log(link.text);

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

      console.log(
        "RAW BORN:"
      );
      console.log(born);

      if (!born) {
        console.log(
          "NO BORN FOUND"
        );
        continue;
      }

      const hockeyBirthDate =
        normalizeBirthDate(
          born
        );

      console.log(
        "HOCKEY DOB:"
      );
      console.log(
        hockeyBirthDate
      );

      console.log(
        "DB DOB:"
      );
      console.log(
        player.birthDate
      );

      if (
        hockeyBirthDate !==
        player.birthDate
      ) {
        console.log(
          "DOB NO MATCH"
        );
        continue;
      }

      console.log(
        "DOB MATCH ✅"
      );

      const shoots =
        text.match(
          /shoots\s+([LR])/i
        )?.[1];

      const height =
        text.match(
          /Height\s+([0-9.]+)/i
        )?.[1];

      const weight =
        text.match(
          /Weight\s+(\d+)/i
        )?.[1];

      console.log(
        "\nRESULT:"
      );

      console.log({
        player: player.name,
        hockeyBirthDate,
        shoots,
        height,
        weight,
      });

      break;
    } catch {
      console.log(
        "FAILED PROFILE"
      );
    }
  }

  await browser.close();
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });