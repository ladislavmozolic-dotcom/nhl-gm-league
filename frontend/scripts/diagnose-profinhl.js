const fs = require("fs");

function main() {
  console.log("=== DIAGNOSTIKA PROFINHL ZDROJOV ===\n");

  // 1. player-links.txt
  if (fs.existsSync("player-links.txt")) {
    const content = fs.readFileSync("player-links.txt", "utf8");
    const lines = content.split("\n").filter(l => l.trim());
    console.log("✅ player-links.txt: " + lines.length + " riadkov");
    console.log("Prvé 3 riadky:");
    lines.slice(0, 3).forEach(l => console.log("  " + l));

    const ids = [...content.matchAll(/Player=(\d+)/g)].map(m => m[1]);
    console.log("Nájdených Player=ID: " + ids.length);
    console.log("Ukážka: " + ids.slice(0, 5).join(", ") + "\n");
  } else {
    console.log("❌ player-links.txt neexistuje\n");
  }

  // 2. team-links.txt
  if (fs.existsSync("team-links.txt")) {
    const content = fs.readFileSync("team-links.txt", "utf8");
    const lines = content.split("\n").filter(l => l.trim());
    console.log("✅ team-links.txt: " + lines.length + " riadkov");
    console.log("Prvé 3 riadky:");
    lines.slice(0, 3).forEach(l => console.log("  " + l + "\n"));
  } else {
    console.log("❌ team-links.txt neexistuje\n");
  }

  // 3. profinhl-sync.log
  if (fs.existsSync("profinhl-sync.log")) {
    const content = fs.readFileSync("profinhl-sync.log", "utf8");
    const lines = content.split("\n").filter(l => l.trim());
    console.log("✅ profinhl-sync.log: " + lines.length + " riadkov");
    console.log("Prvých 10 riadkov:");
    lines.slice(0, 10).forEach(l => console.log("  " + l));
    console.log("");
  } else {
    console.log("❌ profinhl-sync.log neexistuje\n");
  }

  // 4. sync-profinhl.ts
  if (fs.existsSync("sync-profinhl.ts")) {
    const content = fs.readFileSync("sync-profinhl.ts", "utf8");
    console.log("✅ sync-profinhl.ts existuje (" + content.length + " znakov)");
    console.log("Prvých 800 znakov:");
    console.log(content.substring(0, 800));
    console.log("\n...");
  } else {
    console.log("❌ sync-profinhl.ts neexistuje");
  }
}

main();