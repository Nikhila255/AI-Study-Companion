import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:3000";
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "ai-study-companion-super-secret-key-32-chars-minimum-prod"
);

async function main() {
  const material = await prisma.material.findFirst({
    where: { fileName: { contains: "InstanceBasedLearning" }, status: "READY" },
    include: { project: { include: { space: { include: { user: true } }, user: true } } },
  });

  const project = material.project;
  const user = project.space?.user || project.user;

  const token = await new SignJWT({
    userId: user.id,
    email: user.email,
    fullName: user.fullName || "Test User",
    role: user.role || "USER",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);

  const cookie = `study_auth_token=${token}`;

  console.log("Asking: 'What is decision tree?'");
  const res = await fetch(`${BASE_URL}/api/projects/${project.id}/tutor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      prompt: "What is decision tree?",
      materialId: material.id,
    }),
  });

  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Response Content:\n", data.message?.content);
  console.log("Citations:\n", data.message?.citations);
}

main().finally(() => prisma.$disconnect());
