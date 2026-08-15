const https = require("https");

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json,text/html,*/*",
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
  const name = "Marner";
  const fullName = "Mitchell Marner";

  console.log("=== 1. NHL stats API s cayenneExp ===");
  try {
    const r1 = await httpGet(`https://api.nhle.com/stats/rest/en/skaters/summary?limit=5&cayenneExp=playerName%20like%20%22%25${encodeURIComponent(name)}%25%22&season=20232024`);
    console.log("Status:", r1.status);
    const j1 = JSON.parse(r1.data);
    console.log("Total:", j1.total);
    if (j1.data?.[0]) {
      console.log("Prvý:", JSON.stringify(j1.data[0]).substring(0, 400));
    }
  } catch (e) {
    console.log("Chyba:", e.message);
    console.log("Data:", r1?.data?.substring(0, 200));
  }

  console.log("\n=== 2. EliteProspects search ===");
  try {
    const r2 = await httpGet(`https://eliteprospects.com/search/player?q=${encodeURIComponent(fullName.replace(" ", "+"))}`);
    console.log("Status:", r2.status);
    // Hľadaj linky na profil
    const matches = [...r2.data.matchAll(/\/player\/(\d+)\/([a-z0-9-]+)/g)];
    console.log("Nájdených profilov:", matches.length);
    matches.slice(0, 3).forEach(m => console.log(`  ID: ${m[1]}, slug: ${m[2]}`));
  } catch (e) {
    console.log("Chyba:", e.message);
  }

  console.log("\n=== 3. NHL player landing (ak vieme ID) ===");
  // Mitch Marner ID je 8478483
  try {
    const r3 = await httpGet("https://api-web.nhle.com/v1/player/8478483/landing");
    console.log("Status:", r3.status);
    const j3 = JSON.parse(r3.data);
    console.log("Meno:", j3.firstName?.default, j3.lastName?.default);
    console.log("Headshot:", j3.headshot);
  } catch (e) {
    console.log("Chyba:", e.message);
  }

  console.log("\n=== 4. Priamy headshot test ===");
  console.log("Skúšam: https://cms.nhl.bamgrid.com/images/headshots/current/168x168/8478483.jpg");
  try {
    const r4 = await httpGet("https://cms.nhl.bamgrid.com/images/headshots/current/168x168/8478483.jpg");
    console.log("Status:", r4.status, "- Veľkosť:", r4.data.length);
  } catch (e) {
    console.log("Chyba:", e.message);
  }
}

main().catch(console.error);