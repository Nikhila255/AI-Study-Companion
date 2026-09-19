import { PrismaClient } from "@prisma/client";
import { searchProjectChunks } from "../src/lib/embeddings.js";
import { generateTutorResponse } from "../src/lib/ai-service.js";
import { getConceptsForProjectAndMaterial } from "../src/lib/concept-extractor.js";
import { generateAdaptiveQuiz } from "../src/lib/quiz-service.js";
import { getProjectGrowthAnalysis } from "../src/lib/mastery.js";
import { generateProjectRecommendations } from "../src/lib/recommendations.js";
import { generateOpenEndedQuestion } from "../src/lib/assessment-service.js";

const prisma = new PrismaClient();

async function main() {
  console.log("\n========================================================");
  console.log("  AI STUDY COMPANION — AI KNOWLEDGE MANAGEMENT VERIFICATION");
  console.log("========================================================\n");

  const material = await prisma.material.findFirst({
    where: {
      filename: { contains: "AI_Knowledge_Management" }
    },
    include: { project: true }
  });

  if (!material) {
    throw new Error("Active study material not found!");
  }

  const { projectId, id: materialId } = material;
  const project = material.project;
  const userId = project.userId;

  console.log(`Document: ${material.filename}`);
  console.log(`Project ID: ${projectId}, Material ID: ${materialId}, User ID: ${userId}`);

  let passed = 0;
  let failed = 0;

  function assert(cond, name, details = "") {
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
  const chunks = await prisma.chunk.findMany({
    where: { materialId }
  });
  assert(chunks.length > 50, `Document has substantial chunks (${chunks.length} chunks)`);

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
  const allFromMaterial = searchResults.every(c => c.chunk.materialId === materialId);
  assert(allFromMaterial, "All retrieved chunks strictly belong to active material");

  // 4. Tutor RAG generation
  console.log("\nTesting AI Tutor synthesis...");
  const tutorRes = await generateTutorResponse(
    projectId,
    "Explain Retrieval-Augmented Generation (RAG) in AI Knowledge Management and give an example.",
    [],
    materialId
  );
  assert(tutorRes.text.includes("### Definition"), "Tutor output contains '### Definition'");
  assert(tutorRes.text.includes("### Key Points"), "Tutor output contains '### Key Points'");
  assert(tutorRes.text.includes("### Explanation"), "Tutor output contains '### Explanation'");
  assert(tutorRes.text.includes("### Example"), "Tutor output contains '### Example'");
  assert(tutorRes.text.includes("### Source"), "Tutor output contains '### Source'");
  assert(!tutorRes.text.includes("Binary Search"), "Tutor output contains zero Binary Search references");
  assert(tutorRes.citations.length > 0, `Tutor returned ${tutorRes.citations.length} grounded citations`);

  // 5. Adaptive Quiz Generation
  console.log("\nTesting Adaptive Quiz generation...");
  const quiz = await generateAdaptiveQuiz(projectId, userId, 5, "MEDIUM", undefined, materialId);
  assert(quiz.questions.length === 5, `Generated 5 adaptive questions (got ${quiz.questions.length})`);
  const quizConcepts = quiz.questions.map(q => q.conceptName);
  console.log("   Quiz question concepts:", quizConcepts.join(", "));
  assert(
    !quizConcepts.some(c => c.includes("Binary Search") || c.includes("Python")),
    "Quiz questions are 100% scoped to AI Knowledge Management"
  );
  assert(quiz.questions.every(q => q.options.length === 4), "All quiz questions have exactly 4 options");
  assert(quiz.questions.every(q => q.citation && q.citation.length > 0), "All quiz questions have source citations");

  // 6. Open-Ended Assessment
  console.log("\nTesting Open-Ended Assessment generation...");
  const assessmentQ = await generateOpenEndedQuestion(projectId, undefined, materialId);
  assert(assessmentQ && assessmentQ.question.length > 20, "Assessment question generated");
  assert(
    !assessmentQ.question.includes("Binary Search") && !assessmentQ.question.includes("Python"),
    "Assessment question strictly scoped to AI KM"
  );
  assert(assessmentQ.question.includes("Structure your answer"), "Assessment question has structured prompt instructions");

  // 7. Mastery analysis
  console.log("\nTesting Mastery scoping...");
  const mastery = await getProjectGrowthAnalysis(projectId, userId, materialId);
  const masteryConcepts = mastery.conceptAnalysis.map(c => c.conceptName);
  assert(
    !masteryConcepts.some(c => c.includes("Binary Search") || c.includes("Python")),
    "Mastery breakdown strictly filtered to AI KM concepts"
  );

  // 8. Recommendations
  console.log("\nTesting Recommendations...");
  const recs = await generateProjectRecommendations(projectId, userId, materialId);
  assert(recs.recommendations.length > 0, `Generated recommendations (${recs.recommendations.length})`);
  assert(
    !recs.recommendations.some(r => r.conceptName.includes("Binary Search") || r.conceptName.includes("Python")),
    "Recommendations strictly scoped to active document concepts"
  );
  assert(recs.recommendations.every(r => r.why && r.action && r.citation), "Recommendations contain why, action, and citation");

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
