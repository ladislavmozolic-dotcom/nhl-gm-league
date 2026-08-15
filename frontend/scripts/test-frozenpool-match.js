const fs = require("fs");
const https = require("https");

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
  // Parsni prvých 5 hráčov z player-links.txt
  const content = fs.readFileSync("player-links.txt", "utf8");
  const matches = [...content.matchAll(/frozenpool_ahl_player\.php\?id=(\d+)[^>]*>([^<]+)</gi)];

  console.log("Testujem, či frozenpool ID funguje na profinhl.cz...\n");

  for (let i = 0; i < Math.min(5, matches.length); i++) {
    const id = matches[i][1];
    const name = matches[i][2].trim();
    const url = `${BASE_URL}/PlayerReport.php?Player=${id}`;

    try {
      const html = await httpGet(url);
      const foundName = html.toLowerCase().includes(name.toLowerCase().split(" ")[0]) &&
                        html.toLowerCase().includes(name.toLowerCase().split(" ").pop());
      
      console.log(`${name} (ID: ${id})`);
      console.log(`  URL: ${url}`);
      console.log(`  Meno nájdené na stránke: ${foundName ? "ÁNO ✅" : "NIE ❌"}`);
      console.log("");
    } catch (e) {
      console.log(`${name} (ID: ${id}): CHYBA - ${e.message}\n`);
    }
  }
}

main().catch(console.error);