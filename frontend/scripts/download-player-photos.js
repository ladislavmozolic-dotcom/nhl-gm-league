const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const prisma = new PrismaClient();
const OUT_DIR = path.join(process.cwd(), "public", "images", "players");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://profinhl.cz/",
          "Connection": "keep-alive",
        },
      },
      (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            downloadFile(redirectUrl, dest).then(resolve).catch(reject);
            return;
          }
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Status ${response.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(dest);
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
        file.on("error", (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
      }
    );
    req.on("error", (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
  });
}

async function main() {
  ensureDir(OUT_DIR);

  const players = await prisma.player.findMany({
    where: { photoUrl: { not: null } },
    select: { id: true, name: true, photoUrl: true },
  });

  console.log(`Found ${players.length} players with photos\n`);

  let ok = 0, fail = 0, skip = 0;

  for (const player of players) {
    if (!player.photoUrl) continue;

    if (player.photoUrl.startsWith("/images/")) {
      console.log(`  SKIP (already local): ${player.name}`);
      skip++;
      continue;
    }

    const urlPath = new URL(player.photoUrl).pathname;
    const ext = path.extname(urlPath) || ".png";
    const safeName = player.name.replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `${safeName}_${player.id}${ext}`;
    const destPath = path.join(OUT_DIR, fileName);
    const dbPath = `/images/players/${fileName}`;

    try {
      console.log(`  DOWNLOAD: ${player.name}`);
      await downloadFile(player.photoUrl, destPath);

      await prisma.player.update({
        where: { id: player.id },
        data: { photoUrl: dbPath },
      });

      console.log(`  ✓ OK: ${dbPath}`);
      ok++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${player.name} — ${err.message}`);
      fail++;
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nDone! OK: ${ok}, Fail: ${fail}, Skip: ${skip}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });