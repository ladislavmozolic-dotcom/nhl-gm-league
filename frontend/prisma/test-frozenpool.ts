import axios from "axios";

async function main() {
  const url =
    "https://frozenpool.dobbersports.com/players/dans-locmelis";

  const response = await axios.get(url);

  console.log(response.data.substring(0, 5000));
}

main().catch(console.error);