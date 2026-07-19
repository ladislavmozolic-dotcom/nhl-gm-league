import axios from "axios";

async function main() {
  const { data } = await axios.get(
    "https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5540"
  );

  const match = data.match(
    /\/players\/[^"' ]+/i
  );

  console.log(match?.[0]);
}

main().catch(console.error);