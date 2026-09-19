import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { verifyProjectAccess, AuthorizationError } from "@/lib/security";
import {
  generateAdaptiveQuiz,
  submitQuizAnswer,
  submitQuizBatch,
} from "@/lib/quiz-service";
import { getConceptsForProjectAndMaterial } from "@/lib/concept-extractor";

interface RouteParams {
  params: { projectId: string };
}

// ─── GET /api/projects/[projectId]/quiz ──────────────────────────────────────
// Returns available topics/concepts scoped to the current material for quiz configuration
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await verifyProjectAccess(params.projectId, session.userId);

    const { searchParams } = new URL(req.url);
    const materialId = searchParams.get("materialId") || undefined;

    const concepts = await getConceptsForProjectAndMaterial(
      params.projectId,
      materialId,
      session.userId
    );

    return NextResponse.json({ concepts });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[Quiz GET Error]:", error);
    return NextResponse.json({ error: "Failed to load quiz topics." }, { status: 500 });
  }
}

// ─── POST /api/projects/[projectId]/quiz ─────────────────────────────────────
// Handles quiz operations:
//   - Action "GENERATE": generates a new adaptive quiz scoped to material and selected topics
//   - Action "SUBMIT": scores a single submitted answer
//   - Action "SUBMIT_QUIZ": scores all submitted answers in batch and calculates full dashboard results
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await verifyProjectAccess(params.projectId, session.userId);

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const action = body?.action || "GENERATE";

    if (action === "GENERATE") {
      const questionCount = typeof body?.questionCount === "number" ? body.questionCount : 5;
      const targetDifficulty = body?.targetDifficulty || "MIXED";
      const materialId = body?.materialId ? String(body.materialId) : undefined;
      const selectedConceptIds = Array.isArray(body?.selectedConceptIds)
        ? body.selectedConceptIds
        : undefined;

      const quiz = await generateAdaptiveQuiz(
        params.projectId,
        session.userId,
        questionCount,
        targetDifficulty,
        materialId,
        selectedConceptIds
      );
      return NextResponse.json(quiz, { status: 201 });
    }

    if (action === "SUBMIT_QUIZ") {
      const { assessmentId, answers, timeSpentSeconds } = body;
      if (!assessmentId || !Array.isArray(answers)) {
        return NextResponse.json(
          { error: "Invalid batch submission payload. Required: assessmentId, answers array." },
          { status: 400 }
        );
      }

      const results = await submitQuizBatch({
        userId: session.userId,
        projectId: params.projectId,
        assessmentId,
        answers,
        timeSpentSeconds: typeof timeSpentSeconds === "number" ? timeSpentSeconds : undefined,
      });

      return NextResponse.json(results);
    }

    if (action === "SUBMIT") {
      const { questionId, userAnswerIndex, userAnswerText } = body;
      if (!questionId) {
        return NextResponse.json(
          { error: "Invalid submission payload. Required: questionId." },
          { status: 400 }
        );
      }

      const result = await submitQuizAnswer({
        userId: session.userId,
        projectId: params.projectId,
        questionId,
        userAnswerIndex: typeof userAnswerIndex === "number" ? userAnswerIndex : null,
        userAnswerText: typeof userAnswerText === "string" ? userAnswerText : null,
      });

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error("[Quiz API Error]:", error);
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to process quiz request." },
      { status: 500 }
    );
  }
}
