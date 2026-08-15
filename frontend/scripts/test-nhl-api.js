const https = require("https");

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
      },
      timeout: 15000,
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

async function searchNHL(name) {
  const url = `https://search.d3.nhle.com/api/v1/player-search?culture=en-us&q=${encodeURIComponent(name)}&limit=5`;
  try {
    const json = await httpGet(url);
    const results = JSON.parse(json);
    return results;
  } catch (e) {
    return [];
  }
}

async function main() {
  const testNames = ["Mitchell Marner", "Sam Reinhart", "Nico Hischier", "Jakob Pelletier"];
  
  for (const name of testNames) {
    console.log("\n=== " + name + " ===");
    const results = await searchNHL(name);
    
    if (results.length === 0) {
      console.log("Nič nenájdené");
      continue;
    }
    
    for (const r of results.slice(0, 3)) {
      console.log(`  ${r.fullName} | ID: ${r.playerId} | Tím: ${r.team} | Pozícia: ${r.position}`);
      console.log(`  Foto: https://cms.nhl.bamgrid.com/images/headshots/current/168x168/${r.playerId}.jpg`);
    }
  }
}

main().catch(console.error);