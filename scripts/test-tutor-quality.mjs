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

  const questions = [
    "What does sigma mean?",
    "What is Radial Basis Functions?",
    "What is the difference between lazy learning and eager learning?",
  ];

  for (const q of questions) {
    console.log(`\n==============================================`);
    console.log(`QUESTION: ${q}`);
    console.log(`==============================================`);
    const res = await fetch(`${BASE_URL}/api/projects/${project.id}/tutor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        prompt: q,
        materialId: material.id,
      }),
    });

    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Answer:\n", data.message?.content);
    console.log("Citation:", data.message?.citations?.[0]?.fileName, "Page:", data.message?.citations?.[0]?.pageNumber);
  }
}

main().finally(() => prisma.$disconnect());
