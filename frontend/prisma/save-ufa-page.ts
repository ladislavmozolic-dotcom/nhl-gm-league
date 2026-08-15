
import axios from "axios";
import fs from "fs";

async function main() {
  const { data } = await axios.get(
    "https://capwages.com/players/ufas"
  );

  fs.writeFileSync(
    "ufa-page.html",
    data,
    "utf8"
  );

  console.log("saved");
}

main().catch(console.error);