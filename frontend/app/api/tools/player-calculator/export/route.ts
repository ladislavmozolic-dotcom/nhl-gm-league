import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getLiveCalculatorConfig } from "@/lib/live-calculator-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [players, config, teams] = await Promise.all([
      prisma.player.findMany({
        where: { isGoalie: false, rosterType: { in: ["NHL", "AHL"] } },
        select: {
          id: true,
          slug: true,
          name: true,
          position: true,
          teamId: true,
          rosterType: true,
          age: true,
          number: true,
          nhlId: true,
          ck: true,
          fg: true,
          di: true,
          sk: true,
          st: true,
          en: true,
          du: true,
          ph: true,
          fo: true,
          pa: true,
          sc: true,
          df: true,
          ps: true,
          ex: true,
          ld: true,
          mo: true,
          morale: true,
          overall: true,
          lastSeasonGP: true,
          curSeasonGP: true,
          careerGP: true,
          liveCalculatorRatings: true,
          team: {
            select: {
              code: true,
              name: true,
            },
          },
        },
        orderBy: [{ overall: "desc" }, { name: "asc" }],
      }),
      getLiveCalculatorConfig(),
      prisma.team.findMany({
        select: { id: true, code: true, name: true },
      }),
    ]);

    const teamCodeById = new Map<number, string>();
    teams.forEach((t) => {
      if (t.code) teamCodeById.set(t.id, t.code);
    });

    // 1. Prepare NHL_PLAYERS
    const nhlAoa: any[][] = [
      ["NHL PLAYERS — V10 live model"],
      ["NHL bucket = latest NHL GP >=10 OR previous NHL GP >=10. Vypočítané Live parametre V10."],
      [],
      [
        "Player",
        "Team",
        "Pos",
        "NHL ID",
        "League bucket",
        "NHL GP latest",
        "NHL GP previous",
        "AHL GP latest",
        "AHL GP previous",
        "Data status",
        "CK",
        "FG",
        "DI",
        "SK",
        "ST",
        "EN",
        "DU",
        "PH",
        "FO",
        "PA",
        "SC",
        "DF",
        "PS",
        "EX",
        "LD",
        "MO",
        "OV",
      ],
    ];

    // 2. Prepare AHL_PLAYERS
    const ahlAoa: any[][] = [
      ["AHL / FARM PLAYERS — V10 (PA/SC zohľadňuje NHL GP)"],
      [
        "Hráči s NHL GP podľa pravidla majú PA/SC na úrovni NHL. Chýbajúce GP ≠ 0; pri neoverených údajoch zostanú pôvodné hodnoty.",
      ],
      [],
      [
        "Player",
        "Team",
        "Pos",
        "NHL ID",
        "League bucket",
        "NHL GP latest",
        "NHL GP previous",
        "AHL GP latest",
        "AHL GP previous",
        "Data status",
        "CK",
        "FG",
        "DI",
        "SK",
        "ST",
        "EN",
        "DU",
        "PH",
        "FO",
        "PA",
        "SC",
        "DF",
        "PS",
        "EX",
        "LD",
        "MO",
        "OV",
        "PA pred V9",
        "SC pred V9",
        "NHL kariéra GP (overené)",
        "Skupina PA/SC V10",
        "PA rozdiel",
        "SC rozdiel",
      ],
    ];

    for (const p of players) {
      const live = (p.liveCalculatorRatings as any) ?? {};
      const isAhl = live.classification === "AHL/FARM" || (p.rosterType === "AHL" && live.classification !== "NHL");
      const teamCode = p.team?.code ?? (p.teamId ? teamCodeById.get(p.teamId) ?? "" : "");

      const nhlGpLatest = live.nhlGpLatest != null ? live.nhlGpLatest : (p.curSeasonGP ?? "");
      const nhlGpPrev = live.nhlGpPrevious != null ? live.nhlGpPrevious : (p.lastSeasonGP ?? "");
      const ahlGpLatest = live.ahlGpLatest != null ? live.ahlGpLatest : "";
      const ahlGpPrev = live.ahlGpPrevious != null ? live.ahlGpPrevious : "";

      const prj = live.projected ?? {};
      const act = live.actual ?? {};

      const ck = prj.ck ?? p.ck ?? "";
      const fg = prj.fg ?? p.fg ?? "";
      const di = prj.di ?? p.di ?? "";
      const sk = prj.sk ?? p.sk ?? "";
      const st = prj.st ?? p.st ?? "";
      const en = prj.en ?? p.en ?? "";
      const du = prj.du ?? p.du ?? "";
      const ph = prj.ph ?? p.ph ?? "";
      const fo = prj.fo ?? p.fo ?? "";
      const pa = prj.pa ?? p.pa ?? "";
      const sc = prj.sc ?? p.sc ?? "";
      const df = prj.df ?? p.df ?? "";
      const ps = prj.ps ?? p.ps ?? "";
      const ex = prj.ex ?? p.ex ?? "";
      const ld = prj.ld ?? p.ld ?? "";
      const mo = p.morale != null ? Math.round(p.morale) : (p.mo ?? 50);
      const ov = live.overallProjected ?? p.overall ?? "";

      const statusText = live.status ?? (isAhl ? "AHL pravidlo" : "NHL pravidlo");

      if (!isAhl) {
        nhlAoa.push([
          p.name,
          teamCode,
          p.position ?? "",
          p.nhlId ?? "",
          "NHL",
          nhlGpLatest,
          nhlGpPrev,
          ahlGpLatest,
          ahlGpPrev,
          statusText,
          ck,
          fg,
          di,
          sk,
          st,
          en,
          du,
          ph,
          fo,
          pa,
          sc,
          df,
          ps,
          ex,
          ld,
          mo,
          ov,
        ]);
      } else {
        const paOld = act.pa ?? p.pa ?? "";
        const scOld = act.sc ?? p.sc ?? "";
        const careerReg = (p.careerGP as any)?.reg ?? "";
        const paDiff = pa && paOld ? Number(pa) - Number(paOld) : 0;
        const scDiff = sc && scOld ? Number(sc) - Number(scOld) : 0;
        const groupLabel = statusText.includes("AHL_NHL_PROTECTION")
          ? "OVERENÉ_NHL_GP"
          : (Number(nhlGpLatest) > 0 ? "AKTÍVNA_NHL" : "FARM_LEN");

        ahlAoa.push([
          p.name,
          teamCode,
          p.position ?? "",
          p.nhlId ?? "",
          "AHL/FARM",
          nhlGpLatest,
          nhlGpPrev,
          ahlGpLatest,
          ahlGpPrev,
          statusText,
          ck,
          fg,
          di,
          sk,
          st,
          en,
          du,
          ph,
          fo,
          pa,
          sc,
          df,
          ps,
          ex,
          ld,
          mo,
          ov,
          paOld,
          scOld,
          careerReg,
          groupLabel,
          paDiff,
          scDiff,
        ]);
      }
    }

    // 3. Prepare CONFIG_V10 info sheet
    const cfgAoa: any[][] = [
      ["UNHL Live Calculator — Konfigurácia & Parametre"],
      [],
      ["Parameter", "Hodnota"],
      ["Aktuálna sezóna", config.latestSeason],
      ["Predošlá sezóna", config.previousSeason],
      ["Váha aktuálnej sezóny", `${(config.latestWeight * 100).toFixed(0)} %`],
      ["Váha predošlej sezóny", `${(config.previousWeight * 100).toFixed(0)} %`],
      ["Min. GP aktuálna sezóna (NHL prah)", config.nhlGpLatestMin],
      ["Min. GP predošlá sezóna (NHL prah)", config.nhlGpPrevMin],
      ["AHL NHLe faktor aktuálny", config.ahlNhleLatest],
      ["AHL NHLe faktor predošlý", config.ahlNhlePrevious],
      [
        "Posledný prepočet",
        config.lastCalculatedAt ? new Date(config.lastCalculatedAt).toLocaleString("sk-SK") : "Nikdy",
      ],
      [
        "Posledná synchronizácia",
        config.lastSyncedAt ? new Date(config.lastSyncedAt).toLocaleString("sk-SK") : "Nikdy",
      ],
      [],
      ["VÁHY KOMPONENTOV:"],
      ["Passing (PA)", `A/GP: ${config.weights.pa.apg}, A60 All: ${config.weights.pa.a60All}, A60 5v5: ${config.weights.pa.a60_5v5}`],
      ["Scoring (SC)", `G/GP: ${config.weights.sc.gpg}, G60: ${config.weights.sc.g60}, xG60: ${config.weights.sc.xg60}, Fin: ${config.weights.sc.g_xg60}`],
      ["Defense (DF) Obrancovia", `PK TOI: ${config.weights.dfD.pkToiPg}, xGA: ${config.weights.dfD.xga5}, Rel xGA: ${config.weights.dfD.relXga5}, GA: ${config.weights.dfD.ga5}, Rel xGA PK: ${config.weights.dfD.relXgaPk}, Blk: ${config.weights.dfD.blk60}, xGF%: ${config.weights.dfD.xgfPct}`],
      ["Defense (DF) Útočníci", `PK TOI: ${config.weights.dfF.pkToiPg}, Rel xGA PK: ${config.weights.dfF.relXgaPk}, Rel xGA: ${config.weights.dfF.relXga5}, xGA: ${config.weights.dfF.xga5}, GA: ${config.weights.dfF.ga5}, xGF%: ${config.weights.dfF.xgfPct}, Blk: ${config.weights.dfF.blk60}`],
      ["Checking (CK)", `Hits/60: ${config.weights.ck.hit60}, Hits/GP: ${config.weights.ck.hitPg}`],
      ["Discipline (DI)", `Pen Bal: ${config.weights.di.penaltyBalance}, invPIM: ${config.weights.di.invPim60}`],
      ["Skating (SK)", `Bursts >20mph: ${config.weights.sk.edgeBursts20}`],
      ["Strength (ST)", `Weight %: ${config.weights.st.weightPct}`],
      ["Experience (EX)", `Reg GP: ${config.weights.ex.careerRegGP}, PO GP: ${config.weights.ex.careerPoGP}`],
    ];

    // Build workbook
    const wb = XLSX.utils.book_new();
    const wsNhl = XLSX.utils.aoa_to_sheet(nhlAoa);
    const wsAhl = XLSX.utils.aoa_to_sheet(ahlAoa);
    const wsCfg = XLSX.utils.aoa_to_sheet(cfgAoa);

    // Set simple column widths
    wsNhl["!cols"] = [
      { wch: 24 }, // Player
      { wch: 8 },  // Team
      { wch: 6 },  // Pos
      { wch: 10 }, // NHL ID
      { wch: 14 }, // Bucket
      { wch: 14 }, // GP latest
      { wch: 14 }, // GP prev
      { wch: 14 }, // AHL latest
      { wch: 14 }, // AHL prev
      { wch: 35 }, // Status
      ...Array(17).fill({ wch: 6 }), // Ratings
    ];

    wsAhl["!cols"] = [
      { wch: 24 },
      { wch: 8 },
      { wch: 6 },
      { wch: 10 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 35 },
      ...Array(17).fill({ wch: 6 }),
      { wch: 12 },
      { wch: 12 },
      { wch: 16 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
    ];

    wsCfg["!cols"] = [{ wch: 28 }, { wch: 70 }];

    XLSX.utils.book_append_sheet(wb, wsNhl, "NHL_PLAYERS");
    XLSX.utils.book_append_sheet(wb, wsAhl, "AHL_PLAYERS");
    XLSX.utils.book_append_sheet(wb, wsCfg, "CONFIG_V10");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const filename = `UNHL_Live_Player_Ratings_V10_${new Date().toISOString().split("T")[0]}.xlsx`;

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("[LiveCalcExport] Error generating excel:", err);
    return NextResponse.json({ error: err.message || "Failed to generate Excel" }, { status: 500 });
  }
}
