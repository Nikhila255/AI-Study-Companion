import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { verifySpaceAccess, AuthorizationError } from "@/lib/security";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: { spaceId: string };
}

// GET /api/spaces/[spaceId]
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const space = await verifySpaceAccess(params.spaceId, session.userId);
    return NextResponse.json({ space });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/spaces/[spaceId]
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await verifySpaceAccess(params.spaceId, session.userId);

    await prisma.space.delete({
      where: { id: params.spaceId },
    });

    return NextResponse.json({ message: "Space deleted successfully" });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
