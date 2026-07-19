import axios from "axios";

async function main() {
  const { data } = await axios.get(
    "https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=4026"
  );

  console.log(
    data.match(
      /Birth Date<\/td>\s*<td>(\d{4}-\d{2}-\d{2})/i
    )?.[1]
  );

  console.log(
    data.match(
      /Country<\/td>\s*<td>([A-Z]{3})/i
    )?.[1]
  );

  console.log(
    data.includes("profile_height")
  );

  console.log(
    data.includes("profile_weight")
  );

  console.log(
    data.includes("profile_shoots")
  );
}

main().catch(console.error);