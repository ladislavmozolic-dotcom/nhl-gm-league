const https = require("https");

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
  // Skúsme rôzne URL patterny pre vyhľadávanie
  const tests = [
    "https://profinhl.cz/PlayerReport.php?Player=706", // vieme, že funguje
    "https://profinhl.cz/players.php", // zoznam hráčov?
    "https://profinhl.cz/", // hlavná stránka
  ];

  for (const url of tests) {
    try {
      const html = await httpGet(url);
      console.log("\n=== " + url + " ===");
      console.log("Dĺžka:", html.length);
      
      // Hľadaj search form
      const formMatch = html.match(/<form[^>]*>[\s\S]*?<\/form>/i);
      if (formMatch) {
        console.log("Nájdený form:", formMatch[0].substring(0, 300));
      }
      
      // Hľadaj linky na PlayerReport
      const playerLinks = [...html.matchAll(/PlayerReport\.php\?Player=(\d+)/g)].map(m => m[1]);
      console.log("Nájdených PlayerReport linkov:", playerLinks.length);
      if (playerLinks.length > 0) {
        console.log("Ukážka ID:", playerLinks.slice(0, 5));
      }
    } catch (e) {
      console.log(url + " - CHYBA:", e.message);
    }
  }
}

main().catch(console.error);