import axios from "axios";

async function main() {
  const html = (
    await axios.get(
      "https://www.nhl.com/oilers/player/connor-mcdavid-8478402"
    )
  ).data;

  const matches =
    html.match(/https:\/\/assets\.nhle\.com[^"]+/g) || [];

  console.log(matches);
}

main().catch(console.error);