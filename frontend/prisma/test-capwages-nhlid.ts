import axios from "axios";

async function main() {
  const { data } = await axios.get(
    "https://capwages.com/players/connor-mcdavid"
  );

  const match = data.match(
    /"propertyID":"NHL","value":([0-9]+)/
  );

  console.log(match?.[1]);
}

main().catch(console.error);
``