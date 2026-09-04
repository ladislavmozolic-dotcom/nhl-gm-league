// Full names for the two-letter parameter abbreviations, shown as a hover tooltip
// next to each column header on the League → Parameters comparison page. Skaters
// and goalies share some letters (SK, SC, PH, PS, EN, EX, LD, MO...) with DIFFERENT
// meanings, so each position gets its own dictionary.
export const SKATER_PARAM_LABELS: Record<string, string> = {
  CK: "Checking", FG: "Fighting", DI: "Discipline", SK: "Skating", ST: "Strength",
  EN: "Endurance", DU: "Durability", PH: "Puck Handling", FO: "Faceoffs", PA: "Passing",
  SC: "Scoring", DF: "Defense", PS: "Penalty Shot / Breakaway", EX: "Experience",
  LD: "Leadership", MO: "Morale", OV: "Overall",
};

export const GOALIE_PARAM_LABELS: Record<string, string> = {
  SK: "Skating", DU: "Durability", EN: "Endurance", SZ: "Size", AG: "Agility",
  RB: "Rebound Control", SC: "Style Control", HS: "Hand Speed", RT: "Reaction Time",
  PH: "Puck Handling", PS: "Positioning", EX: "Experience", LD: "Leadership", MO: "Morale", OV: "Overall",
};

export const SKATER_PARAM_ORDER = ["CK", "FG", "DI", "SK", "ST", "EN", "DU", "PH", "FO", "PA", "SC", "DF", "PS", "EX", "LD", "MO", "OV"];
export const GOALIE_PARAM_ORDER = ["SK", "DU", "EN", "SZ", "AG", "RB", "SC", "HS", "RT", "PH", "PS", "EX", "LD", "MO", "OV"];
