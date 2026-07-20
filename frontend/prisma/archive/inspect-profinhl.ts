import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/PlayerReport.php?Player=495"
  );

  const $ = cheerio.load(data);

  const text = $("body").text();

  const dobMatch = text.match(
    /Date of Birth:\s*([A-Za-z]+\s+\d{2},\s+\d{4})/
  );

  const heightMatch = text.match(
    /Height:\s*(\d+)\s*cm/
  );

  const weightMatch = text.match(
    /Weight:\s*(\d+)\s*kg/
  );

  const nhlMatch = data.match(
    /nhl\.com\/player\/(\d+)/
  );

  console.log({
    dob: dobMatch?.[1] ?? null,
    height: heightMatch?.[1] ?? null,
    weight: weightMatch?.[1] ?? null,
    nhlId: nhlMatch?.[1] ?? null,
  });
}

main().catch(console.error);