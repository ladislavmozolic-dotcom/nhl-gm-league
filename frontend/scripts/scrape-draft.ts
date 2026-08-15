import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function scrape() {
  const res = await fetch("https://profinhl.cz/AllRosters.php");
  const html = await res.text();

  const teams = await prisma.team.findMany({
    where: { parentTeamId: null },
    select: { id: true, name: true, logoUrl: true, profinhlLogoId: true },
  });

  // Map: logo URL -> profinhlLogoId
  const logoMap = new Map<string, number>();
  teams.forEach((t) => {
    if (t.logoUrl && t.profinhlLogoId) logoMap.set(t.logoUrl, t.profinhlLogoId);
  });

  // Rozdel na sekcie podľa <h1>/<h2>
  const parts = html.split(/(?=<h[12][^>]*>)/i);
  
  for (const part of parts) {
    const nameMatch = part.match(/<h[12][^>]*>([^<]+)<\/h[12]>/i);
    if (!nameMatch) continue;
    
    const teamName = nameMatch[1].trim();
    const team = teams.find((t) => t.name.toUpperCase() === teamName.toUpperCase());
    if (!team) continue;

    // Nájdi draft tabuľku
    const tableMatch = part.match(/<table[\s\S]*?<\/table>/i);
    if (!tableMatch) continue;

    const rows = tableMatch[0].matchAll(/<tr>(.*?)<\/tr>/gi);
    let rowIdx = 0;

    for (const row of rows) {
      rowIdx++;
      if (rowIdx === 1) continue; // header

      const cells = row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g);
      const vals = Array.from(cells).map((c) => c[1]);
      if (vals.length < 8) continue;

      const year = parseInt(vals[0]);
      if (isNaN(year)) continue;

      for (let round = 1; round <= 7; round++) {
        const cell = vals[round];
        const imgs = cell.matchAll(/<img[^>]+src="([^"]+)"/g);
        const logos = Array.from(imgs).map((m) => m[1]);

        // Získaj picky z DB pre toto kolo
        const dbPicks = await prisma.draftPick.findMany({
          where: { teamId: team.id, year, round },
          orderBy: { id: "asc" },
        });

        for (let i = 0; i < logos.length; i++) {
          const ownerId = logoMap.get(logos[i]);
          if (!ownerId || !dbPicks[i]) continue;

          if (dbPicks[i].ownerLogoId !== ownerId) {
            await prisma.draftPick.update({
              where: { id: dbPicks[i].id },
              data: { ownerLogoId: ownerId },
            });
            console.log(`✓ ${team.name} ${year} R${round} pick ${i+1} → ${ownerId}`);
          }
        }
      }
    }
  }
}

scrape().catch(console.error).finally(() => prisma.$disconnect());