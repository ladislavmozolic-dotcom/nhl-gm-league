import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  $("img").each((_, img) => {
    const src = $(img).attr("src");

    if (
      src &&
      src.includes("/images/LogoTeams/Pro/")
    ) {
      console.log(src);
    }
  });
}

main().catch(console.error);