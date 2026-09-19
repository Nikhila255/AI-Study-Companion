import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { verifyProjectAccess, AuthorizationError } from "@/lib/security";
import { prisma } from "@/lib/db";
import { processMaterial } from "@/lib/pdf-processor";
import fs from "fs";
import path from "path";

interface RouteParams {
  params: { projectId: string };
}

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ─── GET /api/projects/[projectId]/materials ─────────────────────────────────
// List all materials for a project. Enforces project ownership.
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await verifyProjectAccess(params.projectId, session.userId);

    const materials = await prisma.material.findMany({
      where: {
        projectId: params.projectId,
        userId: session.userId, // strict user-level isolation
      },
      select: {
        id: true,
        fileName: true,
        fileSizeBytes: true,
        mimeType: true,
        status: true,
        errorMessage: true,
        totalPages: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { chunks: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ materials });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/projects/[projectId]/materials ─────────────────────────────────
// Upload a PDF material. Responds immediately (202) and processes asynchronously.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Verify project ownership before accepting file
    await verifyProjectAccess(params.projectId, session.userId);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    // Validation
    if (!file) {
      return NextResponse.json({ error: "No file provided. Include a 'file' field in the form." }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Invalid file type. Only PDF files are accepted." },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Uploaded file is empty." }, { status: 400 });
    }

    const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File exceeds the 50 MB size limit." },
        { status: 400 }
      );
    }

    // Save the raw file to disk
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageFileName = `${params.projectId}_${Date.now()}_${safeFileName}`;
    const storagePath = path.join(UPLOADS_DIR, storageFileName);

    const arrayBuffer = await file.arrayBuffer();
    fs.writeFileSync(storagePath, Buffer.from(arrayBuffer));

    // Create the Material record with QUEUED status
    const material = await prisma.material.create({
      data: {
        projectId: params.projectId,
        userId: session.userId,
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: file.type || "application/pdf",
        storagePath,
        status: "QUEUED",
      },
    });

    // Record upload event
    await prisma.learningEvent.create({
      data: {
        userId: session.userId,
        projectId: params.projectId,
        eventType: "MATERIAL_UPLOADED",
        payload: JSON.stringify({
          materialId: material.id,
          fileName: material.fileName,
          fileSizeBytes: material.fileSizeBytes,
        }),
      },
    });

    // ── Background Processing Decision ────────────────────────────────────────
    // Engineering decision (documented in phase2_plan.md):
    // We use setImmediate() to detach processing from the HTTP response.
    // The API returns 202 immediately; processing runs async in the same process.
    // Trade-off: if the server restarts mid-processing, the job is lost and
    // status stays PROCESSING. The /retry endpoint recovers this case.
    setImmediate(() => {
      processMaterial(material.id).catch((err) =>
        console.error("[Upload Route] Unhandled processing error:", err)
      );
    });

    return NextResponse.json(
      {
        material: {
          id: material.id,
          fileName: material.fileName,
          status: material.status,
          createdAt: material.createdAt,
        },
        message: "File uploaded successfully. Processing started in background.",
      },
      { status: 202 }
    );
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process upload. Please try again." },
      { status: 500 }
    );
  }
}
