import type { Prisma } from "@prisma/client";

// Public API contract used by team navigation. Explicitly opt in fields so new
// Team columns cannot accidentally expose credentials or private GM data.
export const publicTeamSelect = {
  id: true,
  name: true,
  slug: true,
  code: true,
  logoUrl: true,
  conference: true,
  division: true,
} satisfies Prisma.TeamSelect;
