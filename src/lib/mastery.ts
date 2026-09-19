/**
 * Mastery & Growth Calculation Engine
 *
 * Scoped strictly to project, user, and active study material.
 * Computes:
 *  - Overall Mastery (%)
 *  - Concept Performance: Strong, Developing, Needs Practice
 *  - Unattempted concepts separated cleanly as "Not Practiced Yet"
 *  - Growth / Trajectory: Improving, Stable, Needs Practice (mutually exclusive)
 *  - Recent question attempts per concept for drill-down inspection
 */

import { prisma } from "./db";
import {
  isValidEducationalConcept,
  filterValidConcepts,
  getConceptsForProjectAndMaterial,
} from "./concept-extractor";

export interface RecentAttemptSummary {
  id: string;
  isCorrect: boolean;
  semanticScore?: number | null;
  attemptedAt: Date;
  questionText: string;
  questionType: string;
}

export interface ConceptMasterySummary {
  conceptId: string;
  conceptName: string;
  masteryScore: number;
  trajectory: "IMPROVING" | "STABLE" | "REQUIRING_ATTENTION";
  totalAttempts: number;
  successfulAttempts: number;
  status: "Strong" | "Developing" | "Needs Practice" | "Not Practiced Yet";
  previousScore?: number;
  lastEvaluatedAt: Date;
  recentAttempts?: RecentAttemptSummary[];
}

export interface GrowthAnalysis {
  improving: ConceptMasterySummary[];
  stable: ConceptMasterySummary[];
  requiringAttention: ConceptMasterySummary[];
  notPracticedYet: ConceptMasterySummary[];
  practiced: ConceptMasterySummary[];
  overallMastery: number;
  summaryText: string;
  strongCount: number;
  developingCount: number;
  needsPracticeCount: number;
  totalPracticed: number;
}

/**
 * Recalculate mastery and trajectory for a concept following an attempt.
 */
export async function updateConceptMastery(
  projectId: string,
  userId: string,
  conceptId: string
): Promise<ConceptMasterySummary> {
  // Fetch all attempts for this concept in this project
  const attempts = await prisma.questionAttempt.findMany({
    where: {
      userId,
      question: {
        conceptId,
        assessment: { projectId },
      },
    },
    orderBy: { attemptedAt: "asc" },
    include: {
      question: true,
    },
  });

  const totalAttempts = attempts.length;
  if (totalAttempts === 0) {
    const defaultRecord = await prisma.masteryRecord.upsert({
      where: {
        projectId_userId_conceptId: { projectId, userId, conceptId },
      },
      update: {},
      create: {
        projectId,
        userId,
        conceptId,
        masteryScore: 0.0,
        trajectory: "STABLE",
        totalAttempts: 0,
        successfulAttempts: 0,
      },
      include: { concept: true },
    });

    return {
      conceptId,
      conceptName: defaultRecord.concept.name,
      masteryScore: 0.0,
      trajectory: "STABLE",
      totalAttempts: 0,
      successfulAttempts: 0,
      status: "Not Practiced Yet",
      lastEvaluatedAt: defaultRecord.lastEvaluatedAt,
      recentAttempts: [],
    };
  }

  // 1. MCQ attempts
  const mcqAttempts = attempts.filter((a) => a.question.questionType === "MCQ");
  const mcqCorrect = mcqAttempts.filter((a) => a.isCorrect === true).length;
  const mcqRate = mcqAttempts.length > 0 ? (mcqCorrect / mcqAttempts.length) * 100 : 50;

  // 2. Open-ended / written attempts
  const openAttempts = attempts.filter((a) => a.question.questionType !== "MCQ");
  const openScores = openAttempts.map((a) => a.semanticScore ?? (a.isCorrect ? 100 : 50));
  const openAvg =
    openScores.length > 0
      ? openScores.reduce((acc, v) => acc + v, 0) / openScores.length
      : 50;

  // 3. Activity weight
  const activityBonus = Math.min(10, totalAttempts * 2);

  // Weighted composite
  let calculatedScore = 0;
  if (mcqAttempts.length > 0 && openAttempts.length > 0) {
    calculatedScore = mcqRate * 0.45 + openAvg * 0.45 + activityBonus;
  } else if (mcqAttempts.length > 0) {
    calculatedScore = mcqRate * 0.85 + activityBonus;
  } else {
    calculatedScore = openAvg * 0.85 + activityBonus;
  }

  const finalScore = Number(Math.max(0, Math.min(100, calculatedScore)).toFixed(1));

  // Trajectory calculation (trend over time)
  let trajectory: "IMPROVING" | "STABLE" | "REQUIRING_ATTENTION" = "STABLE";
  let previousScore: number | undefined = undefined;

  if (totalAttempts >= 3) {
    const recentScores = attempts.slice(-3).map((a) => (a.isCorrect ? 100 : a.semanticScore ?? 0));
    const olderScores = attempts.slice(0, -3).map((a) => (a.isCorrect ? 100 : a.semanticScore ?? 0));

    const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
    const olderAvg = olderScores.length > 0 ? olderScores.reduce((a, b) => a + b, 0) / olderScores.length : recentAvg;

    previousScore = Number(olderAvg.toFixed(1));
    const delta = recentAvg - olderAvg;
    if (delta >= 8.0) {
      trajectory = "IMPROVING";
    } else if (delta <= -8.0 || recentAvg < 40) {
      trajectory = "REQUIRING_ATTENTION";
    } else {
      trajectory = "STABLE";
    }
  }

  const successfulAttempts = attempts.filter(
    (a) => a.isCorrect === true || (a.semanticScore && a.semanticScore >= 70)
  ).length;

  const status =
    finalScore >= 75 ? "Strong" : finalScore >= 50 ? "Developing" : "Needs Practice";

  const record = await prisma.masteryRecord.upsert({
    where: {
      projectId_userId_conceptId: { projectId, userId, conceptId },
    },
    update: {
      masteryScore: finalScore,
      trajectory,
      totalAttempts,
      successfulAttempts,
      lastEvaluatedAt: new Date(),
    },
    create: {
      projectId,
      userId,
      conceptId,
      masteryScore: finalScore,
      trajectory,
      totalAttempts,
      successfulAttempts,
      lastEvaluatedAt: new Date(),
    },
    include: {
      concept: true,
    },
  });

  // Emit mastery update event
  await prisma.learningEvent.create({
    data: {
      userId,
      projectId,
      eventType: "MASTERY_UPDATED",
      payload: JSON.stringify({
        conceptId,
        conceptName: record.concept.name,
        masteryScore: finalScore,
        trajectory,
      }),
    },
  });

  const recentAttempts: RecentAttemptSummary[] = attempts
    .slice(-5)
    .reverse()
    .map((a) => ({
      id: a.id,
      isCorrect: a.isCorrect ?? false,
      semanticScore: a.semanticScore,
      attemptedAt: a.attemptedAt,
      questionText: a.question.questionText,
      questionType: a.question.questionType,
    }));

  return {
    conceptId,
    conceptName: record.concept.name,
    masteryScore: finalScore,
    trajectory,
    totalAttempts,
    successfulAttempts,
    status,
    previousScore,
    lastEvaluatedAt: record.lastEvaluatedAt,
    recentAttempts,
  };
}

/**
 * Retrieve clean student-facing mastery and growth analysis for a project and material.
 */
export async function getProjectGrowthAnalysis(
  projectId: string,
  userId: string,
  materialId?: string
): Promise<GrowthAnalysis> {
  // 1. Get concepts strictly scoped to this material & project
  const scopedConcepts = await getConceptsForProjectAndMaterial(projectId, materialId, userId);
  const scopedConceptIds = new Set(scopedConcepts.map((c) => c.id));

  // 2. Fetch mastery records for these scoped concepts
  const records = await prisma.masteryRecord.findMany({
    where: {
      projectId,
      userId,
      conceptId: { in: Array.from(scopedConceptIds) },
    },
    include: { concept: true },
    orderBy: { masteryScore: "desc" },
  });

  // 3. Fetch recent question attempts for drill-down inspection
  const attempts = await prisma.questionAttempt.findMany({
    where: {
      userId,
      question: {
        assessment: { projectId },
        conceptId: { in: Array.from(scopedConceptIds) },
      },
    },
    orderBy: { attemptedAt: "desc" },
    include: {
      question: true,
    },
  });

  const attemptsByConcept = new Map<string, RecentAttemptSummary[]>();
  for (const a of attempts) {
    const cid = a.question.conceptId;
    if (!cid) continue;
    if (!attemptsByConcept.has(cid)) {
      attemptsByConcept.set(cid, []);
    }
    const list = attemptsByConcept.get(cid)!;
    if (list.length < 5) {
      list.push({
        id: a.id,
        isCorrect: a.isCorrect ?? false,
        semanticScore: a.semanticScore,
        attemptedAt: a.attemptedAt,
        questionText: a.question.questionText,
        questionType: a.question.questionType,
      });
    }
  }

  const practiced: ConceptMasterySummary[] = [];
  const notPracticedYet: ConceptMasterySummary[] = [];
  const evaluatedConceptIds = new Set<string>();

  for (const r of records) {
    if (!scopedConceptIds.has(r.conceptId)) continue;
    evaluatedConceptIds.add(r.conceptId);

    const recent = attemptsByConcept.get(r.conceptId) || [];

    if (r.totalAttempts > 0) {
      const status =
        r.masteryScore >= 75
          ? "Strong"
          : r.masteryScore >= 50
          ? "Developing"
          : "Needs Practice";

      practiced.push({
        conceptId: r.conceptId,
        conceptName: r.concept.name,
        masteryScore: r.masteryScore,
        trajectory: r.trajectory as "IMPROVING" | "STABLE" | "REQUIRING_ATTENTION",
        totalAttempts: r.totalAttempts,
        successfulAttempts: r.successfulAttempts,
        status,
        lastEvaluatedAt: r.lastEvaluatedAt,
        recentAttempts: recent,
      });
    } else {
      notPracticedYet.push({
        conceptId: r.conceptId,
        conceptName: r.concept.name,
        masteryScore: 0.0,
        trajectory: "STABLE",
        totalAttempts: 0,
        successfulAttempts: 0,
        status: "Not Practiced Yet",
        lastEvaluatedAt: r.lastEvaluatedAt,
        recentAttempts: [],
      });
    }
  }

  // 4. Add unattempted scoped concepts
  for (const c of scopedConcepts) {
    if (!evaluatedConceptIds.has(c.id)) {
      notPracticedYet.push({
        conceptId: c.id,
        conceptName: c.name,
        masteryScore: 0.0,
        trajectory: "STABLE",
        totalAttempts: 0,
        successfulAttempts: 0,
        status: "Not Practiced Yet",
        lastEvaluatedAt: new Date(),
        recentAttempts: [],
      });
    }
  }

  // Sort practiced by highest mastery score
  practiced.sort((a, b) => b.masteryScore - a.masteryScore);

  // Group into mutually exclusive growth categories (strictly avoiding duplicates & contradictions)
  const improving: ConceptMasterySummary[] = [];
  const stable: ConceptMasterySummary[] = [];
  const requiringAttention: ConceptMasterySummary[] = [];

  for (const s of practiced) {
    if (s.trajectory === "IMPROVING") {
      improving.push(s);
    } else if (
      s.status === "Needs Practice" ||
      (s.trajectory === "REQUIRING_ATTENTION" && s.masteryScore < 75)
    ) {
      requiringAttention.push(s);
    } else {
      stable.push(s);
    }
  }

  const strongCount = practiced.filter((s) => s.status === "Strong").length;
  const developingCount = practiced.filter((s) => s.status === "Developing").length;
  const needsPracticeCount = practiced.filter((s) => s.status === "Needs Practice").length;

  const overallMastery =
    practiced.length > 0
      ? Number(
          (
            practiced.reduce((acc, s) => acc + s.masteryScore, 0) /
            practiced.length
          ).toFixed(0)
        )
      : 0;

  const summaryText =
    practiced.length > 0
      ? "Your current mastery across concepts you have practiced in this study project."
      : "Start a quiz or assessment to establish concept mastery.";

  return {
    improving,
    stable,
    requiringAttention,
    notPracticedYet,
    practiced,
    overallMastery,
    summaryText,
    strongCount,
    developingCount,
    needsPracticeCount,
    totalPracticed: practiced.length,
  };
}
