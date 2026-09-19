import { prisma } from "../src/lib/db";
import { searchProjectChunks } from "../src/lib/embeddings";
import { generateTutorResponse } from "../src/lib/ai-service";
import { getConceptsForProjectAndMaterial } from "../src/lib/concept-extractor";
import { generateAdaptiveQuiz, submitQuizAnswer } from "../src/lib/quiz-service";
import { getProjectGrowthAnalysis } from "../src/lib/mastery";
import { generateProjectRecommendations } from "../src/lib/recommendations";
import { generateOpenEndedQuestion } from "../src/lib/assessment-service";

async function main() {
  console.log("\n========================================================");
  console.log("  AI STUDY COMPANION — AI KNOWLEDGE MANAGEMENT VERIFICATION");
  console.log("========================================================\n");

  const material = await prisma.material.findFirst({
    where: {
      fileName: { contains: "AI_Knowledge_Management" }
    },
    include: { project: true }
  });

  if (!material) {
    throw new Error("Active study material not found!");
  }

  const { projectId, id: materialId } = material;
  const project = material.project;
  const userId = project.userId;

  console.log(`Document: ${material.fileName}`);
  console.log(`Project ID: ${projectId}, Material ID: ${materialId}, User ID: ${userId}`);

  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, name: string, details = "") {
    if (cond) {
      console.log(`✓ [PASS] ${name}`);
      if (details) console.log(`         ${details}`);
      passed++;
    } else {
      console.log(`✗ [FAIL] ${name}`);
      if (details) console.log(`         FAILED: ${details}`);
      failed++;
    }
  }

  // 1. Chunks & isolation
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId: materialId }
  });
  assert(chunks.length > 50, `Document has substantial chunks (${chunks.length} chunks across 31 pages)`);

  // 2. Extracted concepts for material
  const concepts = await getConceptsForProjectAndMaterial(projectId, materialId, userId);
  assert(concepts.length >= 5, `Material concepts extracted (${concepts.length} concepts found)`);
  const conceptNames = concepts.map(c => c.name);
  console.log("   Concepts:", conceptNames.join(", "));
  assert(
    !conceptNames.some(n => n.includes("Binary Search") || n.includes("Python") || n.includes("Raft")),
    "No legacy concept leakage (Binary Search / Python / Raft)"
  );

  // 3. Retrieval Scoping
  const searchResults = await searchProjectChunks(projectId, "What is Retrieval-Augmented Generation (RAG)?", 3, materialId);
  assert(searchResults.length > 0, `Search returns chunks for RAG (${searchResults.length} chunks)`);
  const allFromMaterial = searchResults.every(c => c.materialId === materialId);
  assert(allFromMaterial, "All retrieved chunks strictly belong to active material");

  // 4. Tutor RAG generation
  console.log("\nTesting AI Tutor synthesis...");
  const tutorChunks = await searchProjectChunks(projectId, "Explain Retrieval-Augmented Generation (RAG) in AI Knowledge Management and give an example.", 4, materialId);
  const tutorRes = await generateTutorResponse({
    userId,
    projectId,
    learningGoal: project.learningGoal,
    userPrompt: "Explain Retrieval-Augmented Generation (RAG) in AI Knowledge Management and give an example.",
    retrievedChunks: tutorChunks,
  });
  assert(tutorRes.content.includes("### Definition"), "Tutor output contains '### Definition'");
  assert(tutorRes.content.includes("### Key Points"), "Tutor output contains '### Key Points'");
  assert(tutorRes.content.includes("### Explanation"), "Tutor output contains '### Explanation'");
  assert(tutorRes.content.includes("### Example"), "Tutor output contains '### Example'");
  assert(tutorRes.content.includes("### Source"), "Tutor output contains '### Source'");
  assert(!tutorRes.content.includes("Binary Search"), "Tutor output contains zero Binary Search references");
  assert(tutorRes.citations.length > 0, `Tutor returned ${tutorRes.citations.length} grounded citations`);

  // 5. Adaptive Quiz Generation
  console.log("\nTesting Adaptive Quiz generation...");
  const quiz = await generateAdaptiveQuiz(projectId, userId, 5, "MEDIUM", materialId);
  assert(quiz.questions.length === 5, `Generated 5 adaptive questions (got ${quiz.questions.length})`);
  const quizConcepts = quiz.questions.map(q => q.conceptName);
  console.log("   Quiz question concepts:", quizConcepts.join(", "));
  assert(
    !quizConcepts.some(c => c.includes("Binary Search") || c.includes("Python")),
    "Quiz questions are 100% scoped to AI Knowledge Management"
  );
  assert(quiz.questions.every(q => q.options.length === 4), "All quiz questions have exactly 4 options");
  
  // Verify submission & feedback citation
  const firstQ = quiz.questions[0];
  const submission = await submitQuizAnswer({
    questionId: firstQ.id,
    userId,
    projectId,
    userAnswerIndex: 0,
  });
  assert(submission.explanation && submission.explanation.includes("Source:"), "Quiz submission returns explanation with source citation");

  // 6. Open-Ended Assessment
  console.log("\nTesting Open-Ended Assessment generation...");
  const assessmentQ = await generateOpenEndedQuestion(projectId, userId, undefined, materialId);
  assert(assessmentQ && assessmentQ.question && assessmentQ.question.questionText.length > 20, "Assessment question generated");
  const promptText = assessmentQ.question.questionText;
  assert(
    !promptText.includes("Binary Search") && !promptText.includes("Python"),
    "Assessment question strictly scoped to AI KM"
  );
  assert(promptText.includes("Structure your answer") || promptText.includes("main concept"), "Assessment question has structured prompt instructions");

  // 7. Mastery analysis
  console.log("\nTesting Mastery scoping...");
  const mastery = await getProjectGrowthAnalysis(projectId, userId, materialId);
  const allMasteryConcepts = [...mastery.practiced, ...mastery.notPracticedYet].map(c => c.conceptName);
  assert(allMasteryConcepts.length > 0, `Mastery concepts computed (${allMasteryConcepts.length} total)`);
  assert(
    !allMasteryConcepts.some(c => c.includes("Binary Search") || c.includes("Python")),
    "Mastery breakdown strictly filtered to AI KM concepts"
  );
  assert(typeof mastery.overallMastery === "number", `Overall mastery is a valid number: ${mastery.overallMastery}%`);

  // 8. Recommendations
  console.log("\nTesting Recommendations...");
  const recData = await generateProjectRecommendations(projectId, userId, materialId);
  const recs = (recData as any).recommendations || recData;
  assert(recs.length > 0, `Generated recommendations (${recs.length})`);
  assert(
    !recs.some((r: any) => r.conceptName.includes("Binary Search") || r.conceptName.includes("Python")),
    "Recommendations strictly scoped to active document concepts"
  );
  assert(recs.every((r: any) => r.why && r.action && r.citation), "Recommendations contain why, action, and citation");

  console.log("\n========================================================");
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("========================================================\n");

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error("Verification failed with exception:", e);
  await prisma.$disconnect();
  process.exit(1);
});
