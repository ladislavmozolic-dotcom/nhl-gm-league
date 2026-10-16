import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateWithGemini } from "@/lib/ai/gemini";
import { getLang } from "@/lib/lang-server";
import { cleanName } from "@/lib/playerName";
import { findSimilarPlayers } from "@/lib/gm-assistant/similarPlayers";
import { idealRole } from "@/lib/gm-assistant/idealRole";
import type { Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const playerId = Number(body.playerId);
    if (!playerId || isNaN(playerId)) {
      return NextResponse.json({ error: "Invalid playerId" }, { status: 400 });
    }

    const cookieLang = await getLang();
    const lang: Lang = (body.lang as Lang) || cookieLang || "cs";

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: {
        team: { select: { id: true, name: true, code: true } },
      },
    });

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const [similar, role] = await Promise.all([
      findSimilarPlayers(playerId, 4).catch(() => null),
      idealRole(playerId).catch(() => null),
    ]);

    const isGoalie = !!player.isGoalie || player.position === "G";
    const bestRole = role?.slots?.length ? [...role.slots].sort((a, b) => a.rank - b.rank)[0] : null;
    const similarNames = similar?.players?.map((p) => `${cleanName(p.name)} (${p.teamCode || "FA"}, OV ${p.overall})`).join(", ");

    const promptContext = `
HRÁČ: ${cleanName(player.name)}
POZÍCIA: ${player.position ?? "N/A"}
TÍM: ${player.team?.name ?? "Voľný hráč (Free Agent)"}
VEK: ${player.age ?? "N/A"} rokov
CELKOVÉ HODNOTENIE (OV): ${player.overall ?? "N/A"}
ZMLUVA: ${player.capHit ? `$${(player.capHit / 1_000_000).toFixed(2)}M` : "Bez zmluvy"}, dĺžka ${player.contractYears ?? 0} rokov, status: ${player.rosterType ?? "N/A"}

HERNÉ ATRIBÚTY:
${
  isGoalie
    ? `- Chytanie: Celkovo ${player.overall}`
    : `- Fyzická hra / Checking (CK): ${player.ck ?? "N/A"}
- Tvorba hry / Passing (PA): ${player.pa ?? "N/A"}
- Streľba / Scoring (SC): ${player.sc ?? "N/A"}
- Defenzíva / Defense (DF): ${player.df ?? "N/A"}`
}

POZÍCIA V LIGE & ROLA:
- Ideálna rola v zostave: ${bestRole ? `${bestRole.slotLabel} (#${bestRole.rank} z ${bestRole.outOf} v lige)` : "Neznáma"}
- Typovo najpodobnejší hráči v UNHL: ${similarNames || "Žiadni zjavní"}
`;

    let systemInstruction = "";
    if (lang === "cs") {
      systemInstruction = `Si hlavný riaditeľ skautingu tímu NHL (Director of Pro Scouting).
Tvojou úlohou je napísať autentický, vecný a odborný skautský posudok na hráča v slovenčine.
DODRŽUJ TENTO FORMÁT:
1. **Profil hráča a štýl hry** (1 odsek) - typologické zaradenie, ako sa prezentuje na ľade (sniper, play-maker, defenzívny špecialista, power-forward atď.).
2. **Kľúčové silné stránky a slabiny** (bodový zoznam).
3. **Typové prirovnanie k hviezde NHL (NHL Comparable)** (napr. 'Štýlom pripomína Chrisa Kreidera vďaka...' alebo 'Herným prejavom pripomína...').
4. **Skautský verdikt pre GM (Scouting Verdict)** (1 odsek) - pomer cena/výkon vzhľadom na plat, odporúčanie, či predĺžiť zmluvu, trejdovať ho alebo nasadzovať do špeciálnych formácií.

Používaj autentickú hokejovú terminológiu. Píš pútavo a s rešpektom k jeho reálnym atribútom.`;
    } else if (lang === "en") {
      systemInstruction = `You are a Director of Pro Scouting for an NHL franchise.
Write an authentic, insightful pro scouting report on the player in English.
STRUCTURE:
1. **Player Profile & Style of Play** (1 paragraph) - player archetype and on-ice identity.
2. **Key Strengths & Weaknesses** (bullet points).
3. **NHL Comparable** (e.g. 'Plays a similar high-motor game to Brad Marchand...').
4. **Scout's Verdict for GM** (1 paragraph) - cap efficiency, contract value, role fit, trade/re-sign recommendation.

Use authentic hockey scouting language.`;
    } else {
      systemInstruction = `You are a Director of Pro Scouting for an NHL team. Write a scouting report in language: ${lang}.`;
    }

    const aiResponse = await generateWithGemini(
      promptContext + "\n\nVypracuj kompletný skautský report podľa pokynov:",
      {
        systemInstruction,
        temperature: 0.6,
        maxTokens: 1200,
      }
    );

    return NextResponse.json({
      success: true,
      playerId,
      playerName: cleanName(player.name),
      lang,
      model: aiResponse.model,
      scoutingReport: aiResponse.text,
    });
  } catch (error: any) {
    console.error("Player scout AI error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate scouting report" },
      { status: 500 }
    );
  }
}
