const fs = require("fs");

function main() {
  // profinhl-sync.log
  if (fs.existsSync("profinhl-sync.log")) {
    const content = fs.readFileSync("profinhl-sync.log", "utf8");
    console.log("=== profinhl-sync.log ===");
    console.log("Riadkov:", content.split("\n").length);
    
    // Hľadaj OK riadky
    const okLines = content.split("\n").filter(l => l.includes("OK") || l.includes("Player="));
    console.log("Riadkov s Player=:", okLines.length);
    okLines.slice(0, 10).forEach(l => console.log("  " + l));
    
    // Hľadaj FAILED
    const failed = content.split("\n").filter(l => l.includes("FAILED"));
    console.log("FAILED:", failed.length);
    
    // Parsni všetky ID
    const ids = [...content.matchAll(/Player=(\d+)/g)].map(m => m[1]);
    console.log("Unikátnych ID v logu:", [...new Set(ids)].length);
  }

  // profinhl-goalies.log
  if (fs.existsSync("profinhl-goalies.log")) {
    const content = fs.readFileSync("profinhl-goalies.log", "utf8");
    console.log("\n=== profinhl-goalies.log ===");
    console.log("Riadkov:", content.split("\n").length);
    const ids = [...content.matchAll(/Player=(\d+)/g)].map(m => m[1]);
    console.log("Unikátnych ID:", [...new Set(ids)].length);
    console.log("Prvých 10:", [...new Set(ids)].slice(0, 10));
  }
}

main();