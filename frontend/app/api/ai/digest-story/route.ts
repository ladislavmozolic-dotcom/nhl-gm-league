import { NextRequest, NextResponse } from "next/server";
import { dailyDigest } from "@/lib/digest-server";
import { generateWithGemini } from "@/lib/ai/gemini";
import { getLang } from "@/lib/lang-server";
import type { Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const season = body.season || "2026-27";
    const target = body.target ?? null;

    const cookieLang = await getLang();
    const lang: Lang = (body.lang as Lang) || cookieLang || "cs";

    const digest = await dailyDigest(season, target);
    if (!digest || digest.gameCount === 0) {
      return NextResponse.json({ error: "No games found for this night" }, { status: 400 });
    }

    const scoresSummary = digest.scores
      .map((s) => `${s.away} ${s.awayGoals} : ${s.homeGoals} ${s.home} (${s.endedIn})`)
      .join("\n");

    const promptContext = `
DÁTUM / KOLO: ${digest.date ?? `Kolo ${digest.round}`}
POČET ZÁPASOV: ${digest.gameCount}

VÝSLEDKY ZÁPASOV:
${scoresSummary}

ZÁPAS NOCI:
${digest.gameOfNight ? `${digest.gameOfNight.away} vs ${digest.gameOfNight.home} (${digest.gameOfNight.awayGoals}:${digest.gameOfNight.homeGoals}) - Poznámka: ${digest.gameOfNight.note}` : "Žiadny"}

HRÁČ NOCI:
${digest.playerOfNight ? `${digest.playerOfNight.name} (${digest.playerOfNight.team}): ${digest.playerOfNight.goals ?? 0}G + ${digest.playerOfNight.assists ?? 0}A = ${digest.playerOfNight.points ?? 0} bodov` : "Žiadny"}

NAJLEPŠÍ BRANKÁR:
${digest.bestGoalie ? `${digest.bestGoalie.name} (${digest.bestGoalie.team}): ${digest.bestGoalie.saves} zákrokov (úspešnosť ${digest.bestGoalie.svPct}%), GSAx: ${digest.bestGoalie.gsax}` : "Žiadny"}

PREKVAPENIE NOCI:
${digest.upset ? `${digest.upset.away} vs ${digest.upset.home} (${digest.upset.awayGoals}:${digest.upset.homeGoals}) - ${digest.upset.note}` : "Žiadne"}

NAJTVRDŠÍ HIT:
${digest.biggestHit ? `${digest.biggestHit.hitter} trafil hráča ${digest.biggestHit.victim} (${digest.biggestHit.note})` : "Žiadny"}

SPRÁVA O ZRANENIACH:
${digest.injuries.length ? digest.injuries.map((i) => `- ${i.name} (${i.team}): ${i.part} (${i.severity}, pauza ${i.days} dní)`).join("\n") : "Čistá noc bez zranení."}

FORMA TÍMOV:
- Najhorúcejší tím: ${digest.hottest ? `${digest.hottest.name} (${digest.hottest.streakLen} výhier v rade, bilancia z 10: ${digest.hottest.last10})` : "N/A"}
- V kríze: ${digest.coldest ? `${digest.coldest.name} (${digest.coldest.streakLen} zápasov bez výhry, bilancia z 10: ${digest.coldest.last10})` : "N/A"}
`;

    let systemInstruction = "";
    if (lang === "cs") {
      systemInstruction = `Si šéfredaktor prestížneho hokejového magazínu UNHL.
Tvojou úlohou je napísať pútavý, novinársky redakčný sumár hokejovej noci v slovenčine (Príbeh dnešnej noci).
DODRŽUJ TENTO FORMÁT:
1. **Úderný titulok dňa** (Headline).
2. **Príbeh noci** (2-3 odseky) - dynamický opis diania na klziskách, čo bola hlavná téma večera, vyzdvihnutie hrdinov a prekvapení.
3. **Zápisník redakcie (Quick Hits)** - odrážkový zoznam (hity, zranenia, série tímov).

Píš dynamicky, pútavo a s rešpektom k ligovým výsledkom.`;
    } else if (lang === "en") {
      systemInstruction = `You are the Editor-in-Chief of the official UNHL Daily Digest magazine.
Write an engaging, authentic daily hockey story (The Story of the Night) in English.
STRUCTURE:
1. **Punchy Headline of the Night**
2. **The Story of the Night** (2-3 paragraphs) - summarizing the action, star performances, upsets.
3. **Quick Hits** - bulleted highlights (biggest hit, key injury updates, hot/cold streaks).

Write with flair and authority.`;
    } else {
      systemInstruction = `You are an NHL sports editor. Write a nightly hockey digest story in language: ${lang}.`;
    }

    const aiResponse = await generateWithGemini(
      promptContext + "\n\nNapíš redakčný príbeh noci podľa inštrukcií:",
      {
        systemInstruction,
        temperature: 0.6,
        maxTokens: 1400,
      }
    );

    return NextResponse.json({
      success: true,
      season,
      target,
      lang,
      model: aiResponse.model,
      story: aiResponse.text,
    });
  } catch (error: any) {
    console.error("Digest story AI error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate digest story" },
      { status: 500 }
    );
  }
}
