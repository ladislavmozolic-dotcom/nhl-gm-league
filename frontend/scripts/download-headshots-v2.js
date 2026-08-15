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

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : require("http");
    client.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "application/json,text/html",
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
        "Referer": "https://www.nhl.com/",
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

// ── 1. NHL Suggest API ──────────────────────────────
async function findNhlId(name) {
  try {
    const url = `https://suggest.svc.nhl.com/svc/suggest/v1/minplayers/${encodeURIComponent(name)}/999`;
    const data = await httpGet(url);
    const json = JSON.parse(data);
    if (json.suggestions && json.suggestions.length > 0) {
      // suggestion format: "id|lastName|firstName|..."
      const parts = json.suggestions[0].split("|");
      return parts[0]; // NHL ID
    }
  } catch (e) {}
  return null;
}

// ── 2. Elite Prospects Search ──────────────────────
async function findEpId(name) {
  try {
    const url = `https://eliteprospects.com/search?q=${encodeURIComponent(name)}`;
    const html = await httpGet(url, { "Referer": "https://eliteprospects.com/" });

    // Look for player profile link: /player/123456/name
    const match = html.match(/href=["']\/player\/(\d+)\/[^"']*["']/i);
    if (match) return match[1];
  } catch (e) {}
  return null;
}

// ── 3. Try download from various sources ─────────────
async function tryDownload(player, nhlId, epId, league) {
  const safeName = player.name.replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = `${safeName}_${player.id}.png`;
  const destPath = path.join(OUT_DIR, fileName);
  const dbPath = `/images/players/${fileName}`;

  const teamCode = player.team?.code || "NHL";

  // A) NHL headshot (if NHL ID found and league is NHL)
  if (nhlId && league !== "AHL") {
    const urls = [
      `https://assets.nhle.com/mugs/nhl/${SEASON}/${teamCode}/${nhlId}.png`,
      `https://cms.nhl.bamgrid.com/images/headshots/current/168x168/${nhlId}.png`,
    ];
    for (const url of urls) {
      try {
        await downloadFile(url, destPath);
        const stats = fs.statSync(destPath);
        if (stats.size > 1000) return { dbPath, size: stats.size, source: "NHL" };
        fs.unlinkSync(destPath);
      } catch {}
    }
  }

  // B) Elite Prospects headshot
  if (epId) {
    const urls = [
      `https://assets.eliteprospects.com/images/players/${epId}.jpg`,
      `https://eliteprospects.com/images/players/${epId}.jpg`,
      `https://assets.eliteprospects.com/images/players/${epId}.png`,
    ];
    for (const url of urls) {
      try {
        await downloadFile(url, destPath);
        const stats = fs.statSync(destPath);
        if (stats.size > 1000) return { dbPath, size: stats.size, source: "EP" };
        fs.unlinkSync(destPath);
      } catch {}
    }
  }

  // C) AHL headshot (if AHL league)
  if (league === "AHL" && epId) {
    // Try common AHL ID patterns based on EP ID (not guaranteed)
    // Or try the leaguestat pattern with player ID if it matches
    const ahlUrls = [
      `https://assets.leaguestat.com/ahl/240x240/${player.id}.jpg`,
      `https://assets.leaguestat.com/ahl/240x240/${epId}.jpg`,
    ];
    for (const url of ahlUrls) {
      try {
        await downloadFile(url, destPath);
        const stats = fs.statSync(destPath);
        if (stats.size > 1000) return { dbPath, size: stats.size, source: "AHL" };
        fs.unlinkSync(destPath);
      } catch {}
    }
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
    take: 10, // Test with 10 first
  });

  console.log(`Found ${players.length} players to process\n`);

  let ok = 0, fail = 0, skip = 0;

  for (const player of players) {
    if (player.photoUrl && player.photoUrl.startsWith("/images/")) {
      console.log(`  SKIP: ${player.name}`);
      skip++;
      continue;
    }

    const league = player.team?.league || null;
    console.log(`\n  PLAYER: ${player.name} (${player.team?.code || "no team"}, ${league || "?"})`);

    // Find IDs
    const nhlId = await findNhlId(player.name);
    if (nhlId) console.log(`    NHL ID: ${nhlId}`);

    const epId = await findEpId(player.name);
    if (epId) console.log(`    EP ID: ${epId}`);

    if (!nhlId && !epId) {
      console.log(`    ✗ No ID found anywhere`);
      fail++;
      continue;
    }

    // Download
    const result = await tryDownload(player, nhlId, epId, league);

    if (result) {
      await prisma.player.update({
        where: { id: player.id },
        data: { photoUrl: result.dbPath },
      });
      console.log(`    ✓ OK [${result.source}]: ${result.dbPath} (${(result.size/1024).toFixed(1)} KB)`);
      ok++;
    } else {
      console.log(`    ✗ Headshot not found on any source`);
      fail++;
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\nDone! OK: ${ok}, Fail: ${fail}, Skip: ${skip}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
