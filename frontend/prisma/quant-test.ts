import axios from "axios";

async function main() {
  const { data } = await axios.get(
    "https://www.quanthockey.com/hockey-stats/en/profile.php?player=33575"
  );

  console.log(
    data.includes("Date of Birth")
  );

  console.log(
    data.includes("Height")
  );

  console.log(
    data.includes("Weight")
  );

  console.log(
    data.includes("Shoots")
  );

  console.log(
    data.includes("Nationality")
  );
}

main().catch(console.error);