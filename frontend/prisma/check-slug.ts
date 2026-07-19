import axios from "axios";

async function test(slug: string) {
  try {
    const { data } = await axios.get(
      `https://frozenpool.dobbersports.com/players/${slug}`
    );

    console.log(
      slug,
      data.includes("Birth Date")
    );
  } catch {
    console.log(slug, false);
  }
}

async function main() {
  await test("sam-poulin");
  await test("samuel-poulin");

  await test("t-j-tynan");
  await test("t.j.-tynan");

  await test("phil-tomasino");
  await test("philip-tomasino");
}

main();