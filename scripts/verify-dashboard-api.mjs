import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "ai-study-companion-super-secret-key-32-chars-minimum-prod"
);

async function check() {
  const mat = await prisma.material.findFirst({
    where: { fileName: { contains: "InstanceBasedLearning" }, status: "READY" },
    include: { project: { include: { space: { include: { user: true } }, user: true } } },
  });
  const project = mat.project;
  const user = project.space?.user || project.user;
  const token = await new SignJWT({ userId: user.id, email: user.email, role: "USER" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(JWT_SECRET);

  const res = await fetch(`http://localhost:3000/api/projects/${project.id}/dashboard`, {
    headers: { Cookie: `study_auth_token=${token}` },
  });
  console.log("Dashboard API Status:", res.status);
  const data = await res.json();
  console.log("Project Name:", data.project?.name);
  console.log("Materials:", data.project?.materials?.map((m) => m.fileName));
}

check().finally(() => prisma.$disconnect());
