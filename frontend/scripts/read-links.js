const fs = require("fs");

const content = fs.readFileSync("player-links.txt", "utf8");
console.log("Dĺžka súboru:", content.length);
console.log("Prvých 500 znakov:");
console.log(content.substring(0, 500));
console.log("\n---");
console.log("Nájdené IDčka (regex):");
const ids = [...content.matchAll(/id=(\d+)/g)].map(m => m[1]);
console.log("Počet:", ids.length);
console.log("Prvých 10:", ids.slice(0, 10));