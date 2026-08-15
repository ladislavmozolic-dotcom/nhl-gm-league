const https = require("https");

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.google.com/",
        ...headers,
      },
      timeout: 20000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        if (loc) {
          const full = loc.startsWith("http") ? loc : new URL(loc, url).href;
          httpGet(full, headers).then(resolve).catch(reject);
          return;
        }
      }
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve({ status: res.statusCode, data }));
    }).on("error", reject);
  });
}

async function main() {
  const players = [
    { name: "Mitchell Marner", slug: "mitchell-marner" },
    { name: "Sam Reinhart", slug: "sam-reinhart" },
    { name: "Nico Hischier", slug: "nico-hischier" },
    { name: "Ville Koivunen", slug: "ville-koivunen" },
    { name: "Chris Kreider", slug: "chris-kreider" },
  ];

  for (const p of players) {
    console.log("\n=== " + p.name + " ===");
    try {
      const r = await httpGet(`https://puckpedia.com/player/${p.slug}`);
      console.log("Status:", r.status, "Dĺžka:", r.data.length);

      // 1. Hľadaj NHL ID
      const nhlPatterns = [
        /nhl\.com\/player\/[a-z-]+-(\d{7})/i,
        /"nhlId":\s*(\d{7})/,
        /playerId["']?\s*:\s*(\d{7})/,
        /https:\/\/www\.nhl\.com\/player\/\d+/,
        /data-nhl-id=["']?(\d{7})/,
      ];
      
      let nhlId = null;
      for (const pattern of nhlPatterns) {
        const match = r.data.match(pattern);
        if (match) {
          nhlId = match[1] || match[0];
          break;
        }
      }
      
      if (nhlId) {
        console.log("✅ NHL ID:", nhlId);
      } else {
        console.log("❌ NHL ID nenájdené");
      }

      // 2. Hľadaj foto na PuckPedia
      const imgPatterns = [
        /src="(https:\/\/[^"]*puckpedia[^"]*\/player[^"]*\.(?:png|jpg|jpeg))"/i,
        /src="(\/player[^"]*\.(?:png|jpg|jpeg))"/i,
        /src="(https:\/\/[^"]*\/headshots?[^"]*\.(?:png|jpg|jpeg))"/i,
        /<img[^>]+src=["']([^"']*(?:player|headshot|photo)[^"']*)["'][^>]*>/i,
      ];
      
      let photoUrl = null;
      for (const pattern of imgPatterns) {
        const match = r.data.match(pattern);
        if (match) {
          photoUrl = match[1];
          break;
        }
      }
      
      if (photoUrl) {
        console.log("✅ PuckPedia foto:", photoUrl);
      } else {
        console.log("❌ PuckPedia foto nenájdené");
      }

      // 3. Hľadaj JSON-LD alebo meta dáta
      const jsonLdMatch = r.data.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      if (jsonLdMatch) {
        try {
          const json = JSON.parse(jsonLdMatch[1]);
          console.log("JSON-LD name:", json.name);
          if (json.image) console.log("JSON-LD image:", json.image);
        } catch {}
      }

    } catch (e) {
      console.log("Chyba:", e.message);
    }
  }

  // 4. Test priameho headshotu z NHL (ak vieme ID)
  console.log("\n=== Test NHL headshot (Mitch Marner = 8478483) ===");
  try {
    const r = await httpGet("https://assets.nhle.com/mugs/nhl/20262027/VGK/8478483.png");
    console.log("Status:", r.status, "Veľkosť:", r.data.length);
  } catch (e) {
    console.log("Chyba:", e.message);
  }
}

main().catch(console.error);