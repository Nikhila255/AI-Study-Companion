import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { verifyProjectAccess, AuthorizationError } from "@/lib/security";
import { prisma } from "@/lib/db";
import {
  generateAssessmentSession,
  submitAssessmentSession,
  generateOpenEndedQuestion,
  evaluateOpenEndedAnswer,
} from "@/lib/assessment-service";

interface RouteParams {
  params: { projectId: string };
}

// ─── GET /api/projects/[projectId]/assessments ───────────────────────────────
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await verifyProjectAccess(params.projectId, session.userId);

    const { searchParams } = new URL(req.url);
    const materialId = searchParams.get("materialId") || undefined;

    const [assessments, concepts] = await Promise.all([
      prisma.assessment.findMany({
        where: {
          projectId: params.projectId,
          userId: session.userId,
        },
        include: {
          questions: {
            include: {
              concept: true,
              attempts: {
                where: { userId: session.userId },
                orderBy: { attemptedAt: "desc" },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      (await import("@/lib/concept-extractor")).getConceptsForProjectAndMaterial(
        params.projectId,
        materialId,
        session.userId
      ),
    ]);

    return NextResponse.json({ assessments, concepts });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/projects/[projectId]/assessments ──────────────────────────────
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await verifyProjectAccess(params.projectId, session.userId);

    const body = await req.json();
    const action = body.action || "GENERATE";

    if (action === "GENERATE") {
      const result = await generateAssessmentSession({
        projectId: params.projectId,
        userId: session.userId,
        questionCount: body.questionCount,
        questionTypes: body.questionTypes,
        targetDifficulty: body.targetDifficulty || body.difficulty,
        materialId: body.materialId,
      });
      return NextResponse.json(result, { status: 201 });
    }

    if (action === "SUBMIT_ASSESSMENT") {
      const { assessmentId, answers } = body;
      if (!assessmentId || !Array.isArray(answers)) {
        return NextResponse.json(
          { error: "Invalid submission. Required: assessmentId and answers array." },
          { status: 400 }
        );
      }

      const result = await submitAssessmentSession({
        assessmentId,
        userId: session.userId,
        projectId: params.projectId,
        answers,
      });

      return NextResponse.json(result);
    }

    if (action === "EVALUATE") {
      const { questionId, userAnswer } = body;
      if (!questionId || typeof userAnswer !== "string" || !userAnswer.trim()) {
        return NextResponse.json(
          { error: "Invalid submission. Required: questionId, userAnswer (non-empty string)." },
          { status: 400 }
        );
      }

      const evaluation = await evaluateOpenEndedAnswer({
        userId: session.userId,
        projectId: params.projectId,
        questionId,
        userAnswer: userAnswer.trim(),
      });

      return NextResponse.json(evaluation);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error("[Assessments API Error]:", error);
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to process assessment." },
      { status: 500 }
    );
  }
}
