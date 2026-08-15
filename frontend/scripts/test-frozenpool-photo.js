const https = require("https");

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html,*/*",
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
  // Test frozenpool stránky hráča
  const tests = [
    "https://frozenpool.dobbersports.com/players/chris-kreider",
    "https://frozenpool.dobbersports.com/players/mitchell-marner",
  ];

  for (const url of tests) {
    console.log("\n=== " + url + " ===");
    try {
      const r = await httpGet(url);
      console.log("Status:", r.status, "Dĺžka:", r.data.length);
      
      // Hľadaj obrázky
      const imgMatches = [...r.data.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)];
      console.log("Nájdených <img> tagov:", imgMatches.length);
      
      const photos = imgMatches
        .map(m => m[1])
        .filter(src => 
          !src.includes("icon") && 
          !src.includes("logo") && 
          !src.includes("banner") &&
          (src.includes("player") || src.includes("photo") || src.includes("headshot") || src.includes(".jpg") || src.includes(".png"))
        );
      
      console.log("Kandidáti na foto:", photos.slice(0, 5));
      
      // Hľadaj background-image (niekedy sú headshots cez CSS)
      const bgMatches = [...r.data.matchAll(/background-image:\s*url\(["']?([^"')]+)["']?\)/gi)];
      console.log("Background images:", bgMatches.map(m => m[1]).slice(0, 3));
      
    } catch (e) {
      console.log("Chyba:", e.message);
    }
  }

  // Test hockey-reference (čisto pre istotu)
  console.log("\n=== Hockey-Reference: Sidney Crosby ===");
  try {
    const r = await httpGet("https://www.hockey-reference.com/players/c/crosbsi01.html");
    console.log("Status:", r.status, "Dĺžka:", r.data.length);
    const imgMatches = [...r.data.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)];
    const photos = imgMatches.map(m => m[1]).filter(src => src.includes("jpg") || src.includes("png"));
    console.log("Obrázky:", photos.slice(0, 5));
  } catch (e) {
    console.log("Chyba:", e.message);
  }
}

main().catch(console.error);