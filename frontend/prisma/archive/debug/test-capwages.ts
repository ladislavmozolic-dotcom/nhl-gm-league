import axios from "axios";

async function main() {
  const { data } = await axios.get(
    "https://capwages.com/players/connor-mcdavid"
  );

  console.log(data.substring(0, 5000));
}

main().catch(console.error);