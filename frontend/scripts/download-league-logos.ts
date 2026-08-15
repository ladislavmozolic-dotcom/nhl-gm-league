import fs from "fs";
import path from "path";
import https from "https";

const OUT_DIR = path.join(process.cwd(), "public", "images", "logos");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(
        url,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "image/svg+xml,image/*,*/*;q=0.8",
            "Referer": "https://www.nhl.com/",
          },
        },
        (response) => {
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
          file.on("finish", () => {
            file.close();
            resolve();
          });
        }
      )
      .on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

function writeSvg(filePath: string, content: string) {
  fs.writeFileSync(filePath, content, "utf-8");
}

async function main() {
  ensureDir(OUT_DIR);

  // ── 1. NHL Shield Logo ──
  const nhlUrl = "https://assets.nhle.com/logos/nhl/svg/NHL_light.svg";
  const nhlDest = path.join(OUT_DIR, "nhl.svg");
  try {
    console.log("Downloading NHL logo...");
    await downloadFile(nhlUrl, nhlDest);
    console.log("  ✓ NHL logo saved");
  } catch (err: any) {
    console.error("  ✗ NHL logo failed:", err.message);
  }

  // ── 2. Eastern Conference SVG ──
  const eastSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="eastGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e3a5f;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0a1628;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="100" cy="100" r="95" fill="url(#eastGrad)" stroke="#3b82f6" stroke-width="3"/>
  <text x="100" y="85" text-anchor="middle" fill="#3b82f6" font-family="Arial Black, sans-serif" font-size="22" font-weight="900" letter-spacing="2">EASTERN</text>
  <text x="100" y="120" text-anchor="middle" fill="#ffffff" font-family="Arial Black, sans-serif" font-size="28" font-weight="900" letter-spacing="1">CONFERENCE</text>
  <path d="M60 140 L100 165 L140 140" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
  writeSvg(path.join(OUT_DIR, "eastern-conference.svg"), eastSvg);
  console.log("  ✓ Eastern Conference logo created");

  // ── 3. Western Conference SVG ──
  const westSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="westGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#5c2b1e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0a1628;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="100" cy="100" r="95" fill="url(#westGrad)" stroke="#f97316" stroke-width="3"/>
  <text x="100" y="85" text-anchor="middle" fill="#f97316" font-family="Arial Black, sans-serif" font-size="22" font-weight="900" letter-spacing="2">WESTERN</text>
  <text x="100" y="120" text-anchor="middle" fill="#ffffff" font-family="Arial Black, sans-serif" font-size="28" font-weight="900" letter-spacing="1">CONFERENCE</text>
  <path d="M60 140 L100 165 L140 140" fill="none" stroke="#f97316" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
  writeSvg(path.join(OUT_DIR, "western-conference.svg"), westSvg);
  console.log("  ✓ Western Conference logo created");

  console.log("\nAll logos saved to: public/images/logos/");
  console.log("  - nhl.svg");
  console.log("  - eastern-conference.svg");
  console.log("  - western-conference.svg");
}

main().catch(console.error);
