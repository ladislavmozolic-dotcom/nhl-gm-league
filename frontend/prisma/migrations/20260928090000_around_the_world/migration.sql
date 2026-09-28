ALTER TABLE "Player" ADD COLUMN "worldPlayerId" INTEGER;
ALTER TABLE "Prospect" ADD COLUMN "worldPlayerId" INTEGER;

CREATE TABLE "WorldLeague" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "country" TEXT,
  "region" TEXT NOT NULL DEFAULT 'North America',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorldLeague_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldTeam" (
  "id" SERIAL NOT NULL,
  "leagueId" INTEGER NOT NULL,
  "externalId" TEXT,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "city" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorldTeam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldPlayer" (
  "id" SERIAL NOT NULL,
  "externalId" TEXT,
  "eliteProspectsId" INTEGER,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "position" TEXT,
  "birthDate" TEXT,
  "nationality" TEXT,
  "epUrl" TEXT,
  "currentTeamId" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorldPlayer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldPlayerSeasonStat" (
  "id" SERIAL NOT NULL,
  "playerId" INTEGER NOT NULL,
  "leagueId" INTEGER NOT NULL,
  "teamId" INTEGER,
  "season" TEXT NOT NULL,
  "isGoalie" BOOLEAN NOT NULL DEFAULT false,
  "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
  "goals" INTEGER NOT NULL DEFAULT 0,
  "assists" INTEGER NOT NULL DEFAULT 0,
  "points" INTEGER NOT NULL DEFAULT 0,
  "plusMinus" INTEGER,
  "penaltyMinutes" INTEGER NOT NULL DEFAULT 0,
  "wins" INTEGER,
  "losses" INTEGER,
  "overtimeLosses" INTEGER,
  "savePercentage" DOUBLE PRECISION,
  "goalsAgainstAverage" DOUBLE PRECISION,
  "shutouts" INTEGER,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorldPlayerSeasonStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Player_worldPlayerId_key" ON "Player"("worldPlayerId");
CREATE UNIQUE INDEX "Prospect_worldPlayerId_key" ON "Prospect"("worldPlayerId");
CREATE UNIQUE INDEX "WorldLeague_code_key" ON "WorldLeague"("code");
CREATE UNIQUE INDEX "WorldTeam_leagueId_slug_key" ON "WorldTeam"("leagueId", "slug");
CREATE UNIQUE INDEX "WorldTeam_leagueId_externalId_key" ON "WorldTeam"("leagueId", "externalId");
CREATE UNIQUE INDEX "WorldPlayer_externalId_key" ON "WorldPlayer"("externalId");
CREATE UNIQUE INDEX "WorldPlayer_eliteProspectsId_key" ON "WorldPlayer"("eliteProspectsId");
CREATE UNIQUE INDEX "WorldPlayerSeasonStat_playerId_leagueId_season_key" ON "WorldPlayerSeasonStat"("playerId", "leagueId", "season");
CREATE INDEX "WorldTeam_leagueId_idx" ON "WorldTeam"("leagueId");
CREATE INDEX "WorldPlayer_normalizedName_idx" ON "WorldPlayer"("normalizedName");
CREATE INDEX "WorldPlayer_currentTeamId_idx" ON "WorldPlayer"("currentTeamId");
CREATE INDEX "WorldPlayerSeasonStat_leagueId_season_points_idx" ON "WorldPlayerSeasonStat"("leagueId", "season", "points");
CREATE INDEX "WorldPlayerSeasonStat_teamId_season_idx" ON "WorldPlayerSeasonStat"("teamId", "season");

ALTER TABLE "Player" ADD CONSTRAINT "Player_worldPlayerId_fkey" FOREIGN KEY ("worldPlayerId") REFERENCES "WorldPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_worldPlayerId_fkey" FOREIGN KEY ("worldPlayerId") REFERENCES "WorldPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorldTeam" ADD CONSTRAINT "WorldTeam_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "WorldLeague"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldPlayer" ADD CONSTRAINT "WorldPlayer_currentTeamId_fkey" FOREIGN KEY ("currentTeamId") REFERENCES "WorldTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorldPlayerSeasonStat" ADD CONSTRAINT "WorldPlayerSeasonStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "WorldPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldPlayerSeasonStat" ADD CONSTRAINT "WorldPlayerSeasonStat_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "WorldLeague"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldPlayerSeasonStat" ADD CONSTRAINT "WorldPlayerSeasonStat_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "WorldTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
