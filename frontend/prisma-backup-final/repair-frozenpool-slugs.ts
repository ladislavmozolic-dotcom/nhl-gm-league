import axios from "axios";

async function main() {
  const playerName = "Sam Poulin";

  const searchUrl =
    `https://frozenpool.dobbersports.com/search?q=${encodeURIComponent(
      playerName
    )}`;

  console.log(searchUrl);

  const { data } = await axios.get(searchUrl);

  console.log(data.substring(0, 10000));
}

main().catch(console.error);