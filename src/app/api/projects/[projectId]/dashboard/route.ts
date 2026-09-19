import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { verifyProjectAccess, AuthorizationError } from "@/lib/security";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: { projectId: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const project = await verifyProjectAccess(params.projectId, session.userId);

    const { searchParams } = new URL(req.url);
    const materialId = searchParams.get("materialId") || undefined;

    const scopedConcepts = await (await import("@/lib/concept-extractor")).getConceptsForProjectAndMaterial(
      params.projectId,
      materialId,
      session.userId
    );
    const scopedConceptIds = new Set(scopedConcepts.map((c) => c.id));

    // Fetch recent events
    const recentEvents = await prisma.learningEvent.findMany({
      where: {
        projectId: project.id,
        userId: session.userId,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // Compute overall average mastery across practiced scoped concepts
    const relevantMastery = project.masteryRecords.filter(
      (m) => scopedConceptIds.has(m.conceptId) && m.totalAttempts > 0
    );

    const avgMastery =
      relevantMastery.length > 0
        ? relevantMastery.reduce((acc, m) => acc + m.masteryScore, 0) /
          relevantMastery.length
        : 0;

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        learningGoal: project.learningGoal,
        space: {
          id: project.space.id,
          name: project.space.name,
          iconColor: project.space.iconColor,
        },
        counts: {
          materials: project.materials.length,
          concepts: scopedConcepts.length,
          recommendations: project.recommendations.length,
        },
        averageMastery: Math.round(avgMastery),
        materials: project.materials,
        concepts: scopedConcepts,
        masteryRecords: relevantMastery,
        recommendations: project.recommendations,
        recentEvents: recentEvents.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          payload: JSON.parse(e.payload),
          createdAt: e.createdAt,
        })),
      },
    });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Project dashboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
