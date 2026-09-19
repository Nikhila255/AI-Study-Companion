import { prisma } from "./db";

export class AuthorizationError extends Error {
  constructor(message = "Access denied: Resource not found or unauthorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Validates that a Space belongs directly to the authenticated user.
 * Prevents cross-tenant / horizontal privilege escalation.
 */
export async function verifySpaceAccess(spaceId: string, userId: string) {
  const space = await prisma.space.findFirst({
    where: {
      id: spaceId,
      userId: userId,
    },
    include: {
      projects: {
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!space) {
    throw new AuthorizationError("Space not found or unauthorized");
  }

  return space;
}

/**
 * Validates that a Project belongs directly to the authenticated user.
 * Project-level isolation is strictly enforced across all operations.
 */
export async function verifyProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      space: {
        userId: userId,
      },
    },
    include: {
      space: true,
      materials: {
        orderBy: { createdAt: "desc" },
      },
      concepts: {
        orderBy: { importanceScore: "desc" },
      },
      masteryRecords: {
        include: {
          concept: true,
        },
      },
      recommendations: {
        where: { isDismissed: false },
        orderBy: { priority: "asc" },
      },
    },
  });

  if (!project) {
    throw new AuthorizationError("Project not found or unauthorized");
  }

  return project;
}

/**
 * Validates that the authenticated user possesses the ADMIN role.
 * Restricts administrative endpoints and system metrics.
 */
export async function verifyAdminAccess(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true, role: true },
  });

  if (!user || user.role !== "ADMIN") {
    throw new AuthorizationError("Access denied: Admin privileges required");
  }

  return user;
}
