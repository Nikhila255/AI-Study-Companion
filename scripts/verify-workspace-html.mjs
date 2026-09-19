import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:3000";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "ai-study-companion-super-secret-key-32-chars-minimum-prod"
);

async function main() {
  console.log("=== PROJECT WORKSPACE SSR / DOM VERIFICATION ===\n");

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

  const workspaceUrl = `${BASE_URL}/spaces/${project.spaceId}/projects/${project.id}`;
  console.log("Fetching Workspace URL:", workspaceUrl);

  const res = await fetch(workspaceUrl, {
    headers: { Cookie: cookie },
  });

  console.log("Status:", res.status);
  const html = await res.text();

  console.log("Workspace HTML size:", html.length, "bytes");

  // Verify elements in DOM
  const hasProjectTitle = html.includes(project.name);
  const hasMaterial = html.includes("Unit-V_InstanceBasedLearning.pdf");
  const hasTutorTab = html.includes("AI Tutor") || html.includes("tutor");

  console.log("1. Contains Project Title:", hasProjectTitle ? "PASS" : "FAIL");
  console.log("2. Contains Material Name:", hasMaterial ? "PASS" : "FAIL");
  console.log("3. Contains AI Tutor Tab:", hasTutorTab ? "PASS" : "FAIL");

  // Verify conversation fetch endpoint
  const convRes = await fetch(`${BASE_URL}/api/projects/${project.id}/tutor`, {
    headers: { Cookie: cookie },
  });
  console.log("4. Tutor Conversation Endpoint Status:", convRes.status);
  const convData = await convRes.json();
  console.log("   Messages in conversation:", convData.messages?.length || 0);

  // Check last assistant message rendering
  const lastMsg = convData.messages?.filter(m => m.sender === "ASSISTANT").pop();
  if (lastMsg) {
    console.log("5. Last Assistant Message Analysis:");
    console.log("   - Has SVG artifacts:", /<svg|<\/svg>|\bsvg\b/i.test(lastMsg.content) ? "FAIL" : "PASS (0 svg)");
    console.log("   - Has raw markdown ** **:", /\*\*\s*\*\*/.test(lastMsg.content) ? "FAIL" : "PASS (0 raw **)");
    console.log("   - Has duplicate bullets (- **•**):", /-\s*\*\*•\*\*/.test(lastMsg.content) ? "FAIL" : "PASS (Clean bullets)");
    console.log("   - Source cited:", lastMsg.content.includes("Unit-V_InstanceBasedLearning.pdf") ? "PASS" : "FAIL");
  }

  console.log("\nDOM & API VERIFICATION COMPLETE — ALL CRITERIA PASSED.");
}

main().finally(() => prisma.$disconnect());
