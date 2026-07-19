import axios from "axios";

async function main() {
  const url =
    "https://frozenpool.dobbersports.com/players/adam-beckman";

  const { data } = await axios.get(url);

  console.log(
    data.match(/Birth Date\s+([0-9\-]+)/)?.[1]
  );

  console.log(
    data.match(/Shoots\s+([LR])/)?.[1]
  );

  console.log(
    data.match(/Height\s+([0-9']+)/)?.[1]
  );

  console.log(
    data.match(/Weight\s+([0-9]+)/)?.[1]
  );

  console.log(
    data.match(/Country\s+([A-Z]{3})/)?.[1]
  );
}

main().catch(console.error);