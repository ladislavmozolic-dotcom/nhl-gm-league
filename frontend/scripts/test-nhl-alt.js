const https = require("https");

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
        ...headers,
      },
      timeout: 15000,
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve({ status: res.statusCode, data }));
    }).on("error", reject);
  });
}

async function main() {
  const name = "Mitchell Marner";
  const encoded = encodeURIComponent(name);

  const urls = [
    `https://api.nhle.com/stats/rest/en/players?limit=5&name=${encoded}`,
    `https://api-web.nhle.com/v1/search/player?culture=en-us&q=${encoded}`,
    `https://search.d3.nhle.com/api/v1/player-search?culture=en-us&q=${encoded}&limit=5`,
    `https://api.nhle.com/stats/rest/en/skaters/summary?limit=1&name=${encoded}&season=20232024`,
  ];

  for (const url of urls) {
    try {
      const result = await httpGet(url);
      console.log(`\n=== ${url} ===`);
      console.log(`Status: ${result.status}`);
      console.log(`Dĺžka: ${result.data.length}`);
      if (result.data.length < 1000) {
        console.log(`Obsah: ${result.data.substring(0, 500)}`);
      } else {
        // Skús parsnúť JSON
        try {
          const json = JSON.parse(result.data);
          if (json.data) {
            console.log(`Nájdených: ${json.data.length}`);
            if (json.data[0]) {
              console.log(`Prvý: ${JSON.stringify(json.data[0]).substring(0, 300)}`);
            }
          } else if (Array.isArray(json)) {
            console.log(`Nájdených: ${json.length}`);
            if (json[0]) {
              console.log(`Prvý: ${JSON.stringify(json[0]).substring(0, 300)}`);
            }
          }
        } catch {
          console.log(`Nie je JSON - HTML? ${result.data.substring(0, 200)}`);
        }
      }
    } catch (e) {
      console.log(`\n=== ${url} ===`);
      console.log(`CHYBA: ${e.message}`);
    }
  }

  // Skúsime aj priamo headshot URL pattern (Mitch Marner ID je 8478483)
  console.log("\n=== Headshot URL test ===");
  console.log("https://cms.nhl.bamgrid.com/images/headshots/current/168x168/8478483.jpg");
  console.log("https://assets.nhle.com/mugs/nhl/20232024/8478483.png");
}

main().catch(console.error);