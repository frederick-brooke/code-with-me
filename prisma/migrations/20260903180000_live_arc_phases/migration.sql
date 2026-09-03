-- CreateEnum
-- Rebuild SessionPhase without the old single 'solve' stage: the live arc
-- is introduction / clarifying / approach / implementation / wrap_up / debrief.
-- PostgreSQL cannot drop an enum value, so rename the type, create the new
-- shape, cast the column, and drop the old type. No 'solve' rows exist in a
-- freshly seeded database; if one did, the USING cast would fail loudly here.
ALTER TYPE "SessionPhase" RENAME TO "SessionPhase_old";

CREATE TYPE "SessionPhase" AS ENUM ('introduction', 'clarifying', 'approach', 'implementation', 'wrap_up', 'debrief');

ALTER TABLE "Session" ALTER COLUMN "phase" DROP DEFAULT;
ALTER TABLE "Session" ALTER COLUMN "phase" TYPE "SessionPhase" USING ("phase"::text::"SessionPhase");
ALTER TABLE "Session" ALTER COLUMN "phase" SET DEFAULT 'introduction'::"SessionPhase";

DROP TYPE "SessionPhase_old";