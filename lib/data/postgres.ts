import type { Prisma } from "@/generated/prisma/client";
import type { PrismaClient } from "@/lib/db/prisma";
import { prisma } from "@/lib/db/prisma";
import { seedProblems } from "@/lib/data/seeds/problems";
import type {
  Candidate,
  DataStore,
  Difficulty,
  Message,
  PerformanceSummary,
  Problem,
  Run,
  Session,
  SessionPhase,
  Speaker,
  TestCase,
} from "@/lib/data/types";

const PHASE_TO_PRISMA: Record<
  SessionPhase,
  "introduction" | "clarifying" | "approach" | "implementation" | "wrap_up" | "debrief"
> = {
  introduction: "introduction",
  clarifying: "clarifying",
  approach: "approach",
  implementation: "implementation",
  "wrap-up": "wrap_up",
  debrief: "debrief",
};

const PHASE_FROM_PRISMA: Record<string, SessionPhase> = {
  introduction: "introduction",
  clarifying: "clarifying",
  approach: "approach",
  implementation: "implementation",
  wrap_up: "wrap-up",
  debrief: "debrief",
};

const DIFFICULTY_TO_PRISMA: Record<Difficulty, "easy" | "medium" | "hard"> = {
  easy: "easy",
  medium: "medium",
  hard: "hard",
};

const DIFFICULTY_FROM_PRISMA: Record<string, Difficulty> = {
  easy: "easy",
  medium: "medium",
  hard: "hard",
};

const SPEAKER_TO_PRISMA: Record<Speaker, "candidate" | "assessor"> = {
  candidate: "candidate",
  assessor: "assessor",
};

const SPEAKER_FROM_PRISMA: Record<string, Speaker> = {
  candidate: "candidate",
  assessor: "assessor",
};

function toJson(tests: TestCase[]): Prisma.InputJsonValue {
  return tests as unknown as Prisma.InputJsonValue;
}

type ProblemRow = Prisma.ProblemGetPayload<object>;
type SessionRow = Prisma.SessionGetPayload<object>;
type RunRow = Prisma.RunGetPayload<object>;
type MessageRow = Prisma.MessageGetPayload<object>;
type SummaryRow = Prisma.PerformanceSummaryGetPayload<object>;

function parseTests(json: unknown): TestCase[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (t): t is TestCase =>
      typeof t === "object" &&
      t !== null &&
      "input" in t &&
      typeof (t as TestCase).input === "string" &&
      "expectedOutput" in t &&
      typeof (t as TestCase).expectedOutput === "string",
  );
}

function toProblem(row: ProblemRow): Problem {
  return {
    id: row.id,
    title: row.title,
    statement: row.statement,
    difficulty: DIFFICULTY_FROM_PRISMA[row.difficulty],
    starterTemplate: row.starterTemplate ?? undefined,
    sampleTests: parseTests(row.sampleTests),
    hiddenTests: parseTests(row.hiddenTests),
    hintTiers: row.hintTiers,
  };
}

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    candidateId: row.candidateId,
    problemId: row.problemId,
    phase: PHASE_FROM_PRISMA[row.phase],
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    workingCode: row.workingCode,
    lastActivityAt: row.lastActivityAt,
    hintsGiven: row.hintsGiven,
  };
}

function toRun(row: RunRow): Run {
  return {
    id: row.id,
    sessionId: row.sessionId,
    code: row.code,
    passedCount: row.passedCount,
    failedCount: row.failedCount,
    createdAt: row.createdAt,
  };
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    sessionId: row.sessionId,
    speaker: SPEAKER_FROM_PRISMA[row.speaker],
    text: row.text,
    createdAt: row.createdAt,
  };
}

function toSummary(row: SummaryRow): PerformanceSummary {
  return {
    id: row.id,
    sessionId: row.sessionId,
    content: row.content,
    createdAt: row.createdAt,
  };
}

export class PostgresDataStore implements DataStore {
  constructor(private readonly db: PrismaClient = prisma) {}

  async createCandidate(email: string): Promise<Candidate> {
    const row = await this.db.candidate.create({ data: { email } });
    return { id: row.id, email: row.email, createdAt: row.createdAt };
  }

  async findCandidateById(id: string): Promise<Candidate | null> {
    const row = await this.db.candidate.findUnique({ where: { id } });
    return row ? { id: row.id, email: row.email, createdAt: row.createdAt } : null;
  }

  async findCandidateByEmail(email: string): Promise<Candidate | null> {
    const row = await this.db.candidate.findUnique({ where: { email } });
    return row ? { id: row.id, email: row.email, createdAt: row.createdAt } : null;
  }

  async createProblem(problem: Problem): Promise<Problem> {
    await this.db.problem.upsert({
      where: { id: problem.id },
      update: {
        title: problem.title,
        statement: problem.statement,
        difficulty: DIFFICULTY_TO_PRISMA[problem.difficulty],
        starterTemplate: problem.starterTemplate ?? null,
        sampleTests: toJson(problem.sampleTests),
        hiddenTests: toJson(problem.hiddenTests),
        hintTiers: problem.hintTiers,
      },
      create: {
        id: problem.id,
        title: problem.title,
        statement: problem.statement,
        difficulty: DIFFICULTY_TO_PRISMA[problem.difficulty],
        starterTemplate: problem.starterTemplate ?? null,
        sampleTests: toJson(problem.sampleTests),
        hiddenTests: toJson(problem.hiddenTests),
        hintTiers: problem.hintTiers,
      },
    });
    return problem;
  }

  async findProblemById(id: string): Promise<Problem | null> {
    const row = await this.db.problem.findUnique({ where: { id } });
    return row ? toProblem(row) : null;
  }

  async listProblems(): Promise<Problem[]> {
    const rows = await this.db.problem.findMany({ orderBy: { id: "asc" } });
    return rows.map(toProblem);
  }

  async createSession(session: Session): Promise<Session> {
    const row = await this.db.session.create({
      data: {
        id: session.id,
        candidateId: session.candidateId,
        problemId: session.problemId,
        phase: PHASE_TO_PRISMA[session.phase],
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        workingCode: session.workingCode,
        lastActivityAt: session.lastActivityAt,
        hintsGiven: session.hintsGiven,
      },
    });
    return toSession(row);
  }

  async findSessionById(id: string): Promise<Session | null> {
    const row = await this.db.session.findUnique({ where: { id } });
    return row ? toSession(row) : null;
  }

  async updateSession(session: Session): Promise<Session> {
    const row = await this.db.session.update({
      where: { id: session.id },
      data: {
        phase: PHASE_TO_PRISMA[session.phase],
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        workingCode: session.workingCode,
        lastActivityAt: session.lastActivityAt,
        hintsGiven: session.hintsGiven,
      },
    });
    return toSession(row);
  }

  async listSessionsByCandidate(candidateId: string): Promise<Session[]> {
    const rows = await this.db.session.findMany({
      where: { candidateId },
      orderBy: { startedAt: "desc" },
    });
    return rows.map(toSession);
  }

  async createRun(run: Run): Promise<Run> {
    const row = await this.db.run.create({
      data: {
        id: run.id,
        sessionId: run.sessionId,
        code: run.code,
        passedCount: run.passedCount,
        failedCount: run.failedCount,
        createdAt: run.createdAt,
      },
    });
    return toRun(row);
  }

  async listRunsBySession(sessionId: string): Promise<Run[]> {
    const rows = await this.db.run.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toRun);
  }

  async createMessage(message: Message): Promise<Message> {
    const row = await this.db.message.create({
      data: {
        id: message.id,
        sessionId: message.sessionId,
        speaker: SPEAKER_TO_PRISMA[message.speaker],
        text: message.text,
        createdAt: message.createdAt,
      },
    });
    return toMessage(row);
  }

  async listMessagesBySession(sessionId: string): Promise<Message[]> {
    const rows = await this.db.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toMessage);
  }

  async createPerformanceSummary(summary: PerformanceSummary): Promise<PerformanceSummary> {
    const row = await this.db.performanceSummary.create({
      data: {
        id: summary.id,
        sessionId: summary.sessionId,
        content: summary.content,
        createdAt: summary.createdAt,
      },
    });
    return toSummary(row);
  }

  async findPerformanceSummaryBySession(sessionId: string): Promise<PerformanceSummary | null> {
    const row = await this.db.performanceSummary.findUnique({ where: { sessionId } });
    return row ? toSummary(row) : null;
  }
}

/** Upserts the seeded Problems into Postgres, idempotently. */
export async function seedPostgresProblems(db: PrismaClient = prisma): Promise<void> {
  const store = new PostgresDataStore(db);
  for (const problem of seedProblems) {
    await store.createProblem(problem);
  }
}