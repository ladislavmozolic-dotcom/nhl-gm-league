const { PrismaClient } = require("@prisma/client");
const https = require("https");

const prisma = new PrismaClient();
const BASE_URL = "https://profinhl.cz";

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html,*/*",
        "Referer": "https://profinhl.cz/",
      },
      timeout: 15000,
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

async function main() {
  // Nájdi 5 hráčov, čo majú frozenPoolId
  const players = await prisma.player.findMany({
    where: { frozenPoolId: { not: null } },
    take: 5,
  });

  console.log("Testujem, či frozenPoolId = profinhlId...\n");

  for (const p of players) {
    const url = `${BASE_URL}/PlayerReport.php?Player=${p.frozenPoolId}`;
    try {
      const html = await httpGet(url);
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "NO TITLE";
      
      // Skontroluj, či meno hráča je na stránke
      const nameLower = p.name.toLowerCase();
      const htmlLower = html.toLowerCase();
      const found = htmlLower.includes(nameLower.split(" ")[0]) && htmlLower.includes(nameLower.split(" ").pop());
      
      console.log(`${p.name} (frozenPoolId: ${p.frozenPoolId})`);
      console.log(`  URL: ${url}`);
      console.log(`  Title: ${title}`);
      console.log(`  Meno nájdené na stránke: ${found ? "ÁNO ✅" : "NIE ❌"}`);
      console.log("");
    } catch (e) {
      console.log(`${p.name}: CHYBA - ${e.message}\n`);
    }
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });