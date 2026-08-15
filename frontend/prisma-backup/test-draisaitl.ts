import axios from "axios";

async function main() {
  const html = (
    await axios.get(
      "https://profinhl.cz/PlayersRoster.php"
    )
  ).data;

  const matches =
    html.match(/.{0,50}Draisaitl.{0,50}/gi) || [];

  console.log(matches);
}

main().catch(console.error);