import { PrismaClient } from "@prisma/client";
import { searchProjectChunks } from "../src/lib/embeddings.js";
import { generateTutorResponse } from "../src/lib/ai-service.js";
import { isValidEducationalConcept, filterValidConcepts } from "../src/lib/concept-extractor.js";
import { generateAdaptiveQuiz } from "../src/lib/quiz-service.js";
import { getProjectGrowthAnalysis } from "../src/lib/mastery.js";
import { generateProjectRecommendations } from "../src/lib/recommendations.js";
import { generateOpenEndedQuestion } from "../src/lib/assessment-service.js";

const prisma = new PrismaClient();

async function main() {
  console.log("\n========================================================");
  console.log("  AI STUDY COMPANION — COMPREHENSIVE PIPELINE VERIFICATION");
  console.log("========================================================\n");

  const project = await prisma.project.findFirst({
    where: { name: "Python Fundamentals" },
    include: { materials: true, user: true },
  });

  if (!project) {
    throw new Error("Project 'Python Fundamentals' not found!");
  }

  const projectId = project.id;
  const userId = project.userId;
  console.log(`Testing with Project: ${project.name} (ID: ${projectId})`);

  let allPassed = true;

  function assert(condition, testName, detail = "") {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      if (detail) console.log(`       → ${detail}`);
    } else {
      console.log(`[FAIL] ${testName}`);
      if (detail) console.log(`       → FAILED: ${detail}`);
      allPassed = false;
    }
  }

  // ── TEST 1: Concept Validation & Sanitization ──
  console.log("\n--- TEST 1: Concept Validation & Sanitization ---");
  assert(!isValidEducationalConcept("This small PDF is"), "Rejects 'This small PDF is'");
  assert(!isValidEducationalConcept("Python & DSA Test"), "Rejects 'Python & DSA Test'");
  assert(!isValidEducationalConcept("Purpose"), "Rejects 'Purpose'");
  assert(!isValidEducationalConcept("Practice Questions"), "Rejects 'Practice Questions'");
  assert(!isValidEducationalConcept("4. Why must binary search normally use sorted data?"), "Rejects question sentence");
  assert(isValidEducationalConcept("Binary Search"), "Accepts 'Binary Search'");
  assert(isValidEducationalConcept("Data Structures"), "Accepts 'Data Structures'");
  assert(isValidEducationalConcept("Stack"), "Accepts 'Stack'");
  assert(isValidEducationalConcept("Queue"), "Accepts 'Queue'");
  assert(isValidEducationalConcept("Time Complexity"), "Accepts 'Time Complexity'");
  assert(isValidEducationalConcept("Variables & Data Types"), "Accepts 'Variables & Data Types'");

  // ── TEST 2: Retrieval Ranking for Explanatory Queries ──
  console.log("\n--- TEST 2: Retrieval Ranking ---");
  const q1 = "Explain binary search in simple terms and give an example.";
  const res1 = await searchProjectChunks(projectId, q1, 4);
  assert(res1.length > 0, "Retrieval returned chunks for binary search query");
  assert(
    res1[0].pageNumber === 3,
    "Top ranked chunk is Page 3 (Binary Search explanation), NOT Page 4 (Practice Questions)",
    `Top chunk page: ${res1[0]?.pageNumber}, content snippet: ${res1[0]?.content.slice(0, 70)}...`
  );

  const q2 = "What is binary search?";
  const res2 = await searchProjectChunks(projectId, q2, 4);
  assert(res2[0]?.pageNumber === 3, "Query 'What is binary search?' ranks Page 3 #1");

  const q3 = "What does the uploaded material say about binary search?";
  const res3 = await searchProjectChunks(projectId, q3, 4);
  assert(res3[0]?.pageNumber === 3, "Query 'What does the uploaded material say about binary search?' ranks Page 3 #1");

  const q4 = "What is the difference between a stack and a queue?";
  const res4 = await searchProjectChunks(projectId, q4, 4);
  assert(
    res4[0]?.pageNumber === 3 && res4[0]?.content.toLowerCase().includes("stack") && res4[0]?.content.toLowerCase().includes("queue"),
    "Query 'What is the difference between a stack and a queue?' ranks Page 3 #1"
  );

  // ── TEST 3: AI Tutor Grounded Response & Citations ──
  console.log("\n--- TEST 3: AI Tutor Grounded Response Generation ---");
  const tutorRes = await generateTutorResponse({
    userId,
    projectId,
    learningGoal: project.learningGoal,
    userPrompt: q1,
    retrievedChunks: res1,
  });

  assert(!tutorRes.isRefusal, "Tutor provides a real grounded answer (not refusal)");
  assert(tutorRes.content.includes("### Question"), "Answer contains ### Question section");
  assert(tutorRes.content.includes("### Answer"), "Answer contains ### Answer section");
  assert(tutorRes.content.includes("### Key Points"), "Answer contains ### Key Points section");
  assert(tutorRes.content.includes("### Example"), "Answer contains ### Example section");
  assert(tutorRes.content.includes("### Source"), "Answer contains ### Source section");
  assert(tutorRes.citations.length > 0, "Response contains citation list");
  assert(
    tutorRes.citations[0].pageNumber === 3,
    "Citation points to Page 3 (source material)",
    `Cited Page: ${tutorRes.citations[0]?.pageNumber}`
  );
  assert(
    !tutorRes.content.includes("Why must binary search normally use sorted data?"),
    "Answer does NOT repeat the practice questions list"
  );

  // ── TEST 4: Unsupported Question Refusal ──
  console.log("\n--- TEST 4: Unsupported Question Handling ---");
  const unsupportedQuery = "What does my material say about quantum teleportation?";
  const unsuppChunks = await searchProjectChunks(projectId, unsupportedQuery, 3);
  const unsuppRes = await generateTutorResponse({
    userId,
    projectId,
    learningGoal: project.learningGoal,
    userPrompt: unsupportedQuery,
    retrievedChunks: unsuppChunks,
  });
  assert(unsuppRes.isRefusal, "Unsupported question triggers grounded refusal without hallucination");

  // ── TEST 5: Adaptive Quiz Generation ──
  console.log("\n--- TEST 5: Adaptive Quiz Generation ---");
  const quiz = await generateAdaptiveQuiz(projectId, userId);
  assert(!!quiz.assessmentId, "Quiz assessment created");
  assert(quiz.questions.length > 0, `Quiz questions generated (${quiz.questions.length})`);

  const createdQuestions = await prisma.assessmentQuestion.findMany({
    where: { assessmentId: quiz.assessmentId },
    include: { concept: true },
  });

  for (const q of createdQuestions) {
    assert(
      q.concept && isValidEducationalConcept(q.concept.name),
      `Quiz question concept is valid: '${q.concept?.name}'`,
      `Question: ${q.questionText}`
    );
    assert(
      q.concept?.name !== "This small PDF is" && q.concept?.name !== "Python & DSA Test",
      `Quiz question does NOT use invalid concept ('${q.concept?.name}')`
    );
  }

  // ── TEST 6: Mastery & Growth Analysis ──
  console.log("\n--- TEST 6: Mastery & Growth Analysis ---");
  const growth = await getProjectGrowthAnalysis(projectId, userId);
  const allMasteryConcepts = [
    ...growth.improving,
    ...growth.stable,
    ...growth.requiringAttention,
  ];

  for (const mc of allMasteryConcepts) {
    assert(
      isValidEducationalConcept(mc.conceptName),
      `Mastery concept is valid educational concept: '${mc.conceptName}' (score: ${mc.masteryScore}%)`
    );
    assert(
      mc.conceptName !== "This small PDF is" && mc.conceptName !== "Python & DSA Test",
      `Mastery excludes invalid concepts ('${mc.conceptName}')`
    );
  }

  // ── TEST 7: Recommendations ──
  console.log("\n--- TEST 7: Recommendations ---");
  const recs = await generateProjectRecommendations(projectId, userId);
  assert(recs.length > 0, `Recommendations generated (${recs.length})`);
  for (const r of recs) {
    if (r.conceptName) {
      assert(
        isValidEducationalConcept(r.conceptName),
        `Recommendation concept is valid: '${r.conceptName}'`
      );
      assert(
        r.conceptName !== "This small PDF is" && r.conceptName !== "Python & DSA Test",
        `Recommendation does NOT reference invalid concept ('${r.conceptName}')`
      );
    }
  }

  // ── TEST 8: Open-Ended Assessment ──
  console.log("\n--- TEST 8: Open-Ended Assessment ---");
  const openAssess = await generateOpenEndedQuestion(projectId, userId);
  assert(
    isValidEducationalConcept(openAssess.question.conceptName),
    `Open-ended assessment target concept is valid: '${openAssess.question.conceptName}'`
  );
  assert(
    openAssess.question.conceptName !== "This small PDF is" && openAssess.question.conceptName !== "Python & DSA Test",
    `Open-ended assessment does NOT use invalid concept ('${openAssess.question.conceptName}')`
  );

  console.log("\n========================================================");
  if (allPassed) {
    console.log("  ALL PIPELINE TESTS PASSED SUCCESSFULLY! ✓");
  } else {
    console.log("  SOME TESTS FAILED! ✗");
  }
  console.log("========================================================\n");
}

main().catch(console.error).finally(() => prisma.$disconnect());
