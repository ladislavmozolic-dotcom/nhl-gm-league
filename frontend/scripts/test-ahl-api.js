const https = require("https");

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      timeout: 15000,
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve({ status: res.statusCode, data }));
    }).on("error", reject);
  });
}

async function main() {
  const urls = [
    "https://theahl.com/stats/players",
    "https://lscluster.hockeytech.com/feed/?feed=modulekit&view=player&key=50c2cd6b6e18e140&fmt=json&client_code=ahl&lang=en&player_id=9191",
  ];

  for (const url of urls) {
    try {
      const result = await httpGet(url);
      console.log(`\n=== ${url} ===`);
      console.log(`Status: ${result.status}`);
      console.log(`${result.data.substring(0, 800)}`);
    } catch (e) {
      console.log(`\n=== ${url} ===`);
      console.log(`CHYBA: ${e.message}`);
    }
  }
}

main().catch(console.error);