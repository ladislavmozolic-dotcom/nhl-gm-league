import axios from "axios";
import fs from "fs";

async function main() {
  const { data } = await axios.get(
    "https://frozenpool.dobbersports.com/players/adam-beckman"
  );

  fs.writeFileSync(
    "adam-beckman.html",
    data
  );

  console.log("saved");
}

main().catch(console.error);