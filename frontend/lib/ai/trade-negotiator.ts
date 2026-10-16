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

  // Fallback template builder if Gemini is unavailable
  const fallback = () => {
    if (lang === "cs") {
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
    const promptContext = `
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

    let systemInstruction = "";
    if (lang === "cs") {
      systemInstruction = `Si generálny manažér tímu ${aiName} v hokejovej lige UNHL.
Tvojou úlohou je napísať krátku (2-3 vety), autentickú a realistickú správu generálnemu manažérovi tímu ${humanName} do internej ligovej pošty ohľadom výmeny #${tradeId}.
Tón:
- Profesionálny, priamy, manažérsky hokejový štýl.
- Ak odmietaš (DECLINE), vysvetli diplomaticky ale rázne, prečo ponuka nestačí (či chrániš svoju hviezdu, alebo to neladí s prestavbou/plánom klubu).
- Ak posielaš protiponuku (COUNTER), vysvetli, čo ti v pôvodnej ponuke chýbalo a prečo je protiponuka férová.
- Ak prijímaš (ACCEPT), poďakuj za férové rokovanie.
Začni príslušnou ikonou (❌ pri odmietnutí, 🔄 pri protiponuke, ✅ pri prijatí) a uveď číslo ponuky #${tradeId}.
Píš v slovenčine bez zbytočnej omáčky.`;
    } else {
      systemInstruction = `You are the General Manager of ${aiName} in the UNHL hockey league.
Write a concise (2-3 sentences), authentic direct message to the GM of ${humanName} regarding trade proposal #${tradeId}.
Tone: direct, professional, hockey GM style. Start with ❌, 🔄, or ✅ and reference #${tradeId}.`;
    }

    const aiRes = await generateWithGemini(
      promptContext + "\n\nNapíš správu do pošty pre manažéra:",
      {
        systemInstruction,
        temperature: 0.7,
        maxTokens: 300,
      }
    );

    return aiRes.text.trim() || fallback();
  } catch (err) {
    console.error("Failed to generate AI trade DM:", err);
    return fallback();
  }
}
