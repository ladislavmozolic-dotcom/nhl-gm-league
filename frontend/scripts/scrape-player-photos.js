const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const https = require("https");

const prisma = new PrismaClient();
const OUT_DIR = path.join(process.cwd(), "public", "images", "players");
const BASE_URL = "https://profinhl.cz";

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://profinhl.cz/",
      },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirect = res.headers.location;
        if (redirect) {
          httpGet(redirect.startsWith("http") ? redirect : BASE_URL + redirect)
            .then(resolve).catch(reject);
          return;
        }
      }
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(data));
    }).on("error", reject).on("timeout", () => reject(new Error("Timeout")));
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith("https:") ? https : require("http");
    client.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "image/*",
        "Referer": "https://profinhl.cz/",
      },
      timeout: 15000,
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirect = response.headers.location;
        if (redirect) {
          file.close();
          const fullRedirect = redirect.startsWith("http") ? redirect : BASE_URL + redirect;
          downloadFile(fullRedirect, dest).then(resolve).catch(reject);
          return;
        }
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Status ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
      file.on("error", (err) => { fs.unlink(dest, () => {}); reject(err); });
    }).on("error", (err) => { fs.unlink(dest, () => {}); reject(err); });
  });
}

function extractHeadshotUrl(html, playerId) {
  // Try multiple patterns to find the headshot

  // Pattern 1: img with player headshot (common class names)
  const patterns = [
    // Look for img tags that might be player photos
    /<img[^>]+src=["']([^"']*(?:player|face|headshot|photo)[^"']*)["'][^>]*>/gi,
    // Look for img with specific dimensions (headshots are usually small and square)
    /<img[^>]+src=["']([^"']*)["'][^>]*(?:width|height)=["']?(?:100|120|150|168|200)["']?[^>]*>/gi,
    // Any img tag in the player info section
    /<img[^>]+src=["']([^"']*\.(?:png|jpg|jpeg))["'][^>]*class=["'][^"']*(?:rounded|circle|avatar|photo)["'][^>]*>/gi,
  ];

  for (const pattern of patterns) {
    const matches = [...html.matchAll(pattern)];
    for (const match of matches) {
      let url = match[1];
      // Skip NHL banner backgrounds (they're usually large or contain specific keywords)
      if (url.includes("nhl.com") || url.includes("Background") || url.includes("banner")) {
        continue;
      }
      // Make relative URLs absolute
      if (url.startsWith("/")) url = BASE_URL + url;
      if (!url.startsWith("http")) url = BASE_URL + "/" + url;
      return url;
    }
  }

  // Pattern 2: Try common direct paths based on player ID
  const directPaths = [
    `/images/players/${playerId}.png`,
    `/images/players/${playerId}.jpg`,
    `/images/faces/${playerId}.png`,
    `/images/faces/${playerId}.jpg`,
    `/images/headshots/${playerId}.png`,
    `/images/headshots/${playerId}.jpg`,
    `/player_photos/${playerId}.png`,
    `/player_photos/${playerId}.jpg`,
  ];

  return directPaths.map(p => BASE_URL + p);
}

async function scrapePlayerPhoto(player) {
  const reportUrl = `${BASE_URL}/PlayerReport.php?Player=${player.id}`;

  try {
    console.log(`  FETCH: ${player.name} (ID: ${player.id})`);
    const html = await httpGet(reportUrl);

    // Save first player's HTML for debugging if needed
    if (player.id === 207) {
      fs.writeFileSync("debug_player_207.html", html, "utf-8");
      console.log("  → Saved debug HTML to debug_player_207.html");
    }

    const result = extractHeadshotUrl(html, player.id);

    if (!result) {
      console.log(`  ✗ No photo found in HTML`);
      return null;
    }

    const urls = Array.isArray(result) ? result : [result];

    for (const url of urls) {
      const ext = path.extname(new URL(url).pathname) || ".png";
      const safeName = player.name.replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `${safeName}_${player.id}${ext}`;
      const destPath = path.join(OUT_DIR, fileName);
      const dbPath = `/images/players/${fileName}`;

      try {
        console.log(`  TRY: ${url}`);
        await downloadFile(url, destPath);

        // Verify file is not empty and is an image
        const stats = fs.statSync(destPath);
        if (stats.size < 1000) {
          fs.unlinkSync(destPath);
          continue; // Probably 404 page or error
        }

        await prisma.player.update({
          where: { id: player.id },
          data: { photoUrl: dbPath },
        });

        console.log(`  ✓ OK: ${dbPath} (${(stats.size/1024).toFixed(1)} KB)`);
        return dbPath;
      } catch (err) {
        console.log(`  ✗ Failed: ${err.message}`);
        // Try next URL
      }
    }

    return null;
  } catch (err) {
    console.log(`  ✗ Error: ${err.message}`);
    return null;
  }
}

async function main() {
  ensureDir(OUT_DIR);

  // Get players - if they have external photoUrl, or no photoUrl at all
  const players = await prisma.player.findMany({
    where: {
      OR: [
        { photoUrl: null },
        { photoUrl: { not: { startsWith: "/images/" } } },
      ],
    },
    take: 5, // Start with 5 for testing
  });

  console.log(`Found ${players.length} players to scrape\n`);

  let ok = 0, fail = 0;

  for (const player of players) {
    const result = await scrapePlayerPhoto(player);
    if (result) ok++; else fail++;
    await new Promise(r => setTimeout(r, 1000)); // Be nice to the server
  }

  console.log(`\nDone! OK: ${ok}, Fail: ${fail}`);
  console.log("\nIf photos were not found, check debug_player_207.html");
  console.log("and send it to me so I can adjust the scraper.");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
