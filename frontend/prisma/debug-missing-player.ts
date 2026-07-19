import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const player = await prisma.player.findFirst({
    where: {
      height: null,
    },
    select: {
      name: true,
      slug: true,
      frozenPoolId: true,
    },
  });

  console.log("PLAYER:");
  console.log(player);

  if (!player) {
    return;
  }

  const url =
    `https://frozenpool.dobbersports.com/players/${player.slug}`;

  console.log("URL:");
  console.log(url);

  const { data } = await axios.get(url);

  console.log("HAS BIRTH DATE:");
  console.log(data.includes("Birth Date"));

  console.log("HAS SHOOTS:");
  console.log(data.includes("Shoots"));

  console.log("HAS HEIGHT:");
  console.log(data.includes("Height"));

  console.log("HAS WEIGHT:");
  console.log(data.includes("Weight"));

  const $ = cheerio.load(data);

  console.log("SHOOTS:");
  console.log(
    $("#profile_shoots").text().trim()
  );

  console.log("HEIGHT:");
  console.log(
    $("#profile_height").text().trim()
  );

  console.log("WEIGHT:");
  console.log(
    $("#profile_weight").text().trim()
  );

  console.log("FIRST 3000 CHARS:");
  console.log(
    data.substring(0, 3000)
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });