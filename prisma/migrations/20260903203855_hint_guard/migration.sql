-- AlterTable
ALTER TABLE "Problem" ADD COLUMN     "hintTiers" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "hintsGiven" INTEGER NOT NULL DEFAULT 0;
