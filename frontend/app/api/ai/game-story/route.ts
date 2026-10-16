import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateWithGemini } from "@/lib/ai/gemini";
import { getLang } from "@/lib/lang-server";
import { cleanName } from "@/lib/playerName";
import type { Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const gameId = Number(body.gameId);
    if (!gameId || isNaN(gameId)) {
      return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
    }

    const cookieLang = await getLang();
    const lang: Lang = (body.lang as Lang) || cookieLang || "en";
    const isEnglish = lang !== "cs";

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        status: true,
        homeTeamId: true,
        awayTeamId: true,
        homeGoals: true,
        awayGoals: true,
        endedIn: true,
        homeShots: true,
        awayShots: true,
        homeXg: true,
        awayXg: true,
        homeGoalsByPeriod: true,
        awayGoalsByPeriod: true,
        homeTeam: { select: { id: true, name: true, code: true, slug: true } },
        awayTeam: { select: { id: true, name: true, code: true, slug: true } },
        playerStats: {
          select: {
            teamId: true,
            playerId: true,
            goals: true,
            assists: true,
            points: true,
            shots: true,
            xg: true,
            pim: true,
            plusMinus: true,
            player: { select: { name: true, position: true } },
          },
        },
        goalieStats: {
          select: {
            teamId: true,
            playerId: true,
            saves: true,
            shotsAgainst: true,
            goalsAgainst: true,
            xga: true,
            player: { select: { name: true } },
          },
        },
      },
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    if (game.status !== "FINAL") {
      return NextResponse.json({ error: "Game is not finished yet" }, { status: 400 });
    }

    // Pull goal events
    const rawEvents = await prisma.gameEvent.findMany({
      where: { gameId, type: "GOAL" },
      orderBy: [{ period: "asc" }, { seconds: "asc" }],
      select: {
        period: true,
        seconds: true,
        teamId: true,
        playerId: true,
        strength: true,
        xg: true,
        meta: true,
      },
    });

    // Resolve player names for goal scorers
    const playerIds = [...new Set(rawEvents.map((e) => e.playerId).filter((id): id is number => id != null))];
    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } },
      select: { id: true, name: true },
    });
    const playerMap = new Map(players.map((p) => [p.id, cleanName(p.name)]));

    const goalsList = rawEvents.map((g) => {
      const min = Math.floor(g.seconds / 60);
      const sec = String(g.seconds % 60).padStart(2, "0");
      const scorer = g.playerId ? playerMap.get(g.playerId) ?? (isEnglish ? "Unknown scorer" : "Neznámy strelec") : (isEnglish ? "Unknown scorer" : "Neznámy strelec");
      const teamCode = g.teamId === game.homeTeamId ? game.homeTeam.code || game.homeTeam.name : game.awayTeam.code || game.awayTeam.name;
      const meta = (g.meta ?? {}) as { assistNames?: string[]; emptyNet?: boolean };
      const assists = meta.assistNames?.length
        ? (isEnglish ? `(assists: ${meta.assistNames.join(", ")})` : `(asistencie: ${meta.assistNames.join(", ")})`)
        : (isEnglish ? "(unassisted)" : "(bez asistencie)");
      const str = g.strength && g.strength !== "EV" ? ` [${g.strength}]` : "";
      const en = meta.emptyNet ? (isEnglish ? " [empty net]" : " [do prázdnej brány]") : "";
      return isEnglish
        ? `Period ${g.period}, ${min}:${sec} - ${teamCode}: ${scorer} ${assists}${str}${en}`
        : `Tretina ${g.period}, ${min}:${sec} - ${teamCode}: ${scorer} ${assists}${str}${en}`;
    });

    // Top performers
    const skaters = game.playerStats
      .map((s) => ({
        name: cleanName(s.player.name),
        team: s.teamId === game.homeTeamId ? game.homeTeam.name : game.awayTeam.name,
        g: s.goals,
        a: s.assists,
        pts: s.points,
        shots: s.shots,
        pim: s.pim,
      }))
      .sort((a, b) => b.pts - a.pts || b.g - a.g || b.shots - a.shots);

    const goalies = game.goalieStats
      .map((g) => {
        const pct = g.shotsAgainst > 0 ? ((g.saves / g.shotsAgainst) * 100).toFixed(1) + "%" : "N/A";
        const gsax = (g.xga - g.goalsAgainst).toFixed(2);
        return {
          name: cleanName(g.player.name),
          team: g.teamId === game.homeTeamId ? game.homeTeam.name : game.awayTeam.name,
          saves: g.saves,
          shotsAgainst: g.shotsAgainst,
          svPct: pct,
          gsax,
        };
      });

    let promptContext = "";
    let systemInstruction = "";
    let userPrompt = "";

    if (isEnglish) {
      const outcome = game.endedIn === "REG" ? "Regulation" : game.endedIn === "OT" ? "Overtime" : "Shootout";
      promptContext = `
GAME: ${game.awayTeam.name} at ${game.homeTeam.name}
FINAL SCORE: ${game.awayGoals} - ${game.homeGoals} (${outcome})
SHOTS ON GOAL: ${game.awayShots ?? 0} - ${game.homeShots ?? 0}
EXPECTED GOALS (xG): ${game.awayXg?.toFixed(2) ?? "0"} - ${game.homeXg?.toFixed(2) ?? "0"}
GOALS BY PERIOD (Away / Home): ${game.awayGoalsByPeriod?.join("-") ?? "N/A"} / ${game.homeGoalsByPeriod?.join("-") ?? "N/A"}

SCORING SUMMARY:
${goalsList.length ? goalsList.join("\n") : "No goals scored in regulation."}

GOALTENDERS:
${goalies.map((g) => `- ${g.name} (${g.team}): ${g.saves} saves on ${g.shotsAgainst} shots (${g.svPct} SV%, GSAx: ${g.gsax})`).join("\n")}

TOP PERFORMERS:
${skaters.slice(0, 5).map((s) => `- ${s.name} (${s.team}): ${s.g}G, ${s.a}A, ${s.pts} PTS (${s.shots} SOG)`).join("\n")}
`;

      systemInstruction = `You are a premier NHL sports beat writer and senior hockey journalist (The Athletic / TSN / Sportsnet style).
CRITICAL LANGUAGE REQUIREMENT: You MUST write the ENTIRE recap in standard ENGLISH. Never output Slovak, Czech, or any other language.
STRUCTURE:
1. **Compelling Headline** - punchy, featuring the hero, key turning point, or goaltender.
2. **The Lead** (1 paragraph) - summary of the final score, outcome, and arena vibe.
3. **Game Story & Flow** (2-3 paragraphs) - period-by-period progression, key goals, turning points.
4. **Goaltending & Stars of the Night** (1 paragraph) - goalie performances and top performers.
5. **Key Takeaway** (1-2 sentences) - what this outcome means going forward for both clubs.

Use authentic North American hockey terminology (rebound, top shelf, breakaways, power play, penalty kill, blue line).`;

      userPrompt = `${promptContext}\n\nWrite the complete post-game story entirely in ENGLISH following the instructions above:`;
    } else {
      promptContext = `
ZÁPAS: ${game.awayTeam.name} vs ${game.homeTeam.name}
KONEČNÝ VÝSLEDOK: ${game.awayGoals} : ${game.homeGoals} (${game.endedIn === "REG" ? "v riadnom hracom čase" : game.endedIn === "OT" ? "po predĺžení" : "po samostatných nájazdoch"})
STRELY: ${game.awayShots ?? 0} : ${game.homeShots ?? 0}
OČAKÁVANÉ GÓLY (xG): ${game.awayXg?.toFixed(2) ?? "0"} : ${game.homeXg?.toFixed(2) ?? "0"}
TRETINY (Hostia / Domáci): ${game.awayGoalsByPeriod?.join("-") ?? "N/A"} / ${game.homeGoalsByPeriod?.join("-") ?? "N/A"}

PRIEBEH GÓLOV:
${goalsList.length ? goalsList.join("\n") : "V riadnom hracom čase nepadol žiadny gól."}

BRANKÁRI:
${goalies.map((g) => `- ${g.name} (${g.team}): ${g.saves} zákrokov z ${g.shotsAgainst} striel (úspešnosť ${g.svPct}, GSAx: ${g.gsax})`).join("\n")}

NAJLEPŠÍ HRÁČI:
${skaters.slice(0, 5).map((s) => `- ${s.name} (${s.team}): ${s.g}G + ${s.a}A = ${s.pts} bodov (${s.shots} striel)`).join("\n")}
`;

      systemInstruction = `Si renomovaný hokejový novinár a redaktor (štýl Denník Šport, HokejPortal, TSN).
DÔLEŽITÁ JAZYKOVÁ POŽIADAVKA: Celá reportáž MUSÍ byť napísaná v SLOVENČINE (resp. češtine).
DODRŽUJ TENTO FORMÁT:
1. **Chytľavý novinársky titulok** (Headline) - úderný, vyzdvihujúci kľúčového hráča alebo zvrat.
2. **Úvod / Lead** (1 odsek) - zhrnutie výsledku a atmosféry.
3. **Priebeh zápasu** (2-3 odseky) - dramatické opísanie vývoja tretiny po tretine, dôležité góly, zlomový moment (turning point).
4. **Brankári a hrdinovia duelu** (1 odsek) - zhodnotenie výkonu v bránkovisku a kľúčových hráčov.
5. **Kľúčové ponaučenie (Key Takeaway)** (1-2 vety) - čo tento výsledok znamená pre oba tímy.

Používaj autentickú hokejovú terminológiu (brejk, presilovka, oslabenie, modrá čiara, zavesil, betóny, lapačka, power-play).`;

      userPrompt = `${promptContext}\n\nNapíš kompletnú pozápasovú reportáž v slovenčine podľa inštrukcií:`;
    }

    const aiResponse = await generateWithGemini(userPrompt, {
      systemInstruction,
      temperature: 0.6,
      maxTokens: 1500,
    });

    return NextResponse.json({
      success: true,
      gameId,
      lang,
      model: aiResponse.model,
      story: aiResponse.text,
    });
  } catch (error: any) {
    console.error("Game story AI error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate game story" },
      { status: 500 }
    );
  }
}
