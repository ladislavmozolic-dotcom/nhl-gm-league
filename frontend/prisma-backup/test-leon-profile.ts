import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/PlayerReport.php?Player=306"
  );

  const $ = cheerio.load(data);

  $("a").each((_, el) => {
    const href = $(el).attr("href");

    if (
      href &&
      href.includes("nhl")
    ) {
      console.log(
        "TEXT:",
        $(el).text().trim()
      );

      console.log(
        "HREF:",
        href
      );
    }
  });
}

main().catch(console.error);