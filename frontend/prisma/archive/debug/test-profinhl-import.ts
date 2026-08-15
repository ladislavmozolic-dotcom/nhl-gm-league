import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  console.log("HTML loaded");
  console.log("Length:", data.length);

  const crosby = $("body").text().includes(
    "Sidney Crosby"
  );

  console.log("Contains Crosby:", crosby);

  const pastrnak = $("body").text().includes(
    "David Pastrnak"
  );

  console.log("Contains Pastrnak:", pastrnak);
}

main().catch(console.error);