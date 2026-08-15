import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

const OUT_DIR = path.join(process.cwd(), "public", "images", "teams");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const options = new URL(url);

    const req = client.get(
      {
        hostname: options.hostname,
        path: options.pathname + options.search,
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
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
          reject(new Error(`Status ${response.statusCode} for ${url}`));
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

  const teams = await prisma.team.findMany({
    where: { logoUrl: { not: null } },
    select: { id: true, name: true, code: true, logoUrl: true, league: true },
  });

  console.log(`Found ${teams.length} teams with logos\n`);

  let ok = 0;
  let fail = 0;
  let skip = 0;

  for (const team of teams) {
    if (!team.logoUrl) continue;

    // Skip if already local path
    if (team.logoUrl.startsWith("/images/")) {
      console.log(`  SKIP (already local): ${team.name}`);
      skip++;
      continue;
    }

    const league = team.league ?? "nhl";
    const leagueDir = path.join(OUT_DIR, league.toLowerCase());
    ensureDir(leagueDir);

    const ext = path.extname(new URL(team.logoUrl).pathname) || ".png";
    const fileName = `${team.code ?? team.id}${ext}`;
    const destPath = path.join(leagueDir, fileName);
    const dbPath = `/images/teams/${league.toLowerCase()}/${fileName}`;

    try {
      console.log(`  DOWNLOAD: ${team.name}`);
      await downloadFile(team.logoUrl, destPath);

      await prisma.team.update({
        where: { id: team.id },
        data: { logoUrl: dbPath },
      });

      console.log(`  ✓ OK: ${dbPath}`);
      ok++;
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${team.name} — ${err.message}`);
      fail++;
    }

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nDone! OK: ${ok}, Fail: ${fail}, Skip: ${skip}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
