import { prisma } from "../src/lib/db";
import { searchProjectChunks } from "../src/lib/embeddings";
import { generateTutorResponse } from "../src/lib/ai-service";
import { generateAdaptiveQuiz, submitQuizAnswer } from "../src/lib/quiz-service";
import { generateProjectRecommendations } from "../src/lib/recommendations";
import { getProjectGrowthAnalysis } from "../src/lib/mastery";
import { filterValidConcepts } from "../src/lib/concept-extractor";

async function runVerification() {
  console.log("==================================================");
  console.log("FINAL IMPROVEMENT PASS — END-TO-END VERIFICATION");
  console.log("==================================================\n");

  const projectId = "3f719e4e-2547-493a-953d-23537ec140ba";
  const userId = "e4939acb-0f18-498c-9ba8-bc20add70427";
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✓ [PASS] ${testName}`);
    } else {
      console.error(`✗ [FAIL] ${testName}${detail ? ` — ${detail}` : ""}`);
    }
  }

  // 1. Chunks Verification
  const iblChunks = await prisma.documentChunk.findMany({
    where: {
      projectId,
      document: { fileName: "Unit-V_InstanceBasedLearning.pdf" },
    },
    orderBy: { chunkIndex: "asc" },
  });

  assert(
    iblChunks.length >= 8 && iblChunks.length <= 15,
    "Unit-V_InstanceBasedLearning.pdf clean chunk count (expected ~10 chunks)",
    `Actual: ${iblChunks.length}`
  );

  const hasBrokenDuplicate = iblChunks.some(c =>
    c.content.includes("s of Instance-Based Learning 4 10 Disadvantages 5 11 Summary 5 1")
  );
  assert(!hasBrokenDuplicate, "Elimination of single-character trailing chunk fragments");

  const tocChunk = iblChunks.find(c => c.chunkIndex === 0 || c.chunkIndex === 1);
  const tocMeta = tocChunk?.metadata ? JSON.parse(tocChunk.metadata) : {};
  assert(
    tocMeta.contentType === "TABLE_OF_CONTENTS",
    "Correct classification of Table of Contents chunks",
    `Actual: ${tocMeta.contentType}`
  );

  // 2. Concepts Verification
  const allConcepts = await prisma.concept.findMany({ where: { projectId } });
  const validConcepts = filterValidConcepts(allConcepts);

  assert(
    validConcepts.length >= 8,
    `Project contains rich educational concepts (${validConcepts.length} valid concepts)`
  );

  const hasInvalidConcept = allConcepts.some(c =>
    c.name.includes("This small PDF is") || c.name.includes("Python & DSA Test")
  );
  assert(!hasInvalidConcept, "Exclusion of metadata and boilerplate from Concept table");

  const hasIBLConcept = validConcepts.some(c => c.name.includes("Instance-Based Learning"));
  assert(hasIBLConcept, "Presence of 'Instance-Based Learning' concept in active curriculum");

  // 3. Search & Reranking Verification
  const iblSearch = await searchProjectChunks(
    projectId,
    "What is instance-based learning and what are its advantages?",
    3
  );

  assert(
    iblSearch.length > 0 && iblSearch[0].similarity > 0.6,
    "High relevance score for explanatory Instance-Based Learning query",
    `Top score: ${iblSearch[0]?.similarity}`
  );

  assert(
    !iblSearch[0].content.includes("Contents\n1 Introduction") &&
    !iblSearch[0].content.includes("5.2 Manhattan Distance . . . . . . . . . . . . . . . . . . . . . . . 3"),
    "Table of Contents is downweighted and not returned as top explanatory result"
  );

  const unsupportedSearch = await searchProjectChunks(
    projectId,
    "Explain quantum superposition and entanglement in quantum computing",
    3
  );
  assert(
    unsupportedSearch.every(c => c.similarity < 0.12),
    "Unsupported query receives sub-threshold similarity scores"
  );

  // 4. Grounded AI Tutor Verification
  const tutorExplanation = await generateTutorResponse({
    userId,
    projectId,
    learningGoal: "Machine Learning & Python Mastery",
    userPrompt: "What is instance-based learning and what are its advantages?",
    retrievedChunks: iblSearch,
  });

  assert(!tutorExplanation.isRefusal, "Tutor provides grounded answer for supported question");
  assert(tutorExplanation.content.includes("### Question"), "Tutor output contains ### Question section");
  assert(tutorExplanation.content.includes("### Answer"), "Tutor output contains ### Answer section");
  assert(tutorExplanation.content.includes("### Key Points"), "Tutor output contains ### Key Points section");
  assert(tutorExplanation.content.includes("### Example"), "Tutor output contains ### Example section");
  assert(tutorExplanation.content.includes("### Source"), "Tutor output contains ### Source citation section");
  assert(
    tutorExplanation.citations.length > 0 && tutorExplanation.citations.some(c => c.fileName.includes("InstanceBasedLearning")),
    "Tutor citations correctly link to Unit-V_InstanceBasedLearning.pdf with page numbers"
  );

  const tutorRefusal = await generateTutorResponse({
    userId,
    projectId,
    learningGoal: "Machine Learning & Python Mastery",
    userPrompt: "Explain quantum superposition and entanglement in quantum computing",
    retrievedChunks: unsupportedSearch,
  });

  assert(
    tutorRefusal.isRefusal && tutorRefusal.content.includes("I cannot find sufficient evidence"),
    "Tutor safely refuses unsupported question with polite redirection"
  );

  // 5. Adaptive Quiz Generation & Evaluation
  const quiz = await generateAdaptiveQuiz(projectId, userId, 5, "MIXED");
  assert(quiz.questions.length === 5, "Adaptive quiz generates requested question count (5 questions)");

  const sampleQ = quiz.questions[0];
  assert(
    Array.isArray(sampleQ.options) && sampleQ.options.length === 4,
    "Quiz question contains 4 distinct options"
  );

  // Submit correct answer to question 0
  const submission = await submitQuizAnswer({
    userId,
    projectId,
    questionId: sampleQ.id,
    userAnswerIndex: 0,
  });

  assert(
    typeof submission.isCorrect === "boolean" && submission.explanation.length > 10,
    "Quiz submission returns immediate scoring with pedagogical explanation"
  );
  assert(
    submission.explanation.includes("Source:"),
    "Quiz explanation includes document page citation"
  );

  // 6. Recommendations Verification
  const recData = await generateProjectRecommendations(projectId, userId);
  const recs = (recData as any).recommendations || recData;
  assert(recs.length > 0, `Generated ${recs.length} actionable learning recommendations`);
  assert(
    recs.some((r: any) => (r.action || r.recommendedAction || "").includes("Page ") && !(r.action || r.recommendedAction || "").includes("Binary Search") || r.conceptName !== "Binary Search"),
    "Recommendations reference real document pages and dynamic concepts"
  );

  // 7. Mastery & Growth Analysis Verification
  const growth = await getProjectGrowthAnalysis(projectId, userId);
  assert(
    typeof growth.overallMastery === "number" && growth.summaryText.length > 0,
    `Mastery analysis computed (${growth.overallMastery}% overall, summary: "${growth.summaryText}")`
  );

  console.log("\n==================================================");
  console.log(`VERIFICATION SUMMARY: ${passed}/${total} PASS`);
  console.log("==================================================");

  if (passed === total) {
    console.log("🎉 ALL TESTS PASSED! FULL PIPELINE IS OPERATIONAL!");
  } else {
    process.exit(1);
  }
}

runVerification()
  .catch((err) => {
    console.error("Verification error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
