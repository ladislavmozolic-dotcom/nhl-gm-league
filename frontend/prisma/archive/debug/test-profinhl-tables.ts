import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  console.log(
    "Tables found:",
    $("table").length
  );

  $("table").each((i, table) => {
    const rows = $(table).find("tr").length;

    console.log(
      `Table ${i}: ${rows} rows`
    );
  });
}

main().catch(console.error);