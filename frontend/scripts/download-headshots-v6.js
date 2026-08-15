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

// ── Nickname mapping ──────────────────────────────────
const NICKNAMES = {
  "mitchell": "mitch",
  "christopher": "chris",
  "nicholas": "nick",
  "nathaniel": "nate",
  "benjamin": "ben",
  "matthew": "matt",
  "joshua": "josh",
  "joseph": "joe",
  "robert": "rob",
  "william": "will",
  "richard": "rich",
  "timothy": "tim",
  "samuel": "sam",
  "jonathan": "jon",
  "edward": "ed",
  "daniel": "dan",
  "michael": "mike",
  "james": "jim",
  "alexander": "alex",
  "andrew": "drew",
  "anthony": "tony",
  "charles": "charlie",
  "david": "dave",
  "geoffrey": "geoff",
  "jeffrey": "jeff",
  "kenneth": "ken",
  "patrick": "pat",
  "raymond": "ray",
  "stephen": "steve",
  "thomas": "tom",
  "zachary": "zach",
};

function getAlternateNames(fullName) {
  const names = [fullName];
  const parts = fullName.toLowerCase().split(" ");

  // Try replacing first name with nickname
  if (parts.length >= 2 && NICKNAMES[parts[0]]) {
    const alt = [NICKNAMES[parts[0]], ...parts.slice(1)].join(" ");
    names.push(alt);
  }

  // Try just last name
  if (parts.length >= 2) {
    names.push(parts[parts.length - 1]);
  }

  return [...new Set(names)];
}

// ── 1. Find HockeyDB ID (with fallback) ───────────────
async function findHockeydbId(name) {
  const names = getAlternateNames(cleanName(name));

  for (const tryName of names) {
    try {
      const url = `https://www.hockeydb.com/ihdb/stats/findplayer.php?full_name=${encodeURIComponent(tryName)}`;
      const html = await httpGet(url, { "Referer": "https://www.hockeydb.com/" });

      // Try direct redirect (single result)
      const directMatch = html.match(/ihdb\/stats\/pdisplay\.php\?pid=(\d+)/i);
      if (directMatch) return directMatch[1];

      // Try search results page — find all player links
      const resultMatches = [...html.matchAll(/ihdb\/stats\/pdisplay\.php\?pid=(\d+)[^"']*["'][^>]*>([^<]+)/gi)];

      for (const match of resultMatches) {
        const resultName = match[2].toLowerCase().trim();
        const searchName = cleanName(name).toLowerCase();
        const lastName = searchName.split(" ").pop();

        // If result contains last name, it's probably our guy
        if (resultName.includes(lastName)) {
          return match[1];
        }
      }

      // If no match by last name, just take first result
      if (resultMatches.length > 0) {
        return resultMatches[0][1];
      }

    } catch (e) {}
  }

  return null;
}

// ── 2. Scrape HockeyDB profile for photo ─────────────
async function scrapeHockeydbPhoto(hockeydbId) {
  try {
    const url = `https://www.hockeydb.com/ihdb/stats/pdisplay.php?pid=${hockeydbId}`;
    const html = await httpGet(url, { "Referer": "https://www.hockeydb.com/" });

    // Look for img tags with photos
    const match = html.match(/<img[^>]+src=["'](\/ihdb\/photos\/[^"']+)["'][^>]*>/i);
    if (match) return `https://www.hockeydb.com${match[1]}`;

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

  const hockeydbId = await findHockeydbId(player.name);
  if (!hockeydbId) {
    console.log(`    HockeyDB ID: not found (tried: ${getAlternateNames(cleanName(player.name)).join(", ")})`);
    return null;
  }

  console.log(`    HockeyDB ID: ${hockeydbId}`);

  const photoUrl = await scrapeHockeydbPhoto(hockeydbId);
  if (!photoUrl) {
    console.log(`    No photo on profile page`);
    return null;
  }

  console.log(`    Photo URL: ${photoUrl}`);

  try {
    await downloadFile(photoUrl, destPath);
    const stats = fs.statSync(destPath);
    if (stats.size > 1000) return { dbPath, size: stats.size, source: "HockeyDB" };
    fs.unlinkSync(destPath);
  } catch (err) {
    console.log(`    Download failed: ${err.message}`);
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

    await new Promise(r => setTimeout(r, 1200));
  }

  console.log(`\nDone! OK: ${ok}, Fail: ${fail}, Skip: ${skip}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
