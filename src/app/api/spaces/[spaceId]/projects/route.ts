import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { verifySpaceAccess, AuthorizationError } from "@/lib/security";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: { spaceId: string };
}

// GET /api/spaces/[spaceId]/projects
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const space = await verifySpaceAccess(params.spaceId, session.userId);

    const projects = await prisma.project.findMany({
      where: {
        spaceId: space.id,
        userId: session.userId,
      },
      include: {
        _count: {
          select: {
            materials: true,
            concepts: true,
            assessments: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ projects });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/spaces/[spaceId]/projects
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Verify space ownership first
    const space = await verifySpaceAccess(params.spaceId, session.userId);

    const { name, description, learningGoal } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }
    if (!learningGoal || !learningGoal.trim()) {
      return NextResponse.json(
        { error: "Learning goal is required (What are you learning?)" },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        spaceId: space.id,
        userId: session.userId,
        name: name.trim(),
        description: description?.trim() || null,
        learningGoal: learningGoal.trim(),
      },
    });

    // Record learning event for project creation
    await prisma.learningEvent.create({
      data: {
        userId: session.userId,
        projectId: project.id,
        eventType: "PROJECT_CREATED",
        payload: JSON.stringify({
          projectName: project.name,
          learningGoal: project.learningGoal,
          spaceId: space.id,
        }),
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error: any) {
    console.error("Create project error:", error);
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
