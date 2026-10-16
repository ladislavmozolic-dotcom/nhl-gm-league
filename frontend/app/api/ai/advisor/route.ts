import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { analyzeRoster } from "@/lib/gm-assistant/analyzeRoster";
import { loadLeagueCap } from "@/lib/free-agency-server";
import { liveCapHit } from "@/lib/finance";
import { generateWithGemini, isGeminiConfigured } from "@/lib/ai/gemini";
import { cleanName } from "@/lib/playerName";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const sessionTeamId = await getTeamSession();
    const body = await req.json().catch(() => ({}));
    const targetTeamId = Number(body.teamId || sessionTeamId);

    if (!Number.isInteger(targetTeamId) || targetTeamId <= 0) {
      return NextResponse.json({ error: "Invalid team ID" }, { status: 400 });
    }

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
        age: true,
        isGoalie: true,
      },
      orderBy: { overall: "desc" },
    });

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

    // Pending Free Agents
    const pendingFreeAgents = players
      .filter((p) => p.contractYears === 1)
      .map((p) => `${cleanName(p.name)} (${p.position}, $${((p.capHit ?? 0) / 1_000_000).toFixed(2)}M)`);

    // Top players summary
    const topSkaters = players
      .filter((p) => !p.isGoalie)
      .slice(0, 6)
      .map((p) => `${cleanName(p.name)} (${p.position}, OV: ${p.overall}, Plat: $${((p.capHit ?? 0) / 1_000_000).toFixed(2)}M, Zmluva: ${p.contractYears}r)`);

    const goalies = players
      .filter((p) => p.isGoalie)
      .map((p) => `${cleanName(p.name)} (OV: ${p.overall}, Plat: $${((p.capHit ?? 0) / 1_000_000).toFixed(2)}M)`);

    const userQuestion = body.question?.trim() || "";
    const focus = body.focus || "general";

    const systemInstruction = `Si elitný strategický hokejový poradca a riaditeľ hokejových operácií pre tím ${team.name} v profesionálnej online NHL GM lige (UNHL).
Tvojou úlohou je poskytnúť generálnemu manažérovi (GM) hlboký, expertný, realistický a nekompromisne vecný rozbor v SLOVENSKOM JAZYKU.
Píš štruktúrovane, profesionálne a pútavo v štýle špičkového NHL analytika (The Athletic / TSN Insider).
Používaj odrážky, tučné písmo, jasné odporúčania a konkrétne kroky. Nepoužívaj zbytočnú vatu.`;

    const prompt = `
DÁTA KLUBU ${team.name} (${team.code || "NHL"}):
- Celkový platový rozpočet (Cap Hit): $${(teamCapHit / 1_000_000).toFixed(2)}M / Strop: $${(capCeiling / 1_000_000).toFixed(2)}M
- Voľný platový priestor (Cap Space): $${(capSpace / 1_000_000).toFixed(2)}M
- Slabé miesta v zostave (Role Score pod priemerom ligy): ${criticalSlots.join(", ") || "Žiadne kritické slabiny"}
- Silné stránky v zostave: ${strongSlots.join(", ") || "Vyrovnaný káder"}
- Kľúčoví hráči:
${topSkaters.map((s) => `  • ${s}`).join("\n")}
- Brankári:
${goalies.map((g) => `  • ${g}`).join("\n")}
- Hráči s končiacou zmluvou po tejto sezóne (pending FA):
${pendingFreeAgents.length ? pendingFreeAgents.map((f) => `  • ${f}`).join("\n") : "  • Žiadne urgentné končiace zmluvy"}

OTÁZKA / POŽIADAVKA MANAŽÉRA:
${userQuestion ? `"${userQuestion}"` : "Urob celkový strategický audit kádra, pomenuj kľúčové diery a odporuč 3 konkrétne manažérske kroky pred ďalšou fázou sezóny."}

Zameranie: ${focus}

Priprav pre mňa detailný rozbor s týmito bodmi:
1. 📊 Diagnóza a stav tímu (kde sa klub nachádza)
2. 🚨 Kritické slabiny a kde nás tlačí topánka
3. 💼 Odporúčané prestupové ťahy (Trade & Cap stratégia)
4. 🏒 Taktické a personálne odporúčanie pre trénera
`;

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
