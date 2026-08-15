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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function httpGet(url, retries = 3) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : require("http");
    client.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,sk;q=0.8",
        "Referer": "https://profinhl.cz/",
        "Connection": "keep-alive",
      },
      timeout: 20000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirect = res.headers.location;
        if (redirect) {
          const full = redirect.startsWith("http") ? redirect : new URL(redirect, url).href;
          httpGet(full, retries).then(resolve).catch(reject);
          return;
        }
      }
      if (res.statusCode === 456 && retries > 0) {
        console.log("    456 detected, waiting 10s... (" + retries + " left)");
        sleep(10000).then(() => httpGet(url, retries - 1).then(resolve).catch(reject));
        return;
      }
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(data));
    }).on("error", async (err) => {
      if (retries > 0) {
        await sleep(5000);
        httpGet(url, retries - 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    }).on("timeout", async () => {
      if (retries > 0) {
        await sleep(5000);
        httpGet(url, retries - 1).then(resolve).catch(reject);
      } else {
        reject(new Error("Timeout"));
      }
    });
  });
}

function downloadFile(url, dest, retries = 3) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith("https:") ? https : require("http");
    client.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Referer": "https://profinhl.cz/",
      },
      timeout: 20000,
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirect = response.headers.location;
        if (redirect) {
          file.close();
          const full = redirect.startsWith("http") ? redirect : new URL(redirect, url).href;
          downloadFile(full, dest, retries).then(resolve).catch(reject);
          return;
        }
      }
      if (response.statusCode === 456 && retries > 0) {
        file.close();
        fs.unlink(dest, () => {});
        sleep(10000).then(() => downloadFile(url, dest, retries - 1).then(resolve).catch(reject));
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error("Status " + response.statusCode));
        return;
      }
      response.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
      file.on("error", (err) => { fs.unlink(dest, () => {}); reject(err); });
    }).on("error", async (err) => {
      fs.unlink(dest, () => {});
      if (retries > 0) {
        await sleep(5000);
        downloadFile(url, dest, retries - 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

function cleanName(name) {
  return name
    .replace(/\s*''[AC]''\s*/gi, " ")
    .replace(/\s*\(NTC\)\s*/gi, " ")
    .replace(/\s*\(NMC\)\s*/gi, " ")
    .replace(/\s*\(UFA\)\s*/gi, " ")
    .replace(/\s*\(RFA\)\s*/gi, " ")
    .replace(/\s*\(R\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── POUŽÍVAME profinhlId NAMISTO interného id ──
async function scrapeProfinhlHeadshot(profinhlId) {
  if (!profinhlId) return [];
  
  try {
    const url = BASE_URL + "/PlayerReport.php?Player=" + profinhlId;
    console.log("    Fetching: " + url);
    const html = await httpGet(url);

    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const matches = [...html.matchAll(imgRegex)];

    const candidates = [];
    for (const match of matches) {
      let src = match[1];

      if (src.includes("nhl.com")) continue;
      if (src.includes("Background")) continue;
      if (src.includes("LogoTeams")) continue;
      if (src.includes("icon")) continue;
      if (src.includes("flag")) continue;
      if (src.includes("button")) continue;
      if (src.includes("arrow")) continue;
      if (src.includes("banner")) continue;
      if (src.includes("advert")) continue;

      if (src.startsWith("/")) src = BASE_URL + src;
      if (!src.startsWith("http")) src = BASE_URL + "/" + src;

      candidates.push(src);
    }

    const bgRegex = /background-image:\s*url\(["']?([^"')]+)["']?\)/gi;
    const bgMatches = [...html.matchAll(bgRegex)];
    for (const match of bgMatches) {
      let src = match[1];
      if (src.includes("nhl.com") || src.includes("Background")) continue;
      if (src.startsWith("/")) src = BASE_URL + src;
      if (!src.startsWith("http")) src = BASE_URL + "/" + src;
      candidates.push(src);
    }

    return candidates;
  } catch (e) {
    console.log("    Error fetching profile: " + e.message);
    return [];
  }
}

async function tryDirectUrls(profinhlId) {
  if (!profinhlId) return [];
  
  const patterns = [
    "/images/players/" + profinhlId + ".png",
    "/images/players/" + profinhlId + ".jpg",
    "/images/faces/" + profinhlId + ".png",
    "/images/faces/" + profinhlId + ".jpg",
    "/images/headshots/" + profinhlId + ".png",
    "/images/headshots/" + profinhlId + ".jpg",
  ];

  return patterns.map(p => BASE_URL + p);
}

async function tryDownload(player) {
  const safeName = cleanName(player.name).replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = safeName + "_" + player.id + ".png";
  const destPath = path.join(OUT_DIR, fileName);
  const dbPath = "/images/players/" + fileName;

  if (!player.profinhlId) {
    console.log("    SKIP: No profinhlId mapped for this player");
    return null;
  }

  const scrapedUrls = await scrapeProfinhlHeadshot(player.profinhlId);
  if (scrapedUrls.length > 0) {
    console.log("    Found " + scrapedUrls.length + " image candidate(s)");
    for (const url of scrapedUrls) {
      try {
        console.log("    Trying: " + url);
        await downloadFile(url, destPath);
        const stats = fs.statSync(destPath);
        if (stats.size > 2000) {
          console.log("    Downloaded: " + (stats.size/1024).toFixed(1) + " KB");
          return { dbPath, size: stats.size, source: "ProfiNHL-scrape" };
        }
        fs.unlinkSync(destPath);
      } catch (err) {
        console.log("    Failed: " + err.message);
      }
    }
  }

  const directUrls = await tryDirectUrls(player.profinhlId);
  for (const url of directUrls) {
    try {
      console.log("    Trying direct: " + url);
      await downloadFile(url, destPath);
      const stats = fs.statSync(destPath);
      if (stats.size > 2000) {
        console.log("    Downloaded: " + (stats.size/1024).toFixed(1) + " KB");
        return { dbPath, size: stats.size, source: "ProfiNHL-direct" };
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
      AND: [
        {
          OR: [
            { photoUrl: null },
            { photoUrl: { not: { startsWith: "/images/" } } },
          ],
        },
        { profinhlId: { not: null } },
      ],
    },
    include: { team: { select: { code: true, league: true } } },
  });

  console.log("Found " + players.length + " players to process\n");

  let ok = 0, fail = 0, skip = 0;

  for (const player of players) {
    if (player.photoUrl && player.photoUrl.startsWith("/images/")) {
      console.log("  SKIP: " + player.name);
      skip++;
      continue;
    }

    console.log("\n  PLAYER: " + player.name + " (profinhlId: " + player.profinhlId + ")");

    const result = await tryDownload(player);

    if (result) {
      await prisma.player.update({
        where: { id: player.id },
        data: { photoUrl: result.dbPath },
      });
      console.log("    OK [" + result.source + "]: " + result.dbPath);
      ok++;
    } else {
      console.log("    Not found");
      fail++;
    }

    const delay = 1000 + Math.random() * 3000;
    console.log("    Waiting " + (delay/1000).toFixed(1) + "s...");
    await sleep(delay);
  }

  console.log("\nDone! OK: " + ok + ", Fail: " + fail + ", Skip: " + skip);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });