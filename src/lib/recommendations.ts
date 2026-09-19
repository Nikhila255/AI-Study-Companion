/**
 * Recommendation Engine
 *
 * Scoped strictly to project, user, and active study material.
 * Generates:
 *  - What to Focus on Next (Highest priority weak concepts with real numbers & citations)
 *  - Suggested Study Plan (3–5 concrete actionable steps)
 *  - Your Strengths (Top strong concepts with encouraging subtext)
 *  - Improving Track (Concepts with validated positive trajectory)
 */

import { prisma } from "./db";
import {
  isValidEducationalConcept,
  filterValidConcepts,
  getConceptsForProjectAndMaterial,
} from "./concept-extractor";

export type RecommendationCategory =
  | "Review Concept"
  | "Practice Questions"
  | "Revisit Fundamentals"
  | "Maintain Progress"
  | "Continue Learning";

export type PriorityLevel = "High Priority" | "Medium Priority" | "Suggested";

export interface ActionableRecommendation {
  id: string;
  conceptId: string;
  conceptName: string;
  category: RecommendationCategory;
  title: string;
  masteryScore: number;
  priorityLevel: PriorityLevel;
  totalAttempts: number;
  successfulAttempts: number;
  why: string;
  recommendedAction: string;
  actionType: "PRACTICE_QUIZ" | "REVIEW_CONCEPT" | "RETRY_ASSESSMENT";
  citation?: string;
  askTutorPrompt: string;
}

export interface ConceptStrength {
  conceptId: string;
  conceptName: string;
  masteryScore: number;
  successfulAttempts: number;
  totalAttempts: number;
}

export interface ImprovingConcept {
  conceptId: string;
  conceptName: string;
  masteryScore: number;
  previousScore?: number;
}

export interface StructuredRecommendationsResponse {
  materialName: string;
  focusItems: ActionableRecommendation[];
  studyPlan: string[];
  strengths: ConceptStrength[];
  improving: ImprovingConcept[];
  hasSufficientData: boolean;
  totalPracticed: number;
}

/**
 * Generate personalized study recommendations for a project grounded in active material.
 */
export async function generateProjectRecommendations(
  projectId: string,
  userId: string,
  materialId?: string
): Promise<StructuredRecommendationsResponse> {
  // 1. Fetch concepts strictly scoped to this material & project
  const scopedConcepts = await getConceptsForProjectAndMaterial(projectId, materialId, userId);
  const scopedConceptIds = new Set(scopedConcepts.map((c) => c.id));
  const conceptMap = new Map(scopedConcepts.map((c) => [c.id, c.name]));

  // 2. Fetch active material document info
  let docName = "Study Material";
  const activeMaterial = await prisma.material.findFirst({
    where: {
      projectId,
      ...(materialId ? { id: materialId } : {}),
      status: "READY",
    },
    orderBy: { createdAt: "desc" },
  });
  if (activeMaterial) {
    docName = activeMaterial.fileName;
  }

  // 3. Fetch mastery records for scoped concepts
  const masteryRecords = await prisma.masteryRecord.findMany({
    where: {
      projectId,
      userId,
      conceptId: { in: Array.from(scopedConceptIds) },
    },
    include: { concept: true },
    orderBy: { masteryScore: "asc" },
  });

  // 4. Fetch question attempts on scoped concepts
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

  // Aggregate attempts by concept
  const conceptAttemptStats = new Map<
    string,
    { total: number; correct: number; incorrect: number }
  >();
  for (const a of attempts) {
    const cid = a.question.conceptId;
    if (!cid || !scopedConceptIds.has(cid)) continue;
    if (!conceptAttemptStats.has(cid)) {
      conceptAttemptStats.set(cid, { total: 0, correct: 0, incorrect: 0 });
    }
    const stats = conceptAttemptStats.get(cid)!;
    stats.total++;
    if (a.isCorrect) stats.correct++;
    else stats.incorrect++;
  }

  // Helper to find document page for concept from chunks
  async function findConceptPage(conceptName: string): Promise<string> {
    try {
      const chunk = await prisma.documentChunk.findFirst({
        where: {
          projectId,
          ...(materialId ? { documentId: materialId } : {}),
          content: { contains: conceptName },
        },
        orderBy: { pageNumber: "asc" },
      });
      if (chunk) {
        return `${docName} — Page ${chunk.pageNumber}`;
      }
    } catch {
      // Non-fatal
    }
    return `${docName} — Relevant Section`;
  }

  const practicedRecords = masteryRecords.filter((m) => m.totalAttempts > 0);
  const hasSufficientData = practicedRecords.length > 0;

  if (!hasSufficientData) {
    return {
      materialName: docName,
      focusItems: [],
      studyPlan: [],
      strengths: [],
      improving: [],
      hasSufficientData: false,
      totalPracticed: 0,
    };
  }

  // Identify Weak Concepts (<65% mastery or requiring attention)
  const weakConcepts = practicedRecords.filter(
    (m) => m.masteryScore < 65 || m.trajectory === "REQUIRING_ATTENTION"
  );
  // Sort weak concepts by lowest mastery first, then highest error count
  weakConcepts.sort((a, b) => {
    if (a.masteryScore !== b.masteryScore) {
      return a.masteryScore - b.masteryScore;
    }
    const aStats = conceptAttemptStats.get(a.conceptId);
    const bStats = conceptAttemptStats.get(b.conceptId);
    return (bStats?.incorrect ?? 0) - (aStats?.incorrect ?? 0);
  });

  const focusItems: ActionableRecommendation[] = [];
  const processedConceptIds = new Set<string>();

  // 5. Generate Focus Items (up to 4 prioritized items)
  for (const weak of weakConcepts.slice(0, 4)) {
    processedConceptIds.add(weak.conceptId);
    const conceptName = weak.concept.name;
    const stats = conceptAttemptStats.get(weak.conceptId) || {
      total: weak.totalAttempts,
      correct: weak.successfulAttempts,
      incorrect: weak.totalAttempts - weak.successfulAttempts,
    };
    const score = Math.round(weak.masteryScore);
    const citation = await findConceptPage(conceptName);

    let category: RecommendationCategory = "Review Concept";
    let priorityLevel: PriorityLevel = "Medium Priority";
    let actionType: "PRACTICE_QUIZ" | "REVIEW_CONCEPT" | "RETRY_ASSESSMENT" = "REVIEW_CONCEPT";

    if (score < 40 || (stats.incorrect >= 3 && stats.correct === 0)) {
      priorityLevel = "High Priority";
      category = stats.incorrect >= 3 ? "Practice Questions" : "Review Concept";
      actionType = "REVIEW_CONCEPT";
    } else if (stats.incorrect > 0) {
      category = "Practice Questions";
      actionType = "PRACTICE_QUIZ";
    } else {
      category = "Revisit Fundamentals";
      actionType = "REVIEW_CONCEPT";
    }

    const whyText =
      stats.total > 0
        ? `You answered ${stats.correct} of ${stats.total} recent questions correctly on ${conceptName} (current mastery: ${score}%).`
        : `Your current mastery is ${score}%, indicating foundational review is recommended.`;

    const recommendedAction =
      actionType === "PRACTICE_QUIZ"
        ? `Review the ${conceptName} section in ${citation} and practice 5 targeted questions.`
        : `Review core principles and definitions of ${conceptName} in ${citation}, then retry questions.`;

    focusItems.push({
      id: `rec-${weak.conceptId}`,
      conceptId: weak.conceptId,
      conceptName,
      category,
      title: `${category === "Practice Questions" ? "Practice" : "Review"} ${conceptName}`,
      masteryScore: score,
      priorityLevel,
      totalAttempts: stats.total,
      successfulAttempts: stats.correct,
      why: whyText,
      recommendedAction,
      actionType,
      citation,
      askTutorPrompt: `Explain ${conceptName} in detail with examples based on ${docName}.`,
    });
  }

  // If fewer than 2 weak concepts, add a developing concept or unpracticed concept
  if (focusItems.length < 2) {
    const developingRecords = practicedRecords.filter(
      (m) => m.masteryScore >= 65 && m.masteryScore < 75 && !processedConceptIds.has(m.conceptId)
    );
    for (const dev of developingRecords.slice(0, 2 - focusItems.length)) {
      processedConceptIds.add(dev.conceptId);
      const conceptName = dev.concept.name;
      const stats = conceptAttemptStats.get(dev.conceptId) || {
        total: dev.totalAttempts,
        correct: dev.successfulAttempts,
        incorrect: dev.totalAttempts - dev.successfulAttempts,
      };
      const score = Math.round(dev.masteryScore);
      const citation = await findConceptPage(conceptName);

      focusItems.push({
        id: `rec-${dev.conceptId}`,
        conceptId: dev.conceptId,
        conceptName,
        category: "Continue Learning",
        title: `Reinforce ${conceptName}`,
        masteryScore: score,
        priorityLevel: "Suggested",
        totalAttempts: stats.total,
        successfulAttempts: stats.correct,
        why: `You have achieved developing mastery (${score}%) with ${stats.correct}/${stats.total} correct. Further practice will secure strong mastery.`,
        recommendedAction: `Complete a short practice quiz on ${conceptName} to advance to strong mastery.`,
        actionType: "PRACTICE_QUIZ",
        citation,
        askTutorPrompt: `Provide an advanced quiz question and breakdown on ${conceptName}.`,
      });
    }
  }

  // 6. Generate Suggested Study Plan (3–5 items)
  const studyPlan: string[] = [];
  for (const item of focusItems.slice(0, 3)) {
    studyPlan.push(`${item.category === "Practice Questions" ? "Practice" : "Review"} ${item.conceptName}`);
  }
  if (focusItems.length > 0) {
    studyPlan.push("Retry a mixed assessment across covered topics");
  } else {
    studyPlan.push("Take a comprehensive quiz on all document concepts");
  }

  // 7. Extract Strengths (Top 3–4 concepts with mastery >= 75%)
  const strongRecords = practicedRecords
    .filter((m) => m.masteryScore >= 75)
    .sort((a, b) => b.masteryScore - a.masteryScore);

  const strengths: ConceptStrength[] = strongRecords.slice(0, 4).map((s) => ({
    conceptId: s.conceptId,
    conceptName: s.concept.name,
    masteryScore: Math.round(s.masteryScore),
    successfulAttempts: s.successfulAttempts,
    totalAttempts: s.totalAttempts,
  }));

  // 8. Extract Improving Track
  const improvingRecords = practicedRecords.filter((m) => m.trajectory === "IMPROVING");
  const improving: ImprovingConcept[] = improvingRecords.map((imp) => ({
    conceptId: imp.conceptId,
    conceptName: imp.concept.name,
    masteryScore: Number(imp.masteryScore.toFixed(1)),
  }));

  return {
    materialName: docName,
    focusItems,
    studyPlan,
    strengths,
    improving,
    hasSufficientData: true,
    totalPracticed: practicedRecords.length,
  };
}
