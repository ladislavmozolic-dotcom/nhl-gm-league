import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  $("table").each((i, table) => {
    const text = $(table).text();

    if (text.includes("Sidney Crosby")) {
      console.log("FOUND TABLE:", i);

      console.log(
        text
          .replace(/\s+/g, " ")
          .trim()
          .substring(0, 2000)
      );

      process.exit(0);
    }
  });

  console.log("Not found");
}

main().catch(console.error);