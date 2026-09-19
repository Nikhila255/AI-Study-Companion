import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { verifyProjectAccess, AuthorizationError } from "@/lib/security";
import { getProjectGrowthAnalysis, updateConceptMastery } from "@/lib/mastery";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: { projectId: string };
}

// ─── GET /api/projects/[projectId]/mastery ───────────────────────────────────
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const materialId = searchParams.get("materialId") || undefined;

    const growth = await getProjectGrowthAnalysis(params.projectId, session.userId, materialId);
    return NextResponse.json(growth);
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/projects/[projectId]/mastery ──────────────────────────────────
// Force recalculation of all concept masteries for this project
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await verifyProjectAccess(params.projectId, session.userId);

    const concepts = await prisma.concept.findMany({
      where: { projectId: params.projectId },
    });

    for (const c of concepts) {
      await updateConceptMastery(params.projectId, session.userId, c.id);
    }

    const growth = await getProjectGrowthAnalysis(params.projectId, session.userId);
    return NextResponse.json(growth);
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
