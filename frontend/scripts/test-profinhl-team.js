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
      res.on("end", () => resolve({ status: res.statusCode, data }));
    }).on("error", reject);
  });
}

async function main() {
  // Skús nájsť team page — z team-links.txt alebo hádam
  const urls = [
    "https://profinhl.cz/team.php?team=1",
    "https://profinhl.cz/team.php?team=TOR",
    "https://profinhl.cz/teams.php",
    "https://profinhl.cz/PlayerReport.php?Player=706", // Jacob Middleton — vieme, že funguje
  ];

  for (const url of urls) {
    console.log("\n=== " + url + " ===");
    try {
      const r = await httpGet(url);
      console.log("Status:", r.status, "Dĺžka:", r.data.length);
      
      // Hľadaj linky na PlayerReport
      const matches = [...r.data.matchAll(/PlayerReport\.php\?Player=(\d+)[^>]*>([^<]+)</gi)];
      console.log("Nájdených hráčov na stránke:", matches.length);
      matches.slice(0, 5).forEach(m => console.log(`  ID: ${m[1]}, Meno: ${m[2]}`));
      
    } catch (e) {
      console.log("Chyba:", e.message);
    }
  }
}

main().catch(console.error);