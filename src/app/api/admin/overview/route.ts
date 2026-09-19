import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { verifyAdminAccess, AuthorizationError } from "@/lib/security";
import { prisma } from "@/lib/db";

// ─── GET /api/admin/overview ─────────────────────────────────────────────────
// Restricted to ADMIN users only. Returns complete platform observability metrics.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await verifyAdminAccess(session.userId);

    // 1. User metrics
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            spaces: true,
            projects: true,
            attempts: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 2. Project metrics
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        learningGoal: true,
        createdAt: true,
        user: { select: { email: true, fullName: true } },
        _count: {
          select: {
            materials: true,
            concepts: true,
            assessments: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // 3. Materials status breakdown
    const materials = await prisma.material.findMany({
      select: {
        id: true,
        fileName: true,
        status: true,
        errorMessage: true,
        totalPages: true,
        createdAt: true,
        user: { select: { email: true } },
        project: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const materialStatusCounts = {
      QUEUED: materials.filter((m) => m.status === "QUEUED").length,
      PROCESSING: materials.filter((m) => m.status === "PROCESSING").length,
      READY: materials.filter((m) => m.status === "READY").length,
      FAILED: materials.filter((m) => m.status === "FAILED").length,
    };

    // 4. AI Request Logs & Observability
    const aiLogs = await prisma.aIRequestLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { email: true } },
        project: { select: { name: true } },
      },
    });

    const totalAIRequests = await prisma.aIRequestLog.count();
    const successfulAIRequests = await prisma.aIRequestLog.count({ where: { isSuccess: true } });
    const failedAIRequests = totalAIRequests - successfulAIRequests;

    const allLogsForCost = await prisma.aIRequestLog.findMany({
      select: { estimatedCostUsd: true, latencyMs: true, totalTokens: true },
    });

    const totalTokens = allLogsForCost.reduce((a, b) => a + b.totalTokens, 0);
    const totalCostUsd = Number(allLogsForCost.reduce((a, b) => a + b.estimatedCostUsd, 0).toFixed(4));
    const avgLatencyMs =
      allLogsForCost.length > 0
        ? Math.round(allLogsForCost.reduce((a, b) => a + b.latencyMs, 0) / allLogsForCost.length)
        : 0;

    // 5. Recent Learning Events
    const recentEvents = await prisma.learningEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        user: { select: { email: true } },
        project: { select: { name: true } },
      },
    });

    // 6. System Health check
    const systemHealth = {
      database: "CONNECTED",
      databaseType: "SQLite",
      uptimeSeconds: Math.round(process.uptime()),
      memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({
      summary: {
        totalUsers: users.length,
        totalProjects: await prisma.project.count(),
        totalMaterials: await prisma.material.count(),
        totalConcepts: await prisma.concept.count(),
        totalAIRequests,
        totalTokens,
        totalCostUsd,
        avgLatencyMs,
        aiSuccessRate: totalAIRequests > 0 ? Number(((successfulAIRequests / totalAIRequests) * 100).toFixed(1)) : 100,
      },
      users,
      projects,
      materialStatusCounts,
      recentMaterials: materials,
      aiLogs: aiLogs.map((log) => ({
        id: log.id,
        featureArea: log.featureArea,
        modelName: log.modelName,
        totalTokens: log.totalTokens,
        latencyMs: log.latencyMs,
        isSuccess: log.isSuccess,
        estimatedCostUsd: log.estimatedCostUsd,
        errorMessage: log.errorMessage,
        createdAt: log.createdAt,
        userEmail: log.user?.email || "System",
        projectName: log.project?.name || "Global",
      })),
      recentEvents: recentEvents.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        userEmail: e.user.email,
        projectName: e.project?.name || "Global",
        createdAt: e.createdAt,
      })),
      systemHealth,
    });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[Admin API Error]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
