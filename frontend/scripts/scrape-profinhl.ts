import { chromium } from "playwright";
import { prisma } from "../lib/prisma";

const BASE = "https://profinhl.cz";

async function scrapeAllRosters() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 1. Získaj zoznam tímov z menu alebo zo stránky
  await page.goto(`${BASE}/AllRosters.php`);
  await page.waitForLoadState("networkidle");

  // Parsuj HTML tabuľky — profinhl používa jednoduché HTML tabuľky
  const teamsData = await page.evaluate(() => {
    const teams: any[] = [];
    const headers = Array.from(document.querySelectorAll("h2, h3, .team-header"));
    const tables = Array.from(document.querySelectorAll("table"));

    tables.forEach((table, idx) => {
      const teamName = headers[idx]?.textContent?.trim() || `team-${idx + 1}`;
      const teamSlug = teamName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      const rows = Array.from(table.querySelectorAll("tr"));
      const players: any[] = [];
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length > 5) {
          const name = cells[0]?.textContent?.trim();
          const slug = name
            ? name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
            : undefined;

          players.push({
            name,
            slug,
            position: cells[1]?.textContent?.trim(),
            con: parseFloat(cells[2]?.textContent || "0"),
          });
        }
      });

      teams.push({ name: teamName, slug: teamSlug, players });
    });
    return teams;
  });

  console.log(`Nájdených ${teamsData.length} tímov`);

  // 2. Ulož do DB
  for (const teamData of teamsData) {
    for (const p of teamData.players) {
      if (!p.name || !p.slug) continue;
      
      await prisma.player.upsert({
        where: {
          slug: p.slug,
        },
        update: {
          position: p.position,
        },
        create: {
          name: p.name,
          slug: p.slug,
          position: p.position || "C",
          team: {
            connectOrCreate: {
              where: { slug: teamData.slug },
              create: {
                name: teamData.name,
                slug: teamData.slug,
                gm: "",
                arena: "",
              },
            },
          },
        },
      });
    }
  }

  await browser.close();
}

scrapeAllRosters().catch(console.error);