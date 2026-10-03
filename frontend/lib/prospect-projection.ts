/**
 * A compact, explainable projection for real-world prospects.  It deliberately
 * uses only data we store in UNHL: draft capital, age and stat snapshots.  This
 * keeps the grade reproducible and avoids presenting a scraped scout opinion as
 * our own.  It is a decision aid, not a promise about the player.
 */
export type ProjectionGrade = "A" | "B" | "C" | "D" | "F";

export type ProjectionStat = {
  season?: string | null;
  isGoalie?: boolean;
  gamesPlayed?: number | null;
  goals?: number | null;
  assists?: number | null;
  points?: number | null;
  wins?: number | null;
  savePercentage?: number | null;
  league?: { code?: string | null; name?: string | null } | null;
};

export type ProspectProjectionInput = {
  position?: string | null;
  draftYear?: number | null;
  overallPick?: number | null;
  birthDate?: string | null;
  stats?: ProjectionStat[];
  /** Commissioner's manual grade (A–F); replaces the computed one. */
  gradeOverride?: string | null;
};

export type ProspectProjection = {
  grade: ProjectionGrade;
  score: number;
  confidence: number;
  role: string;
  eta: string;
  risk: "Low" | "Moderate" | "High";
  futureValue: number;
  summary: string;
  /** True when the grade was set by hand rather than computed. */
  manual?: boolean;
};

const JUNIOR = new Set(["WHL", "OHL", "QMJHL", "USHL", "BCHL", "FIN-U20", "SWE-U20", "CZE-U20", "SVK-U20", "MHL"]);
const PRO = new Set(["NHL", "AHL", "LIIGA", "SHL", "KHL", "DEL", "CZE", "SVK", "NL"]);

function ageOn(birthDate?: string | null) {
  if (!birthDate) return null;
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return null;
  const asOf = new Date("2026-10-03T00:00:00Z");
  let age = asOf.getUTCFullYear() - date.getUTCFullYear();
  const month = asOf.getUTCMonth() - date.getUTCMonth();
  if (month < 0 || (month === 0 && asOf.getUTCDate() < date.getUTCDate())) age--;
  return age;
}

function roleFor(position: string, grade: ProjectionGrade) {
  const p = position.toUpperCase();
  const tier = grade === "A" ? 0 : grade === "B" ? 1 : grade === "C" ? 2 : grade === "D" ? 3 : 4;
  if (p === "G") return ["Starting NHL goaltender", "NHL goalie / strong tandem", "NHL tandem upside", "Organizational goaltender", "Long-term project"][tier];
  if (p.includes("D")) return ["Top-pair defenseman", "Top-four defenseman", "NHL defenseman", "Depth-defense upside", "Long-term project"][tier];
  return ["Top-line forward", "Top-six forward", "Middle-six NHL forward", "Depth-forward upside", "Long-term project"][tier];
}

function gradeFor(score: number): ProjectionGrade {
  if (score >= 82) return "A";
  if (score >= 68) return "B";
  if (score >= 54) return "C";
  if (score >= 40) return "D";
  return "F";
}

/** Return a current UNHL prospect projection. */
export function projectProspect(input: ProspectProjectionInput): ProspectProjection {
  const stats = input.stats ?? [];
  const latest = [...stats].sort((a, b) => (b.season ?? "").localeCompare(a.season ?? "") || (b.gamesPlayed ?? 0) - (a.gamesPlayed ?? 0))[0];
  const pos = (input.position ?? "").toUpperCase();
  const goalie = pos === "G" || latest?.isGoalie === true;
  const age = ageOn(input.birthDate);
  const code = latest?.league?.code?.toUpperCase() ?? "";
  const gp = latest?.gamesPlayed ?? 0;

  let score = 33;
  const pick = input.overallPick;
  if (pick != null) {
    score += pick <= 3 ? 50 : pick <= 5 ? 44 : pick <= 15 ? 32 : pick <= 32 ? 23 : pick <= 64 ? 16 : pick <= 96 ? 10 : 5;
  }
  if (age != null) score += age <= 18 ? 10 : age === 19 ? 8 : age === 20 ? 5 : age === 21 ? 2 : age >= 23 ? -6 : 0;

  if (latest && gp > 0) {
    if (goalie) {
      const sv = latest.savePercentage ?? 0;
      score += sv >= 0.925 ? 18 : sv >= 0.915 ? 12 : sv >= 0.905 ? 6 : sv >= 0.895 ? 1 : -5;
      if (PRO.has(code)) score += 5;
    } else {
      const ppg = (latest.points ?? 0) / gp;
      const baseline = PRO.has(code) ? 0.28 : code === "NCAA" ? 0.45 : JUNIOR.has(code) ? 0.6 : 0.5;
      score += Math.max(-9, Math.min(19, Math.round((ppg - baseline) * 22)));
      if (PRO.has(code)) score += 7;
      else if (code === "NCAA") score += 4;
    }
  }
  score = Math.max(20, Math.min(99, Math.round(score)));
  const grade = gradeFor(score);
  const confidence = Math.max(35, Math.min(92, Math.round(34 + Math.min(36, gp * 2.2) + (pick != null ? 12 : 0) + (latest ? 6 : 0))));
  const risk: ProspectProjection["risk"] = confidence >= 75 ? "Low" : confidence >= 55 ? "Moderate" : "High";
  const proTrack = PRO.has(code);
  const eta = grade === "A" && proTrack ? "0–2 years" : grade === "A" || (grade === "B" && proTrack) ? "1–3 years" : grade === "B" ? "2–4 years" : grade === "C" ? "3–5 years" : "4+ years";
  const futureValue = Math.round(({ A: 950, B: 650, C: 380, D: 170, F: 70 }[grade]) * (0.8 + confidence / 500));
  const performance = !latest ? "No live stat line yet" : goalie ? `${Math.round((latest.savePercentage ?? 0) * 1000) / 10}% SV% in ${gp} GP` : `${((latest.points ?? 0) / gp).toFixed(2)} P/GP in ${code || "current league"}`;

  const computed: ProspectProjection = { grade, score, confidence, role: roleFor(pos, grade), eta, risk, futureValue, summary: `${performance} · ${risk.toLowerCase()} projection risk` };
  const manual = input.gradeOverride?.toUpperCase();
  if (manual !== "A" && manual !== "B" && manual !== "C" && manual !== "D" && manual !== "F") return computed;
  const g: ProjectionGrade = manual;
  const mid = { A: 90, B: 75, C: 61, D: 47, F: 30 }[g];
  const etaFor = g === "A" && proTrack ? "0–2 years" : g === "A" || (g === "B" && proTrack) ? "1–3 years" : g === "B" ? "2–4 years" : g === "C" ? "3–5 years" : "4+ years";
  return {
    grade: g, score: mid, confidence: 90, role: roleFor(pos, g), eta: etaFor, risk: "Low",
    futureValue: Math.round(({ A: 950, B: 650, C: 380, D: 170, F: 70 }[g]) * 1.0),
    summary: `Commissioner grade · ${performance}`, manual: true,
  };
}

/** Prisma include that loads what projectProspect needs for a Prospect row. */
export const PROSPECT_PROJECTION_INCLUDE = {
  worldPlayer: { include: { stats: { orderBy: [{ season: "desc" as const }, { gamesPlayed: "desc" as const }], include: { league: true } } } },
};

/** SortableTable columns for the projection (pair with prospectProjectionCells). */
export const PROJECTION_COLS = [
  { key: "grade", label: "Grade", kind: "grade" as const, title: "UNHL projection grade (A–F) from draft capital, age and current stats — see Around the World" },
  { key: "score", label: "Score", kind: "num" as const },
  { key: "role", label: "Projected role", kind: "text" as const },
  { key: "eta", label: "ETA", kind: "text" as const },
  { key: "risk", label: "Risk", kind: "text" as const },
];

/** Row cells for PROJECTION_COLS, from a Prospect loaded with PROSPECT_PROJECTION_INCLUDE. */
export function prospectProjectionCells(p: any, drafted: boolean) {
  const w = p.worldPlayer;
  const proj = projectProspect({
    position: p.position ?? w?.position,
    draftYear: p.draftYear,
    overallPick: drafted ? p.overallPick : null,
    birthDate: w?.birthDate,
    stats: w?.stats,
    gradeOverride: p.gradeOverride,
  });
  return { grade: proj.grade, score: proj.score, role: proj.role, eta: proj.eta, risk: proj.risk };
}
