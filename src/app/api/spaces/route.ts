import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/spaces - Lists all spaces owned by the authenticated user
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const spaces = await prisma.space.findMany({
    where: {
      userId: session.userId, // Strict user isolation
    },
    include: {
      _count: {
        select: { projects: true },
      },
      projects: {
        select: {
          id: true,
          name: true,
          learningGoal: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 3,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ spaces });
}

// POST /api/spaces - Creates a space owned by the authenticated user
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, description, iconColor } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Space name is required" }, { status: 400 });
    }

    const space = await prisma.space.create({
      data: {
        userId: session.userId, // Strict tenancy binding
        name: name.trim(),
        description: description?.trim() || null,
        iconColor: iconColor || "#6366F1",
      },
    });

    return NextResponse.json({ space }, { status: 201 });
  } catch (error: any) {
    console.error("Create space error:", error);
    return NextResponse.json({ error: "Failed to create space" }, { status: 500 });
  }
}
