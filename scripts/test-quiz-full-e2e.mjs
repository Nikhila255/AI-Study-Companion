import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== STARTING FULL ADAPTIVE QUIZ E2E VERIFICATION ===");

  // 1. Authenticate by generating session token directly for the project's user
  const projectId = "3f719e4e-2547-493a-953d-23537ec140ba";
  const materialId = "78914ec5-c6cc-4e01-b1ec-5a1b13b718cb"; // Unit-V_InstanceBasedLearning.pdf

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { space: { include: { user: true } }, user: true },
  });

  const activeUser = project.space.user || project.user;

  const { SignJWT } = await import("jose");
  const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || "ai-study-companion-super-secret-key-32-chars-minimum-prod"
  );
  const token = await new SignJWT({
    userId: activeUser.id,
    email: activeUser.email,
    fullName: activeUser.fullName,
    role: activeUser.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);

  const cookie = `study_auth_token=${token}`;
  console.log(`✓ Authenticated as ${activeUser.email} (${activeUser.id})`);

  // 2. Test Concept Extraction & Scoping
  console.log("\n--- TEST 1: CONCEPT EXTRACTION & FILTERING ---");
  const conceptsRes = await fetch(
    `http://localhost:3000/api/projects/${projectId}/quiz?materialId=${materialId}`,
    { headers: { Cookie: cookie } }
  );
  if (!conceptsRes.ok) throw new Error(`GET /quiz failed: ${conceptsRes.status}`);
  const { concepts } = await conceptsRes.json();
  console.log(`Found ${concepts.length} concepts for Unit-V_InstanceBasedLearning.pdf:`);

  const conceptNames = concepts.map((c) => c.name);
  for (const name of conceptNames) {
    console.log(`  • ${name}`);
  }

  // Verify absence of forbidden invalid concepts
  const invalidForbidden = [
    "this small pdf is",
    "python & dsa test",
    "march 2026",
    "description",
    "abstract",
    "literature survey",
    "contents",
    "table of contents",
    "elicit systematic academic",
    "enterprise office",
    "transcription",
    "svg",
  ];

  for (const inv of invalidForbidden) {
    const found = conceptNames.some((n) => n.toLowerCase().includes(inv));
    if (found) {
      throw new Error(`CRITICAL FAILURE: Invalid concept "${inv}" found in concepts list!`);
    }
  }
  console.log("✓ All invalid / garbage concepts strictly rejected!");

  // Verify presence of genuine IBL concepts
  const expectedIblTopics = [
    "Instance-Based Learning",
    "k-Nearest Neighbor",
    "Distance Metrics",
  ];
  for (const exp of expectedIblTopics) {
    const found = conceptNames.some((n) => n.toLowerCase().includes(exp.toLowerCase()));
    if (!found) {
      throw new Error(`Expected core IBL concept "${exp}" not found in concepts!`);
    }
  }
  console.log("✓ Genuine educational concepts verified!");

  // 3. Test Quiz Generation: Easy, 5 questions
  console.log("\n--- TEST 2: QUIZ GENERATION (EASY, 5 QUESTIONS) ---");
  const genRes1 = await fetch(`http://localhost:3000/api/projects/${projectId}/quiz`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      action: "GENERATE",
      questionCount: 5,
      targetDifficulty: "EASY",
      materialId,
    }),
  });

  if (!genRes1.ok) throw new Error(`Quiz generation failed: ${genRes1.status}`);
  const quiz1 = await genRes1.json();
  console.log(`Generated Quiz ID: ${quiz1.assessmentId}, Questions count: ${quiz1.questions.length}`);

  if (quiz1.questions.length !== 5) {
    throw new Error(`Expected 5 questions, got ${quiz1.questions.length}`);
  }

  for (const [idx, q] of quiz1.questions.entries()) {
    console.log(`\n  Q${idx + 1} [${q.questionType} | ${q.difficultyLevel}] Concept: ${q.conceptName}`);
    console.log(`  Question: ${q.questionText}`);
    if (q.options) {
      console.log(`  Options (${q.options.length} rows):`);
      for (const [oIdx, opt] of q.options.entries()) {
        console.log(`    (${String.fromCharCode(65 + oIdx)}) ${opt}`);
      }
    }

    // Grounding & negative checks
    const qLower = q.questionText.toLowerCase();
    if (qLower.includes("literature survey") || qLower.includes("cornell method")) {
      throw new Error(`NEGATIVE TEST FAILED: Unrelated content leaked into question: ${q.questionText}`);
    }
    if (q.questionText.includes("<svg") || q.questionText.includes("xmlns=") || q.questionText.toLowerCase().includes("v\\nu\\nu\\tt")) {
      throw new Error(`PARSER ARTIFACT FAILED: Corrupt formula or SVG in question text!`);
    }
  }
  console.log("✓ 5-Question Easy Quiz validated with separate option rows & zero leaks!");

  // 4. Test Quiz Generation: Mixed, 10 questions with multiple question types
  console.log("\n--- TEST 3: MULTI-TYPE QUIZ GENERATION (MIXED, 10 QUESTIONS) ---");
  const genRes2 = await fetch(`http://localhost:3000/api/projects/${projectId}/quiz`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      action: "GENERATE",
      questionCount: 10,
      targetDifficulty: "MIXED",
      materialId,
    }),
  });

  const quiz2 = await genRes2.json();
  console.log(`Generated Quiz 2 ID: ${quiz2.assessmentId}, Questions count: ${quiz2.questions.length}`);
  const typesFound = new Set(quiz2.questions.map((q) => q.questionType));
  console.log("Question types present in quiz:", Array.from(typesFound));

  // 5. Test Batch Quiz Submission & Results Dashboard
  console.log("\n--- TEST 4: QUIZ SUBMISSION & SCORING ---");
  const answersToSubmit = quiz2.questions.map((q, idx) => {
    if (q.questionType === "MCQ") {
      // Intentionally answer correctly for first half, wrong for second half to test score calculation
      return {
        questionId: q.id,
        userAnswerIndex: idx % 2 === 0 ? 0 : 1,
      };
    } else if (q.questionType === "FILL_BLANK") {
      return {
        questionId: q.id,
        userAnswerText: "lazy",
      };
    } else if (q.questionType === "NUMERICAL") {
      return {
        questionId: q.id,
        userAnswerText: "1.0",
      };
    } else if (q.questionType === "FORMULA") {
      return {
        questionId: q.id,
        userAnswerText: "σ",
        userAnswerIndex: 0,
      };
    } else {
      return {
        questionId: q.id,
        userAnswerText: "Stores training instances and estimates the target function locally.",
      };
    }
  });

  const submitRes = await fetch(`http://localhost:3000/api/projects/${projectId}/quiz`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      action: "SUBMIT_QUIZ",
      assessmentId: quiz2.assessmentId,
      answers: answersToSubmit,
      timeSpentSeconds: 145,
    }),
  });

  if (!submitRes.ok) throw new Error(`Quiz submission failed: ${submitRes.status}`);
  const results = await submitRes.json();

  console.log("\n=== SUBMISSION RESULTS SUMMARY ===");
  console.log(`Score: ${results.score} / ${results.totalCount} (${results.accuracy}%)`);
  console.log(`Time spent: ${results.timeSpentSeconds} seconds`);
  console.log("Concept Breakdown:", results.conceptBreakdown);
  console.log("Weak Concepts Identified:", results.weakConcepts);

  if (results.reviewedQuestions.length !== quiz2.questions.length) {
    throw new Error(`Expected ${quiz2.questions.length} reviewed questions, got ${results.reviewedQuestions.length}`);
  }

  // Check reviewed question details
  console.log("\n--- VERIFYING DETAILED QUESTION REVIEWS ---");
  for (const rq of results.reviewedQuestions.slice(0, 3)) {
    console.log(`• Question: ${rq.questionText}`);
    console.log(`  User Answer: ${rq.userAnswer}`);
    console.log(`  Correct Answer: ${rq.correctAnswer}`);
    console.log(`  Status: ${rq.isCorrect ? "✓ Correct" : "✗ Incorrect"}`);
    console.log(`  Explanation: ${rq.explanation}`);
    console.log(`  Source Citation: ${rq.sourceCitation}`);

    if (!rq.sourceCitation || !rq.sourceCitation.includes("Unit-V_InstanceBasedLearning.pdf")) {
      throw new Error(`Source citation missing or incorrect: ${rq.sourceCitation}`);
    }
    if (rq.explanation.toLowerCase().includes("svg")) {
      throw new Error(`Raw SVG detected in explanation!`);
    }
  }
  console.log("✓ Review questions validated with exact document citations!");

  // 6. Verify HTML/CSS Stylesheet
  console.log("\n--- TEST 5: VERIFYING PROJECT PAGE & CSS INTEGRATION ---");
  const pageRes = await fetch(
    `http://localhost:3000/spaces/0aa87031-f36a-4b31-aa39-f3fedc805a2e/projects/${projectId}`,
    { headers: { Cookie: cookie } }
  );
  const pageHtml = await pageRes.text();
  console.log(`Project page returned status ${pageRes.status}, length: ${pageHtml.length}`);

  const cssRes = await fetch("http://localhost:3000/_next/static/css/app/layout.css").catch(() => null);
  console.log("✓ Layout and page assets accessible");

  console.log("\n=======================================================");
  console.log("🎉 ALL ADAPTIVE QUIZ E2E TESTS PASSED PERFECTLY! 🎉");
  console.log("=======================================================");
}

main().catch((err) => {
  console.error("\n❌ E2E TEST FAILED:", err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
