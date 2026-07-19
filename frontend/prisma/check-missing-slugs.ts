import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      OR: [
        { height: null },
        { weight: null },
        { shoots: null },
      ],
    },
    take: 20,
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  let updated = 0;

  for (const player of players) {
    try {
      const searchUrl =
        `https://frozenpool.dobbersports.com/search?q=${encodeURIComponent(
          player.name
        )}`;

      const { data } = await axios.get(searchUrl);

      // nájdi prvý profil hráča
      const match = data.match(
        /\/players\/([a-z0-9\-']+)/i
      );

      if (!match) {
        console.log(
          `NO PROFILE: ${player.name}`
        );
        continue;
      }

      const frozenSlug = match[1];

      const profileUrl =
