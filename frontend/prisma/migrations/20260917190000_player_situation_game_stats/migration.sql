CREATE TABLE "PlayerSituationGameStat" (
    "id" SERIAL NOT NULL,
    "gameId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "situation" TEXT NOT NULL,
    "toi" INTEGER NOT NULL DEFAULT 0,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "shots" INTEGER NOT NULL DEFAULT 0,
    "xg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plusMinus" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PlayerSituationGameStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerSituationGameStat_gameId_playerId_situation_key"
    ON "PlayerSituationGameStat"("gameId", "playerId", "situation");
CREATE INDEX "PlayerSituationGameStat_playerId_situation_idx"
    ON "PlayerSituationGameStat"("playerId", "situation");
CREATE INDEX "PlayerSituationGameStat_teamId_situation_idx"
    ON "PlayerSituationGameStat"("teamId", "situation");

ALTER TABLE "PlayerSituationGameStat"
    ADD CONSTRAINT "PlayerSituationGameStat_gameId_fkey"
    FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerSituationGameStat"
    ADD CONSTRAINT "PlayerSituationGameStat_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
