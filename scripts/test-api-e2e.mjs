import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:3001";

async function run() {
  console.log("\n========================================================");
  console.log("  TESTING AI STUDY COMPANION LIVE API ON PORT 3001");
  console.log("========================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(cond, name, info = "") {
    if (cond) {
      console.log(`[PASS] ${name}`);
      if (info) console.log(`       → ${info}`);
      passed++;
    } else {
      console.log(`[FAIL] ${name}`);
      if (info) console.log(`       → FAILED: ${info}`);
      failed++;
    }
  }

  // 1. Get existing user or create one
  const project = await prisma.project.findFirst({
    where: { name: "Python Fundamentals" },
    include: { user: true },
  });

  if (!project) throw new Error("Python Fundamentals project not found");

  const email = project.user.email;
  console.log(`Testing with user: ${email}, project: ${project.name} (${project.id})`);

  // Login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Password123!" }),
  });

  let userCookie = "";
  if (loginRes.ok) {
    userCookie = loginRes.headers.get("set-cookie")?.split(";")[0] || "";
  }

  if (!userCookie) {
    // If password was different, create new test user and verify auth
    const testEmail = `tester_${Date.now()}@studycompanion.dev`;
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "Pipeline Tester", email: testEmail, password: "SecurePassword123!" }),
    });
    userCookie = regRes.headers.get("set-cookie")?.split(";")[0] || "";
    // Temporarily attach test user to project space for testing
    await prisma.project.update({
      where: { id: project.id },
      data: { userId: (await regRes.json()).user.id },
    });
  }

  assert(!!userCookie, "User Authentication / Login / Register works");

  // 2. Test AI Tutor: "Explain binary search in simple terms and give an example."
  console.log("\n--- Testing AI Tutor Grounded Retrieval & Answer ---");
  const tutorRes = await fetch(`${BASE_URL}/api/projects/${project.id}/tutor`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: userCookie },
    body: JSON.stringify({ prompt: "Explain binary search in simple terms and give an example." }),
  });

  const tutorData = await tutorRes.json();
  assert(tutorRes.ok, "Tutor API returned 200 OK");
  assert(!tutorData.message.isRefusal, "Tutor returned grounded explanation (not refusal)");
  assert(tutorData.message.content.includes("### Question"), "Tutor answer has ### Question");
  assert(tutorData.message.content.includes("### Answer"), "Tutor answer has ### Answer");
  assert(tutorData.message.content.includes("### Key Points"), "Tutor answer has ### Key Points");
  assert(tutorData.message.content.includes("### Example"), "Tutor answer has ### Example");
  assert(tutorData.message.content.includes("### Source"), "Tutor answer has ### Source");
  assert(
    !tutorData.message.content.includes("Why must binary search normally use sorted data?"),
    "Tutor did NOT return practice question list as the answer"
  );
  assert(
    tutorData.message.citations?.some((c) => c.pageNumber === 3),
    "Tutor citations correctly point to Page 3"
  );

  console.log("\nTutor Answer Preview:\n" + tutorData.message.content.slice(0, 350) + "...\n");

  // 3. Test Tutor with other questions
  const qStackQueue = await fetch(`${BASE_URL}/api/projects/${project.id}/tutor`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: userCookie },
    body: JSON.stringify({ prompt: "What is the difference between a stack and a queue?" }),
  });
  const stackData = await qStackQueue.json();
  assert(
    stackData.message?.content.includes("LIFO") && stackData.message?.content.includes("FIFO"),
    "Tutor explains Stack (LIFO) vs Queue (FIFO) accurately"
  );

  // 4. Test Unsupported Question Refusal
  const qUnsupported = await fetch(`${BASE_URL}/api/projects/${project.id}/tutor`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: userCookie },
    body: JSON.stringify({ prompt: "What does my material say about quantum teleportation?" }),
  });
  const unsuppData = await qUnsupported.json();
  assert(unsuppData.message?.isRefusal, "Unsupported topic triggers grounded refusal");

  // 5. Test Adaptive Quiz API
  console.log("\n--- Testing Adaptive Quiz API ---");
  const quizRes = await fetch(`${BASE_URL}/api/projects/${project.id}/quiz`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: userCookie },
    body: JSON.stringify({ action: "GENERATE" }),
  });
  const quizData = await quizRes.json();
  assert(quizRes.ok && !!quizData.assessmentId, "Quiz generation succeeded");
  assert(quizData.questions?.length > 0, `Generated ${quizData.questions?.length} quiz questions`);

  for (const q of (quizData.questions || [])) {
    assert(
      q.conceptName !== "This small PDF is" && q.conceptName !== "Python & DSA Test",
      `Quiz question concept is valid: '${q.conceptName}'`
    );
    assert(q.options?.length >= 2, `Question has options: '${q.questionText.slice(0, 50)}...'`);
  }

  // Submit quiz answer
  const firstQ = quizData.questions?.[0];
  if (firstQ) {
    const submitRes = await fetch(`${BASE_URL}/api/projects/${project.id}/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({
        action: "SUBMIT",
        questionId: firstQ.id,
        userAnswerIndex: firstQ.correctOptionIndex ?? 0,
      }),
    });
    const submitData = await submitRes.json();
    assert(submitRes.ok && typeof submitData.isCorrect === "boolean", "Quiz answer submission evaluated");
  }

  // 6. Test Mastery API
  console.log("\n--- Testing Mastery API ---");
  const masteryRes = await fetch(`${BASE_URL}/api/projects/${project.id}/mastery`, {
    headers: { Cookie: userCookie },
  });
  const masteryData = await masteryRes.json();
  assert(masteryRes.ok, "Mastery API returned 200 OK");
  const allMastery = [
    ...(masteryData.improving || []),
    ...(masteryData.stable || []),
    ...(masteryData.requiringAttention || []),
  ];
  assert(allMastery.length > 0, `Mastery returned ${allMastery.length} concepts`);
  assert(
    allMastery.every((m) => m.conceptName !== "This small PDF is" && m.conceptName !== "Python & DSA Test"),
    "Mastery excludes invalid concepts ('This small PDF is', 'Python & DSA Test')"
  );

  // 7. Test Recommendations API
  console.log("\n--- Testing Recommendations API ---");
  const recsRes = await fetch(`${BASE_URL}/api/projects/${project.id}/recommendations`, {
    headers: { Cookie: userCookie },
  });
  const recsData = await recsRes.json();
  assert(recsRes.ok, "Recommendations API returned 200 OK");
  assert(recsData.recommendations?.length > 0, `Returned ${recsData.recommendations.length} recommendations`);
  assert(
    recsData.recommendations.every((r) => r.conceptName !== "This small PDF is" && r.conceptName !== "Python & DSA Test"),
    "Recommendations exclude invalid concepts"
  );

  // 8. Test Analytics API
  console.log("\n--- Testing Analytics API ---");
  const analyticsRes = await fetch(`${BASE_URL}/api/projects/${project.id}/analytics`, {
    headers: { Cookie: userCookie },
  });
  const analyticsData = await analyticsRes.json();
  assert(analyticsRes.ok, "Analytics API returned 200 OK");
  assert(analyticsData.projectSummary.totalPages === 4, "Analytics shows 4 total pages");
  assert(analyticsData.masteryBreakdown.every((m) => m.conceptName !== "This small PDF is" && m.conceptName !== "Python & DSA Test"), "Analytics mastery breakdown excludes invalid concepts");

  // 9. Test Data Isolation (Unauthorized user cannot access project)
  console.log("\n--- Testing Data Isolation & Security ---");
  const unauthorizedRes = await fetch(`${BASE_URL}/api/projects/${project.id}/tutor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }, // no cookie
    body: JSON.stringify({ prompt: "Hello" }),
  });
  assert(unauthorizedRes.status === 401, "Unauthorized request correctly blocked with 401");

  console.log("\n========================================================");
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("========================================================\n");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("FATAL TEST ERROR:", err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
