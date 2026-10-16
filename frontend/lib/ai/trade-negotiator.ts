import { generateWithGemini } from "./gemini";
import type { Lang } from "@/lib/i18n";

export type TradeDmParams = {
  aiName: string;
  humanName: string;
  action: "accept" | "decline" | "counter";
  tradeId: number;
  dt?: {
    aiGets?: string[] | number;
    aiGives?: string[] | number;
    star?: string;
    franchise?: string;
    prospectNote?: string;
    contention?: string;
    ratio?: number;
    need?: number;
    counterNote?: string;
  };
  lang?: Lang;
};

export async function generateTradeDm(params: TradeDmParams): Promise<string> {
  const { aiName, humanName, action, tradeId, dt, lang = "cs" } = params;
  const isEnglish = lang !== "cs";

  // Fallback template builder if Gemini is unavailable
  const fallback = () => {
    if (!isEnglish) {
      if (action === "accept") {
        return `✅ ${aiName} prijal tvoju ponuku na výmenu (#${tradeId}). Prestup bol oficiálne zrealizovaný a potvrdený ligou.`;
      }
      if (action === "counter") {
        return `🔄 ${aiName} ti posiela protiponuku na výmenu (#${tradeId}). ${dt?.counterNote ? `Poznámka: ${dt.counterNote}` : "Ponuka bola blízko, ale potrebovali sme ju mierne dorovnať."} Otvor si detail výmeny pre schválenie.`;
      }
      // decline
      const piece = dt?.franchise
        ? ` ${dt.franchise} je naším kľúčovým hráčom organizácie a nevzdáme sa ho bez výrazného preplatenia.`
        : dt?.star
        ? ` ${dt.star} je pre náš káder príliš dôležitý na to, aby sme ho pustili za túto protihodnotu.`
        : "";
      return `❌ ${aiName} odmieta tvoju ponuku na výmenu (#${tradeId}).${piece} Ponuka nezodpovedala našim aktuálnym potrebám a hodnote kádra.`;
    } else {
      if (action === "accept") {
        return `✅ ${aiName} accepted your trade (#${tradeId}). The deal has been finalized.`;
      }
      if (action === "counter") {
        return `🔄 ${aiName} sent you a counter-offer on #${tradeId}. ${dt?.counterNote ?? "We'd need a bit more."} Review and accept or decline.`;
      }
      const piece = dt?.franchise
        ? ` ${dt.franchise} is a cornerstone for us — it'd take a serious overpay.`
        : dt?.star
        ? ` ${dt.star} is a big piece for us.`
        : "";
      return `❌ ${aiName} passed on your offer (#${tradeId}).${piece} Come back with a stronger proposal.`;
    }
  };

  if (!process.env.GEMINI_API_KEY) {
    return fallback();
  }

  try {
    let promptContext = "";
    let systemInstruction = "";
    let userPrompt = "";

    if (isEnglish) {
      promptContext = `
SENDER (AI GM): ${aiName}
RECIPIENT (Opposing GM): ${humanName}
ACTION: ${action.toUpperCase()}
TRADE PROPOSAL: #${tradeId}
AI TEAM CONTEXT: ${dt?.contention === "contender" ? "Contending for Stanley Cup" : dt?.contention === "rebuild" ? "Rebuilding & acquiring draft picks" : "Balanced team"}
ASSETS AI GIVES UP: ${Array.isArray(dt?.aiGives) ? dt.aiGives.join(", ") : dt?.aiGives ?? "Players/picks"}
ASSETS AI RECEIVES: ${Array.isArray(dt?.aiGets) ? dt.aiGets.join(", ") : dt?.aiGets ?? "Players/picks"}
PROTECTED STAR INVOLVED: ${dt?.franchise || dt?.star || "None"}
COUNTER-OFFER NOTE: ${dt?.counterNote || "N/A"}
`;

      systemInstruction = `You are the General Manager of ${aiName} in the UNHL online hockey league.
CRITICAL LANGUAGE REQUIREMENT: You MUST write the message entirely in standard ENGLISH. Never output Slovak or Czech.
Write a concise (2-3 sentences), authentic direct message to the GM of ${humanName} regarding trade proposal #${tradeId}.
Tone:
- Direct, professional hockey GM style.
- If DECLINE, explain candidly why the offer falls short (e.g., protecting a star, or looking for younger assets/picks).
- If COUNTER, explain what was missing in the original offer.
- If ACCEPT, express satisfaction with closing the deal.
Start with the appropriate icon (❌ for decline, 🔄 for counter, ✅ for accept) and reference #${tradeId}.`;

      userPrompt = `${promptContext}\n\nWrite the direct message entirely in ENGLISH according to the instructions:`;
    } else {
      promptContext = `
ODOSIELATEĽ (AI GM): ${aiName}
ADRESÁT (Manažér): ${humanName}
AKCIA: ${action.toUpperCase()}
ČÍSLO PONUKY: #${tradeId}
TÍMOVÁ STRATÉGIA AI: ${dt?.contention === "contender" ? "Boj o Stanley Cup (Contender)" : dt?.contention === "rebuild" ? "Prestavba kádra a zber draftov (Rebuild)" : "Vyvážený tím"}
HRÁČI NA PREDAJ: ${Array.isArray(dt?.aiGives) ? dt.aiGives.join(", ") : dt?.aiGives ?? "Hráči/výbery"}
HRÁČI V PONUKE: ${Array.isArray(dt?.aiGets) ? dt.aiGets.join(", ") : dt?.aiGets ?? "Hráči/výbery"}
CHÁNENÁ HVIEZDA: ${dt?.franchise || dt?.star || "Nie"}
POZNÁMKA K PROTIPONUKE: ${dt?.counterNote || "N/A"}
`;

      systemInstruction = `Si generálny manažér tímu ${aiName} v hokejovej lige UNHL.
DÔLEŽITÁ JAZYKOVÁ POŽIADAVKA: Celá správa MUSÍ byť napísaná v SLOVENČINE (resp. češtine).
Tvojou úlohou je napísať krátku (2-3 vety), autentickú a realistickú správu generálnemu manažérovi tímu ${humanName} do internej ligovej pošty ohľadom výmeny #${tradeId}.
Tón:
- Profesionálny, priamy, manažérsky hokejový štýl.
- Ak odmietaš (DECLINE), vysvetli diplomaticky ale rázne, prečo ponuka nestačí (či chrániš svoju hviezdu, alebo to neladí s prestavbou/plánom klubu).
- Ak posielaš protiponuku (COUNTER), vysvetli, čo ti v pôvodnej ponuke chýbalo a prečo je protiponuka férová.
- Ak prijímaš (ACCEPT), poďakuj za férové rokovanie.
Začni príslušnou ikonou (❌ pri odmietnutí, 🔄 pri protiponuke, ✅ pri prijatí) a uveď číslo ponuky #${tradeId}.`;

      userPrompt = `${promptContext}\n\nNapíš správu do pošty pre manažéra v slovenčine:`;
    }

    const aiRes = await generateWithGemini(userPrompt, {
      systemInstruction,
      temperature: 0.7,
      maxTokens: 300,
    });

    return aiRes.text.trim() || fallback();
  } catch (err) {
    console.error("Failed to generate AI trade DM:", err);
    return fallback();
  }
}
