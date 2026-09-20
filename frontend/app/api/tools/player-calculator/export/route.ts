import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getLiveCalculatorConfig } from "@/lib/live-calculator-config";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const teamSlug = searchParams.get("team");

    let targetTeamIds: number[] | null = null;
    if (teamSlug && teamSlug !== "all") {
      const t = await prisma.team.findFirst({
        where: { slug: teamSlug },
        include: { affiliateTeams: { select: { id: true } } },
      });
      if (t) {
        targetTeamIds = [t.id, ...(t.affiliateTeams?.map((a) => a.id) ?? [])];
      }
    }

    const [players, goalies, config, teams] = await Promise.all([
      prisma.player.findMany({
        where: {
          isGoalie: false,
          rosterType: { in: ["NHL", "AHL"] },
          ...(targetTeamIds ? { teamId: { in: targetTeamIds } } : {}),
        },
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
      prisma.player.findMany({
        where: {
          isGoalie: true,
          rosterType: { in: ["NHL", "AHL"] },
          ...(targetTeamIds ? { teamId: { in: targetTeamIds } } : {}),
        },
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
          overall: true,
          lastSeasonGP: true,
          curSeasonGP: true,
          careerGP: true,
          liveCalculatorRatings: true,
          goalieRating: {
            select: {
              sk: true, du: true, en: true, sz: true, ag: true, rb: true,
              sc: true, hs: true, rt: true, ph: true, ps: true, ex: true,
              ld: true, mo: true, overall: true,
            },
          },
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

    // 3. Prepare NHL_GOALIES
    const nhlGoaliesAoa: any[][] = [
      ["NHL GOALIES — V10 live model"],
      ["Brankári v NHL. Vypočítané Live parametre V10 (MoneyPuck & NHL API)."],
      [],
      [
        "Player",
        "Team",
        "Pos",
        "NHL ID",
        "Age",
        "League bucket",
        "NHL GP latest",
        "NHL GP previous",
        "Data status",
        "SK",
        "DU",
        "EN",
        "SZ",
        "AG",
        "RB",
        "SC",
        "HS",
        "RT",
        "PH",
        "PS",
        "EX",
        "LD",
        "MO",
        "OV nový",
        "OV baseline",
        "OV rozdiel",
        "SV%",
        "GAA",
        "GSAx",
        "GSAx/60",
        "HD SV%",
        "MD SV%",
        "LD SV%",
        "RebCtrl",
        "Freeze %",
        "TOI min",
        "SA",
        "GA",
        "xGA",
        "Kariéra ZČ",
        "Kariéra PO",
      ],
    ];

    // 4. Prepare AHL_GOALIES
    const ahlGoaliesAoa: any[][] = [
      ["AHL / FARM GOALIES — V10 live model"],
      ["Brankári v AHL/FARM tímoch. Live parametre V10."],
      [],
      [
        "Player",
        "Team",
        "Pos",
        "NHL ID",
        "Age",
        "League bucket",
        "NHL GP latest",
        "NHL GP previous",
        "Data status",
        "SK",
        "DU",
        "EN",
        "SZ",
        "AG",
        "RB",
        "SC",
        "HS",
        "RT",
        "PH",
        "PS",
        "EX",
        "LD",
        "MO",
        "OV nový",
        "OV baseline",
        "OV rozdiel",
        "SV%",
        "GAA",
        "GSAx",
        "GSAx/60",
        "HD SV%",
        "MD SV%",
        "LD SV%",
        "RebCtrl",
        "Freeze %",
        "TOI min",
        "SA",
        "GA",
        "xGA",
        "Kariéra ZČ",
        "Kariéra PO",
      ],
    ];

    for (const g of goalies) {
      const live = (g.liveCalculatorRatings as any) ?? {};
      const isAhl = live.classification === "AHL/FARM" || (g.rosterType === "AHL" && live.classification !== "NHL");
      const teamCode = g.team?.code ?? (g.teamId ? teamCodeById.get(g.teamId) ?? "" : "");

      const nhlGpLatest = live.nhlGpLatest != null ? live.nhlGpLatest : (g.curSeasonGP ?? "");
      const nhlGpPrev = live.nhlGpPrevious != null ? live.nhlGpPrevious : (g.lastSeasonGP ?? "");
      const gr: any = g.goalieRating ?? {};
      const prj = live.projected ?? {};
      const act = live.actual ?? {};

      const sk = prj.sk ?? gr.sk ?? "";
      const du = prj.du ?? gr.du ?? "";
      const en = prj.en ?? gr.en ?? "";
      const sz = prj.sz ?? gr.sz ?? "";
      const ag = prj.ag ?? gr.ag ?? "";
      const rb = prj.rb ?? gr.rb ?? "";
      const sc = prj.sc ?? gr.sc ?? "";
      const hs = prj.hs ?? gr.hs ?? "";
      const rt = prj.rt ?? gr.rt ?? "";
      const ph = prj.ph ?? gr.ph ?? "";
      const ps = prj.ps ?? gr.ps ?? "";
      const ex = prj.ex ?? gr.ex ?? "";
      const ld = prj.ld ?? gr.ld ?? "";
      const mo = act.mo ?? gr.mo ?? ""; // Morale untouched
      const ovNew = live.overallProjected ?? gr.overall ?? g.overall ?? "";
      const ovOld = gr.overall ?? g.overall ?? "";
      const ovDiff = ovNew && ovOld ? Number(ovNew) - Number(ovOld) : 0;
      const ovDiffText = ovDiff > 0 ? `+${ovDiff}` : (ovDiff < 0 ? String(ovDiff) : "0");

      const stats = live.stats ?? {};
      const svPct = stats.svPct != null ? (stats.svPct * 100).toFixed(1) + " %" : "";
      const gaa = stats.gaa != null ? stats.gaa.toFixed(2) : "";
      const gsax = stats.gsax != null ? stats.gsax.toFixed(1) : "";
      const gsax60 = stats.gsax60 != null ? stats.gsax60.toFixed(2) : "";
      const hdSv = stats.hdSv != null ? (stats.hdSv * 100).toFixed(1) + " %" : "";
      const mdSv = stats.mdSv != null ? (stats.mdSv * 100).toFixed(1) + " %" : "";
      const ldSv = stats.ldSv != null ? (stats.ldSv * 100).toFixed(1) + " %" : "";
      const rebCtrl = stats.rebCtrl != null ? stats.rebCtrl.toFixed(3) : "";
      const freezePct = stats.freezePct != null ? (stats.freezePct * 100).toFixed(1) + " %" : "";
      const toiMin = stats.icetime != null ? Math.round(stats.icetime / 60) : "";
      const sa = stats.shots != null ? stats.shots : "";
      const ga = stats.goals != null ? stats.goals : "";
      const xga = stats.xGoals != null ? stats.xGoals.toFixed(1) : "";
      const carReg = (g.careerGP as any)?.reg ?? "";
      const carPo = (g.careerGP as any)?.po ?? "";

      const row = [
        g.name,
        teamCode,
        g.position || "G",
        g.nhlId ?? "",
        g.age ?? "",
        live.classification ?? (g.rosterType ?? "NHL"),
        nhlGpLatest,
        nhlGpPrev,
        live.status ?? "STHS Baseline",
        sk,
        du,
        en,
        sz,
        ag,
        rb,
        sc,
        hs,
        rt,
        ph,
        ps,
        ex,
        ld,
        mo,
        ovNew,
        ovOld,
        ovDiffText,
        svPct,
        gaa,
        gsax,
        gsax60,
        hdSv,
        mdSv,
        ldSv,
        rebCtrl,
        freezePct,
        toiMin,
        sa,
        ga,
        xga,
        carReg,
        carPo,
      ];

      if (isAhl) ahlGoaliesAoa.push(row);
      else nhlGoaliesAoa.push(row);
    }

    // 5. Prepare CONFIG_V10 info sheet
    const cfgAoa: any[][] = [
      ["UNHL Live Calculator — Konfigurácia & Parametre"],
      [],
      ["Parameter", "Hodnota"],
      ["Filter tímov", targetTeamIds ? (teamSlug?.toUpperCase() ?? "Vybraný tím") : "Všetky tímy ligy (ALL)"],
      ["Aktuálna sezóna", config.latestSeason],
      ["Predošlá sezóna", config.previousSeason],
      ["Váha aktuálnej sezóny", `${(config.latestWeight * 100).toFixed(1).replace(/\.0$/, "")} %`],
      ["Váha predošlej sezóny", `${(config.previousWeight * 100).toFixed(1).replace(/\.0$/, "")} %`],
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
      ["VÁHY KOMPONENTOV (KORČULIARI):"],
      ["Passing (PA)", `A/GP: ${config.weights.pa.apg}, A60 All: ${config.weights.pa.a60All}, A60 5v5: ${config.weights.pa.a60_5v5}`],
      ["Scoring (SC)", `G/GP: ${config.weights.sc.gpg}, G60: ${config.weights.sc.g60}, xG60: ${config.weights.sc.xg60}, Fin: ${config.weights.sc.g_xg60}`],
      ["Defense (DF) Obrancovia", `PK TOI: ${config.weights.dfD.pkToiPg}, xGA: ${config.weights.dfD.xga5}, Rel xGA: ${config.weights.dfD.relXga5}, GA: ${config.weights.dfD.ga5}, Rel xGA PK: ${config.weights.dfD.relXgaPk}, Blk: ${config.weights.dfD.blk60}, xGF%: ${config.weights.dfD.xgfPct}`],
      ["Defense (DF) Útočníci", `PK TOI: ${config.weights.dfF.pkToiPg}, Rel xGA PK: ${config.weights.dfF.relXgaPk}, Rel xGA: ${config.weights.dfF.relXga5}, xGA: ${config.weights.dfF.xga5}, GA: ${config.weights.dfF.ga5}, xGF%: ${config.weights.dfF.xgfPct}, Blk: ${config.weights.dfF.blk60}`],
      ["Checking (CK)", `Hits/60: ${config.weights.ck.hit60}, Hits/GP: ${config.weights.ck.hitPg}`],
      ["Discipline (DI)", `Pen Bal: ${config.weights.di.penaltyBalance}, invPIM: ${config.weights.di.invPim60}`],
      ["Skating (SK)", `Bursts >20mph: ${config.weights.sk.edgeBursts20}`],
      ["Strength (ST)", `Weight %: ${config.weights.st.weightPct}`],
      ["Experience (EX)", `Reg GP: ${config.weights.ex.careerRegGP}, PO GP: ${config.weights.ex.careerPoGP}`],
      [],
      ["VÁHY KOMPONENTOV (BRANKÁRI):"],
      ["Style Control (SC)", `LD SV%: ${config.goalieWeights.sc.ldSv}, MD SV%: ${config.goalieWeights.sc.mdSv}, GSAx/60: ${config.goalieWeights.sc.gsax60}`],
      ["Reaction Time (RT)", `HD SV%: ${config.goalieWeights.rt.hdSv}, HD GSAx: ${config.goalieWeights.rt.hdGsax}`],
      ["Hand Speed (HS)", `HD SV%: ${config.goalieWeights.hs.hdSv}, GSAx/60: ${config.goalieWeights.hs.gsax60}`],
      ["Agility (AG)", `MD SV%: ${config.goalieWeights.ag.mdSv}, HD SV%: ${config.goalieWeights.ag.hdSv}`],
      ["Rebound Control (RB)", `RebCtrl: ${config.goalieWeights.rb.rebCtrl}`],
      ["Endurance (EN)", `Ice time: ${config.goalieWeights.en.icetime}`],
      ["Size (SZ)", `Výška: ${config.goalieWeights.sz.sz}`],
      ["Experience (EX)", `Reg GP: ${config.goalieWeights.ex.careerRegGP}, PO GP: ${config.goalieWeights.ex.careerPoGP}`],
    ];

    // Build workbook
    const wb = XLSX.utils.book_new();
    const wsNhl = XLSX.utils.aoa_to_sheet(nhlAoa);
    const wsNhlGoalies = XLSX.utils.aoa_to_sheet(nhlGoaliesAoa);
    const wsAhl = XLSX.utils.aoa_to_sheet(ahlAoa);
    const wsAhlGoalies = XLSX.utils.aoa_to_sheet(ahlGoaliesAoa);
    const wsCfg = XLSX.utils.aoa_to_sheet(cfgAoa);

    // Set column widths
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

    const goalieCols = [
      { wch: 24 }, // Player
      { wch: 8 },  // Team
      { wch: 6 },  // Pos
      { wch: 10 }, // NHL ID
      { wch: 6 },  // Age
      { wch: 14 }, // Bucket
      { wch: 14 }, // GP latest
      { wch: 14 }, // GP prev
      { wch: 25 }, // Status
      ...Array(14).fill({ wch: 6 }), // Ratings SK..MO
      { wch: 9 },  // OV nový
      { wch: 11 }, // OV baseline
      { wch: 11 }, // OV rozdiel
      { wch: 10 }, // SV%
      { wch: 8 },  // GAA
      { wch: 8 },  // GSAx
      { wch: 10 }, // GSAx/60
      { wch: 10 }, // HD SV%
      { wch: 10 }, // MD SV%
      { wch: 10 }, // LD SV%
      { wch: 10 }, // RebCtrl
      { wch: 10 }, // Freeze %
      { wch: 10 }, // TOI min
      { wch: 8 },  // SA
      { wch: 8 },  // GA
      { wch: 8 },  // xGA
      { wch: 12 }, // Kariéra ZČ
      { wch: 12 }, // Kariéra PO
    ];
    wsNhlGoalies["!cols"] = goalieCols;
    wsAhlGoalies["!cols"] = goalieCols;

    wsCfg["!cols"] = [{ wch: 28 }, { wch: 70 }];

    XLSX.utils.book_append_sheet(wb, wsNhl, "NHL_PLAYERS");
    XLSX.utils.book_append_sheet(wb, wsNhlGoalies, "NHL_GOALIES");
    XLSX.utils.book_append_sheet(wb, wsAhl, "AHL_PLAYERS");
    XLSX.utils.book_append_sheet(wb, wsAhlGoalies, "AHL_GOALIES");
    XLSX.utils.book_append_sheet(wb, wsCfg, "CONFIG_V10");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const prefix = targetTeamIds && teamSlug ? `UNHL_${teamSlug.toUpperCase()}` : "UNHL";
    const filename = `${prefix}_Live_Player_Ratings_V10_${new Date().toISOString().split("T")[0]}.xlsx`;

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
