import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { verifyProjectAccess, AuthorizationError } from "@/lib/security";
import { prisma } from "@/lib/db";
import { processMaterial } from "@/lib/pdf-processor";

interface RouteParams {
  params: { projectId: string; materialId: string };
}

// ─── GET /api/projects/[projectId]/materials/[materialId] ─────────────────────
// Get a single material's status and metadata.
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await verifyProjectAccess(params.projectId, session.userId);

    const material = await prisma.material.findFirst({
      where: {
        id: params.materialId,
        projectId: params.projectId,
        userId: session.userId,
      },
      include: {
        _count: { select: { chunks: true } },
      },
    });

    if (!material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    return NextResponse.json({ material });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/projects/[projectId]/materials/[materialId]/retry is handled  ──
// via query param ?action=retry on this route.

// ─── DELETE /api/projects/[projectId]/materials/[materialId] ──────────────────
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await verifyProjectAccess(params.projectId, session.userId);

    const material = await prisma.material.findFirst({
      where: {
        id: params.materialId,
        projectId: params.projectId,
        userId: session.userId,
      },
    });

    if (!material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    // Cascade deletes DocumentChunks via Prisma relations
    await prisma.material.delete({ where: { id: params.materialId } });

    return NextResponse.json({ message: "Material deleted successfully" });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── PATCH /api/projects/[projectId]/materials/[materialId] ──────────────────
// Retry processing for a FAILED material.
// Idempotency: existing chunks are deleted before reprocessing (in pdf-processor).
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await verifyProjectAccess(params.projectId, session.userId);

    const material = await prisma.material.findFirst({
      where: {
        id: params.materialId,
        projectId: params.projectId,
        userId: session.userId,
      },
    });

    if (!material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    if (material.status !== "FAILED") {
      return NextResponse.json(
        { error: `Cannot retry material in status '${material.status}'. Only FAILED materials can be retried.` },
        { status: 400 }
      );
    }

    // Reset to QUEUED
    await prisma.material.update({
      where: { id: params.materialId },
      data: { status: "QUEUED", errorMessage: null },
    });

    // Fire-and-forget retry
    setImmediate(() => {
      processMaterial(params.materialId).catch((err) =>
        console.error("[Retry Route] Unhandled error:", err)
      );
    });

    return NextResponse.json({ message: "Retry started", materialId: params.materialId });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
