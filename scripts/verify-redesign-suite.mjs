import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:3000";
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "ai-study-companion-super-secret-key-32-chars-minimum-prod"
);

async function createToken(user) {
  return new SignJWT({
    userId: user.id,
    email: user.email,
    fullName: user.fullName || "Test User",
    role: user.role || "LEARNER",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

async function run() {
  console.log("================================================================================");
  console.log("  VERIFYING MASTER UX/UI REDESIGN — MASTERY, RECOMMENDATIONS, ANALYTICS");
  console.log("================================================================================\n");

  const project = await prisma.project.findUnique({
    where: { id: "3f719e4e-2547-493a-953d-23537ec140ba" },
    include: {
      user: true,
      space: true,
      materials: true,
    },
  });

  if (!project) throw new Error("Project not found");

  const user = await prisma.user.findUnique({ where: { id: project.space.userId } });
  const token = await createToken(user);
  const cookie = `study_auth_token=${token}`;
  const material = project.materials[0];

  console.log(`[TARGET] Project: ${project.name} (${project.id})`);
  console.log(`[TARGET] Material: ${material?.fileName} (${material?.id})\n`);

  let allPassed = true;
  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
    } else {
      console.error(`  [FAIL] ${message}`);
      allPassed = false;
    }
  }

  // 1. Mastery & Growth API & Data Scoping
  console.log("--- 1. MASTERY & GROWTH ---");
  const masteryUrl = `${BASE_URL}/api/projects/${project.id}/mastery?materialId=${material.id}`;
  const masteryRes = await fetch(masteryUrl, { headers: { Cookie: cookie } });
  assert(masteryRes.status === 200, `Mastery API returns HTTP 200 (Got ${masteryRes.status})`);
  const masteryData = await masteryRes.json();
  assert(typeof masteryData.overallMastery === "number", `Overall mastery is a valid percentage (${masteryData.overallMastery}%)`);
  assert(Array.isArray(masteryData.practiced), `Practiced concepts returned (${masteryData.practiced?.length} items)`);
  assert(Array.isArray(masteryData.improving), `Improving track returned (${masteryData.improving?.length} items)`);
  assert(Array.isArray(masteryData.stable), `Stable track returned (${masteryData.stable?.length} items)`);
  assert(Array.isArray(masteryData.requiringAttention), `Requiring attention returned (${masteryData.requiringAttention?.length} items)`);
  
  // Verify clean text (no raw svg text)
  const masteryJsonStr = JSON.stringify(masteryData);
  assert(!masteryJsonStr.includes("svgRefresh") && !masteryJsonStr.includes("svgStrong"), "Zero raw svg artifacts in Mastery payload");

  // 2. Recommendations API & Data Scoping
  console.log("\n--- 2. RECOMMENDATIONS ---");
  const recUrl = `${BASE_URL}/api/projects/${project.id}/recommendations?materialId=${material.id}`;
  const recRes = await fetch(recUrl, { headers: { Cookie: cookie } });
  assert(recRes.status === 200, `Recommendations API returns HTTP 200 (Got ${recRes.status})`);
  const recData = await recRes.json();
  assert(Array.isArray(recData.focusItems || recData.recommendations), `Focus items / recommendations returned (${(recData.focusItems || recData.recommendations)?.length} items)`);
  assert(Array.isArray(recData.studyPlan), `Study roadmap steps returned (${recData.studyPlan?.length} steps)`);
  assert(Array.isArray(recData.strengths), `Student strengths returned (${recData.strengths?.length} items)`);
  assert(Array.isArray(recData.improving), `Improving concepts returned (${recData.improving?.length} items)`);

  const recJsonStr = JSON.stringify(recData);
  assert(!recJsonStr.includes("svgRefresh"), "Zero raw svg artifacts in Recommendations payload");

  // 3. Learning Analytics API & Data Scoping
  console.log("\n--- 3. LEARNING ANALYTICS ---");
  const analUrl = `${BASE_URL}/api/projects/${project.id}/analytics?materialId=${material.id}`;
  const analRes = await fetch(analUrl, { headers: { Cookie: cookie } });
  assert(analRes.status === 200, `Analytics API returns HTTP 200 (Got ${analRes.status})`);
  const analData = await analRes.json();
  assert(analData.yourProgress !== undefined, "yourProgress metrics present");
  assert(analData.quizPerformance !== undefined, "quizPerformance metrics present");
  assert(analData.assessmentPerformance !== undefined, "assessmentPerformance metrics present");
  assert(Array.isArray(analData.recentLearning), `recentLearning timeline events present (${analData.recentLearning?.length} events)`);
  assert(analData.studyMaterials !== undefined, `studyMaterials metadata present (File: ${analData.studyMaterials?.fileName})`);
  assert(Array.isArray(analData.practicedConcepts), `practicedConcepts present (${analData.practicedConcepts?.length} concepts)`);
  assert(Array.isArray(analData.unpracticedConcepts), `unpracticedConcepts present (${analData.unpracticedConcepts?.length} concepts)`);

  const analJsonStr = JSON.stringify(analData);
  assert(!analJsonStr.includes("svgRefresh"), "Zero raw svg artifacts in Analytics payload");

  // 4. Project Workspace HTML SSR Check
  console.log("\n--- 4. WORKSPACE HTML & DOM STRUCTURE ---");
  const workspaceUrl = `${BASE_URL}/spaces/${project.spaceId}/projects/${project.id}`;
  const wsRes = await fetch(workspaceUrl, { headers: { Cookie: cookie } });
  assert(wsRes.status === 200, `Workspace route returns HTTP 200 (Got ${wsRes.status})`);
  const html = await wsRes.text();
  assert(html.includes("Mastery"), "HTML includes Mastery tab");
  assert(html.includes("Recommendations"), "HTML includes Recommendations tab");
  assert(html.includes("Analytics"), "HTML includes Analytics tab");
  assert(!html.includes("svgRefresh"), "HTML contains zero 'svgRefresh' concatenation artifacts");
  assert(!html.includes("svgStrong"), "HTML contains zero 'svgStrong' concatenation artifacts");
  assert(!html.includes("ExampleStrong"), "HTML contains zero 'ExampleStrong' concatenation artifacts");

  console.log("\n================================================================================");
  if (allPassed) {
    console.log("  ALL REDESIGN VERIFICATION CHECKS PASSED SUCCESSFULLY!");
  } else {
    console.error("  SOME CHECKS FAILED!");
  }
  console.log("================================================================================\n");
}

run().finally(() => prisma.$disconnect());
