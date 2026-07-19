import axios from "axios";

async function main() {
  const url =
    "https://frozenpool.dobbersports.com/players/sam-poulin";

  const { data } = await axios.get(url);

  console.log(
    data.includes("Birth Date"),
    data.includes("Country"),
    data.includes("Weight"),
    data.includes("Shoots")
  );
}

main().catch(console.error);