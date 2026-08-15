const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const https = require("https");

const prisma = new PrismaClient();
const OUT_DIR = path.join(process.cwd(), "public", "images", "players");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : require("http");
    client.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        ...headers,
      },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirect = res.headers.location;
        if (redirect) {
          const full = redirect.startsWith("http") ? redirect : new URL(redirect, url).href;
          httpGet(full, headers).then(resolve).catch(reject);
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
        "Referer": "https://www.hockeydb.com/",
      },
      timeout: 15000,
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirect = response.headers.location;
        if (redirect) {
          file.close();
          const full = redirect.startsWith("http") ? redirect : new URL(redirect, url).href;
          downloadFile(full, dest).then(resolve).catch(reject);
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

// ── Clean player name ─────────────────────────────────
function cleanName(name) {
  return name
    .replace(/\s*''[AC]''\s*/gi, " ")
    .replace(/\s*\(NTC\)\s*/gi, " ")
    .replace(/\s*\(NMC\)\s*/gi, " ")
    .replace(/\s*\(UFA\)\s*/gi, " ")
    .replace(/\s*\(RFA\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── 1. Find HockeyDB ID ────────────────────────────────
async function findHockeydbId(name) {
  try {
    const clean = cleanName(name);
    const url = `https://www.hockeydb.com/ihdb/stats/findplayer.php?full_name=${encodeURIComponent(clean)}`;
    const html = await httpGet(url, { "Referer": "https://www.hockeydb.com/" });
    const match = html.match(/ihdb\/stats\/pdisplay\.php\?pid=(\d+)/i);
    if (match) return match[1];
  } catch (e) {}
  return null;
}

// ── 2. Scrape HockeyDB profile for photo ─────────────
async function scrapeHockeydbPhoto(hockeydbId) {
  try {
    const url = `https://www.hockeydb.com/ihdb/stats/pdisplay.php?pid=${hockeydbId}`;
    const html = await httpGet(url, { "Referer": "https://www.hockeydb.com/" });

    // Look for img tags in the player profile
    // Pattern: <img src="/ihdb/photos/...">
    const match = html.match(/<img[^>]+src=["'](\/ihdb\/photos\/[^"']+)["'][^>]*>/i);
    if (match) {
      return `https://www.hockeydb.com${match[1]}`;
    }

    // Also try full URL pattern
    const match2 = html.match(/<img[^>]+src=["'](https:\/\/www\.hockeydb\.com\/ihdb\/photos\/[^"']+)["'][^>]*>/i);
    if (match2) return match2[1];

  } catch (e) {}
  return null;
}

// ── 3. Try all sources ────────────────────────────────
async function tryDownload(player) {
  const safeName = cleanName(player.name).replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = `${safeName}_${player.id}.png`;
  const destPath = path.join(OUT_DIR, fileName);
  const dbPath = `/images/players/${fileName}`;

  // A) HockeyDB
  const hockeydbId = await findHockeydbId(player.name);
  if (hockeydbId) {
    console.log(`    HockeyDB ID: ${hockeydbId}`);

    const photoUrl = await scrapeHockeydbPhoto(hockeydbId);
    if (photoUrl) {
      console.log(`    Photo URL: ${photoUrl}`);
      try {
        await downloadFile(photoUrl, destPath);
        const stats = fs.statSync(destPath);
        if (stats.size > 1000) return { dbPath, size: stats.size, source: "HockeyDB" };
        fs.unlinkSync(destPath);
      } catch (err) {
        console.log(`    Download failed: ${err.message}`);
      }
    } else {
      console.log(`    No photo found on profile page`);
    }
  } else {
    console.log(`    HockeyDB ID: not found`);
  }

  return null;
}

async function main() {
  ensureDir(OUT_DIR);

  const players = await prisma.player.findMany({
    where: {
      OR: [
        { photoUrl: null },
        { photoUrl: { not: { startsWith: "/images/" } } },
      ],
    },
    include: { team: { select: { code: true, league: true } } },
    take: 10,
  });

  console.log(`Found ${players.length} players to process\n`);

  let ok = 0, fail = 0, skip = 0;

  for (const player of players) {
    if (player.photoUrl && player.photoUrl.startsWith("/images/")) {
      console.log(`  SKIP: ${player.name}`);
      skip++;
      continue;
    }

    console.log(`\n  PLAYER: ${player.name}`);

    const result = await tryDownload(player);

    if (result) {
      await prisma.player.update({
        where: { id: player.id },
        data: { photoUrl: result.dbPath },
      });
      console.log(`    ✓ OK [${result.source}]: ${result.dbPath} (${(result.size/1024).toFixed(1)} KB)`);
      ok++;
    } else {
      console.log(`    ✗ Not found`);
      fail++;
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\nDone! OK: ${ok}, Fail: ${fail}, Skip: ${skip}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
