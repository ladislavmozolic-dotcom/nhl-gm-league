const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const https = require("https");

const prisma = new PrismaClient();
const OUT_DIR = path.join(process.cwd(), "public", "images", "players");
const SEASON = "20262027";

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nhl.com/",
      },
      timeout: 10000,
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(data));
    }).on("error", reject).on("timeout", () => reject(new Error("Timeout")));
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "image/*",
        "Referer": "https://www.nhl.com/",
      },
      timeout: 15000,
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirect = response.headers.location;
        if (redirect) {
          file.close();
          downloadFile(redirect, dest).then(resolve).catch(reject);
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

async function findNhlPlayerId(name) {
  try {
    const searchUrl = `https://search.d3.nhle.com/api/v1/search?culture=en-us&limit=5&q=${encodeURIComponent(name)}`;
    const data = await httpGet(searchUrl);
    const results = JSON.parse(data);

    if (results && results.players && results.players.length > 0) {
      // Return first match - could be improved with fuzzy matching
      return results.players[0].id;
    }
  } catch (e) {
    // silent fail
  }
  return null;
}

async function tryDownloadHeadshot(player, nhlId, league) {
  const safeName = player.name.replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = `${safeName}_${player.id}.png`;
  const destPath = path.join(OUT_DIR, fileName);
  const dbPath = `/images/players/${fileName}`;

  const teamCode = player.team?.code || "NHL";

  // Try NHL first
  if (league === "NHL" || league === null) {
    const nhlUrl = `https://assets.nhle.com/mugs/nhl/${SEASON}/${teamCode}/${nhlId}.png`;
    try {
      await downloadFile(nhlUrl, destPath);
      const stats = fs.statSync(destPath);
      if (stats.size > 1000) {
        return dbPath;
      }
      fs.unlinkSync(destPath);
    } catch {}
  }

  // Try AHL
  if (league === "AHL" || league === null) {
    const ahlUrl = `https://assets.nhle.com/mugs/ahl/${SEASON}/${teamCode}/${nhlId}.png`;
    try {
      await downloadFile(ahlUrl, destPath);
      const stats = fs.statSync(destPath);
      if (stats.size > 1000) {
        return dbPath;
      }
      fs.unlinkSync(destPath);
    } catch {}
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
    take: 10, // Start with 10 for testing
  });

  console.log(`Found ${players.length} players to process\n`);

  let ok = 0, fail = 0, skip = 0;

  for (const player of players) {
    if (player.photoUrl && player.photoUrl.startsWith("/images/")) {
      console.log(`  SKIP: ${player.name}`);
      skip++;
      continue;
    }

    console.log(`  SEARCH: ${player.name} (${player.team?.code || "no team"})`);

    const nhlId = await findNhlPlayerId(player.name);
    if (!nhlId) {
      console.log(`  ✗ NHL ID not found`);
      fail++;
      continue;
    }

    console.log(`  FOUND ID: ${nhlId}`);

    const league = player.team?.league || null;
    const photoPath = await tryDownloadHeadshot(player, nhlId, league);

    if (photoPath) {
      await prisma.player.update({
        where: { id: player.id },
        data: { photoUrl: photoPath },
      });
      console.log(`  ✓ OK: ${photoPath}\n`);
      ok++;
    } else {
      console.log(`  ✗ Headshot not found (tried NHL & AHL)\n`);
      fail++;
    }

    await new Promise(r => setTimeout(r, 800)); // Be nice to APIs
  }

  console.log(`Done! OK: ${ok}, Fail: ${fail}, Skip: ${skip}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
