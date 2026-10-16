import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { analyzeRoster } from "@/lib/gm-assistant/analyzeRoster";
import { loadLeagueCap } from "@/lib/free-agency-server";
import { liveCapHit } from "@/lib/finance";
import { generateWithGemini, isGeminiConfigured } from "@/lib/ai/gemini";
import { cleanName } from "@/lib/playerName";
import { getLang } from "@/lib/lang-server";
import type { Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const sessionTeamId = await getTeamSession();
    const body = await req.json().catch(() => ({}));
    const targetTeamId = Number(body.teamId || sessionTeamId);

    if (!Number.isInteger(targetTeamId) || targetTeamId <= 0) {
      return NextResponse.json({ error: "Invalid team ID" }, { status: 400 });
    }

    const cookieLang = await getLang();
    const lang: Lang = (body.lang as Lang) || cookieLang || "cs";

    if (!isGeminiConfigured()) {
      return NextResponse.json(
        {
          error: "Gemini API key is not configured.",
          configured: false,
        },
        { status: 503 }
      );
    }

    const team = await prisma.team.findUnique({
      where: { id: targetTeamId },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const players = await prisma.player.findMany({
      where: { teamId: targetTeamId, rosterType: "NHL", scratched: false },
      select: {
        id: true,
        name: true,
        position: true,
        overall: true,
        capHit: true,
        contractYears: true,
        extYears: true,
        extCapHit: true,
        age: true,
        isGoalie: true,
      },
      orderBy: { overall: "desc" },
    });

    // Next scheduled opponent
    const nextGame = await prisma.game.findFirst({
      where: {
        status: "SCHEDULED",
        season: "2026-27",
        league: "NHL",
        OR: [{ homeTeamId: targetTeamId }, { awayTeamId: targetTeamId }],
      },
      orderBy: [{ round: "asc" }, { id: "asc" }],
      include: {
        homeTeam: { select: { id: true, name: true, code: true } },
        awayTeam: { select: { id: true, name: true, code: true } },
      },
    });

    let opponentBrief = "";
    if (nextGame) {
      const opp = nextGame.homeTeamId === targetTeamId ? nextGame.awayTeam : nextGame.homeTeam;
      const isHome = nextGame.homeTeamId === targetTeamId;
      const oppPlayers = await prisma.player.findMany({
        where: { teamId: opp.id, rosterType: "NHL", scratched: false },
        select: { name: true, position: true, overall: true, isGoalie: true },
        orderBy: { overall: "desc" },
        take: 5,
      });
      opponentBrief = `\nNAJBLIŽŠÍ ZÁPAS: Proti ${opp.name} (${opp.code || "OPP"}) [${isHome ? "DOMA" : "VONKU"}]
Kľúčoví hráči súpera: ${oppPlayers.map((p) => `${cleanName(p.name)} (${p.position}, OV: ${p.overall})`).join(", ")}`;
    }

    // Load Cap and Roster analysis
    const [capData, rosterAnalysis] = await Promise.all([
      loadLeagueCap().catch(() => null),
      analyzeRoster(targetTeamId).catch(() => null),
    ]);

    const teamCapHit = players.reduce((sum, p) => sum + liveCapHit(p), 0);
    const capCeiling = capData?.upper ?? 88_000_000;
    const capSpace = capCeiling - teamCapHit;

    // Identify weak and strong spots
    const criticalSlots = rosterAnalysis?.findings.filter((f) => f.severity === "critical").map((f) => f.label) || [];
    const strongSlots = rosterAnalysis?.findings.filter((f) => f.severity === "ok").map((f) => f.label) || [];

    // Pending Free Agents - ONLY unextended players in their final contract year!
    const pendingUnextended = players
      .filter((p) => p.contractYears === 1 && (!p.extYears || p.extYears === 0))
      .map((p) => `${cleanName(p.name)} (${p.position}, OV: ${p.overall}, plat: $${((p.capHit ?? 0) / 1_000_000).toFixed(2)}M - zatiaľ nepredĺžený, po sezóne UFA/RFA)`);

    // Secured Players who ALREADY signed a contract extension activating next season
    const signedExtensions = players
      .filter((p) => (p.extYears ?? 0) > 0)
      .map((p) => `${cleanName(p.name)} (${p.position}, OV: ${p.overall}, aktuálna zmluva končí, ALE UŽ MÁ OFICIÁLNE PODPÍSANÉ PREDĹŽENIE (EXTENSION) na ${p.extYears} ${p.extYears === 1 ? "rok" : (p.extYears ?? 0) < 5 ? "roky" : "rokov"} s platom $${(((p.extCapHit ?? 0)) / 1_000_000).toFixed(2)}M/rok od budúcej sezóny 2027-28!)`);

    // Top players summary with extension awareness
    const topSkaters = players
      .filter((p) => !p.isGoalie)
      .slice(0, 7)
      .map((p) => {
        const ext = (p.extYears ?? 0) > 0 ? ` [PREDĹŽENÝ na ${p.extYears}r za $${(((p.extCapHit ?? 0)) / 1_000_000).toFixed(2)}M od 2027-28]` : "";
        return `${cleanName(p.name)} (${p.position}, OV: ${p.overall}, Plat: $${((p.capHit ?? 0) / 1_000_000).toFixed(2)}M, zostáva ${p.contractYears}r)${ext}`;
      });

    const goalies = players
      .filter((p) => p.isGoalie)
      .map((p) => {
        const ext = (p.extYears ?? 0) > 0 ? ` [PREDĹŽENÝ na ${p.extYears}r za $${(((p.extCapHit ?? 0)) / 1_000_000).toFixed(2)}M od 2027-28]` : "";
        return `${cleanName(p.name)} (OV: ${p.overall}, Plat: $${((p.capHit ?? 0) / 1_000_000).toFixed(2)}M, zostáva ${p.contractYears}r)${ext}`;
      });

    const userQuestion = body.question?.trim() || "";
    const focus = body.focus || "general";

    let systemInstruction = "";
    let prompt = "";

    if (lang === "cs") {
      systemInstruction = `Si elitný strategický hokejový poradca a riaditeľ hokejových operácií pre tím ${team.name} v profesionálnej online NHL GM lige (UNHL).
Tvojou úlohou je poskytnúť generálnemu manažérovi (GM) hlboký, expertný, realistický a nekompromisne vecný rozbor v SLOVENSKOM JAZYKU.
Píš štruktúrovane, profesionálne a pútavo v štýle špičkového NHL analytika (The Athletic / TSN Insider).
Používaj odrážky, tučné písmo, jasné odporúčania a konkrétne kroky. Nepoužívaj zbytočnú vatu.`;

      prompt = `
DÁTA KLUBU ${team.name} (${team.code || "NHL"}):
- Celkový platový rozpočet (Cap Hit): $${(teamCapHit / 1_000_000).toFixed(2)}M / Strop: $${(capCeiling / 1_000_000).toFixed(2)}M
- Voľný platový priestor (Cap Space): $${(capSpace / 1_000_000).toFixed(2)}M
- Slabé miesta v zostave (Role Score pod priemerom ligy): ${criticalSlots.join(", ") || "Žiadne kritické slabiny"}
- Silné stránky v zostave: ${strongSlots.join(", ") || "Vyrovnaný káder"}
- Kľúčoví hráči:
${topSkaters.map((s) => `  • ${s}`).join("\n")}
- Brankári:
${goalies.map((g) => `  • ${g}`).join("\n")}

STAV ZMLÚV A PREDĹŽENÍ (EXTENSIONS):
- UŽ PODPÍSANÉ PREDĹŽENIA ZMLÚV (títo hráči UŽ MAJÚ novú zmluvu na ďalšie roky, neodídu zadarmo!):
${signedExtensions.length ? signedExtensions.map((e) => `  • ${e}`).join("\n") : "  • Zatiaľ žiadne podpísané predĺženia na ďalšiu sezónu"}

- ZATIAĽ NEPREDĹŽENÍ HRÁČI S KONČIACOU ZMLUVOU (toto sú jediní hráči, ktorých treba riešiť - predĺžiť alebo vymeniť):
${pendingUnextended.length ? pendingUnextended.map((f) => `  • ${f}`).join("\n") : "  • Žiadne urgentné končiace zmluvy bez krytia"}
${opponentBrief}

STRIKTNÉ PRAVIDLÁ PRE ROZBOR ZMLÚV:
1. Hráči uvedení v sekcii "UŽ PODPÍSANÉ PREDĹŽENIA ZMLÚV" (napr. tí, čo majú EXTENSION) už novú zmluvu majú! NIKDY nenavrhuj ich predĺženie a netvrď, že po sezóne odídu zadarmo, pretože sú už bezpečne zazmluvnení. Ak ich spomenieš, vyzdvihni ich zazmluvnenie ako stabilitu klubu.
2. Ako reálne končiace zmluvy na riešenie (predĺžiť vs vymeniť pred uzávierkou) analyzuj VÝHRADNE hráčov zo zoznamu "ZATIAĽ NEPREDĹŽENÍ HRÁČI".

OTÁZKA / POŽIADAVKA MANAŽÉRA:
${userQuestion ? `"${userQuestion}"` : "Urob celkový strategický audit kádra, pomenuj kľúčové diery a odporuč 3 konkrétne manažérske kroky pred ďalšou fázou sezóny."}

Zameranie: ${focus}

Priprav pre mňa detailný rozbor s týmito bodmi:
1. 📊 Diagnóza a stav tímu (kde sa klub nachádza)
2. 🚨 Kritické slabiny a kde nás tlačí topánka
3. 💼 Odporúčané prestupové ťahy a zmluvná stratégia (Trade & Cap stratégia)
4. 🏒 Taktické a personálne odporúčanie pre trénera (vrátane prípravy na najbližšieho súpera, ak je známy)
`;
    } else {
      systemInstruction = `You are an elite Senior Director of Hockey Operations and Strategic Advisor for ${team.name} in the professional UNHL GM league.
Provide an expert, realistic, and candid briefing for the General Manager in ENGLISH (The Athletic / TSN style).
Use structured markdown, bullet points, clear recommendations, and direct actionable advice.`;

      prompt = `
CLUB DATA FOR ${team.name} (${team.code || "NHL"}):
- Total Cap Hit: $${(teamCapHit / 1_000_000).toFixed(2)}M / Upper Limit: $${(capCeiling / 1_000_000).toFixed(2)}M
- Cap Space: $${(capSpace / 1_000_000).toFixed(2)}M
- Roster Vulnerabilities (below league average role scores): ${criticalSlots.join(", ") || "None"}
- Roster Strengths: ${strongSlots.join(", ") || "Balanced lineup"}
- Key Skaters:
${topSkaters.map((s) => `  • ${s}`).join("\n")}
- Goaltenders:
${goalies.map((g) => `  • ${g}`).join("\n")}

CONTRACT & EXTENSION STATUS:
- ALREADY SECURED EXTENSIONS (These players have ALREADY signed valid future contract extensions activating next season! They are NOT leaving):
${signedExtensions.length ? signedExtensions.map((e) => `  • ${e}`).join("\n") : "  • None currently secured"}

- PENDING UNEXTENDED EXPIRING DEALS (Only these players are pending free agents who need extension or trade):
${pendingUnextended.length ? pendingUnextended.map((f) => `  • ${f}`).join("\n") : "  • None"}
${opponentBrief}

STRICT CONTRACT INTEGRITY RULES:
1. Players listed under "ALREADY SECURED EXTENSIONS" already signed their new deals! NEVER propose extending them or state they will walk as free agents. Praise the extension or factor their future cap hit into planning.
2. Only address players in "PENDING UNEXTENDED EXPIRING DEALS" as contract priorities to extend or trade before the deadline.

GM REQUEST / QUESTION:
${userQuestion ? `"${userQuestion}"` : "Provide a comprehensive roster audit, highlight key vulnerabilities, and suggest 3 actionable GM moves."}

Focus: ${focus}

STRUCTURE:
1. 📊 Team Diagnosis & Trajectory
2. 🚨 Critical Vulnerabilities & Role Score Gaps
3. 💼 Trade & Salary Cap Strategy (Respecting signed extensions)
4. 🏒 Coaching & Tactical Adjustments (including next opponent game plan)
`;
    }

    const response = await generateWithGemini({
      prompt,
      systemInstruction,
      temperature: 0.35,
      maxTokens: 3000,
    });

    return NextResponse.json({
      success: true,
      teamId: targetTeamId,
      teamName: team.name,
      lang,
      model: response.modelUsed,
      tokensUsed: response.tokensUsed,
      analysis: response.text,
    });
  } catch (error) {
    console.error("[Gemini Advisor API Error]", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
