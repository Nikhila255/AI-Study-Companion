import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { verifyProjectAccess, AuthorizationError } from "@/lib/security";
import { prisma } from "@/lib/db";
import {
  generateProjectRecommendations,
} from "@/lib/recommendations";

interface RouteParams {
  params: { projectId: string };
}

// ─── GET /api/projects/[projectId]/recommendations ───────────────────────────
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await verifyProjectAccess(params.projectId, session.userId);
    const { searchParams } = new URL(req.url);
    const materialId = searchParams.get("materialId") || undefined;

    const data = await generateProjectRecommendations(
      params.projectId,
      session.userId,
      materialId
    );
    return NextResponse.json({
      ...data,
      recommendations: data.focusItems,
    });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/projects/[projectId]/recommendations ──────────────────────────
// Refresh recommendations
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
    const materialId = body.materialId ? String(body.materialId) : undefined;

    const data = await generateProjectRecommendations(
      params.projectId,
      session.userId,
      materialId
    );
    return NextResponse.json(
      {
        ...data,
        recommendations: data.focusItems,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── PATCH /api/projects/[projectId]/recommendations ─────────────────────────
// Complete or dismiss recommendation
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await verifyProjectAccess(params.projectId, session.userId);

    const body = await req.json();
    const { recommendationId, isCompleted, isDismissed } = body;

    if (!recommendationId) {
      return NextResponse.json({ error: "recommendationId is required" }, { status: 400 });
    }

    const updated = await prisma.recommendation.update({
      where: {
        id: recommendationId,
        projectId: params.projectId,
        userId: session.userId,
      },
      data: {
        ...(typeof isCompleted === "boolean" && { isCompleted }),
        ...(typeof isDismissed === "boolean" && { isDismissed }),
      },
    });

    return NextResponse.json({ recommendation: updated });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
