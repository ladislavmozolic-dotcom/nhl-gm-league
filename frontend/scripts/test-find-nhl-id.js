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
      res.on("end", () => resolve({ status: res.statusCode, data, location: res.headers.location }));
    }).on("error", reject);
  });
}

async function main() {
  const name = "Mitchell Marner";

  console.log("=== 1. EliteProspects AJAX search ===");
  try {
    const r1 = await httpGet(`https://eliteprospects.com/ajax/search?q=${encodeURIComponent(name)}`);
    console.log("Status:", r1.status, "Redirect:", r1.location);
    if (r1.data.length < 2000) console.log("Data:", r1.data.substring(0, 500));
    else {
      try {
        const j = JSON.parse(r1.data);
        console.log("JSON:", JSON.stringify(j).substring(0, 500));
      } catch {
        console.log("Nie je JSON");
      }
    }
  } catch (e) { console.log("Chyba:", e.message); }

  console.log("\n=== 2. EliteProspects API search ===");
  try {
    const r2 = await httpGet(`https://eliteprospects.com/api/search?q=${encodeURIComponent(name)}`);
    console.log("Status:", r2.status);
    console.log("Data:", r2.data.substring(0, 500));
  } catch (e) { console.log("Chyba:", e.message); }

  console.log("\n=== 3. NHL suggest/autocomplete ===");
  try {
    const r3 = await httpGet(`https://suggest.svc.nhl.com/svc/suggest/v1/minplayers/${encodeURIComponent(name)}/99999`);
    console.log("Status:", r3.status);
    console.log("Data:", r3.data.substring(0, 500));
  } catch (e) { console.log("Chyba:", e.message); }

  console.log("\n=== 4. NHL search v2 ===");
  try {
    const r4 = await httpGet(`https://api-web.nhle.com/v1/search/player?q=${encodeURIComponent(name.toLowerCase())}`);
    console.log("Status:", r4.status);
    console.log("Data:", r4.data.substring(0, 500));
  } catch (e) { console.log("Chyba:", e.message); }

  console.log("\n=== 5. HockeyDB - extrahuj NHL ID ===");
  try {
    const r5 = await httpGet(`https://www.hockeydb.com/ihdb/stats/findplayer.php?full_name=${encodeURIComponent(name)}`);
    console.log("Status:", r5.status);
    // Hľadaj link na NHL.com
    const nhlMatch = r5.data.match(/nhl\.com\/player\/(\d+)/);
    if (nhlMatch) {
      console.log("Nájdené NHL ID na HockeyDB:", nhlMatch[1]);
    } else {
      console.log("NHL ID na HockeyDB nenájdené");
    }
  } catch (e) { console.log("Chyba:", e.message); }
}

main().catch(console.error);