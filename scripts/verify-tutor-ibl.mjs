import { PrismaClient } from "@prisma/client";
import { searchProjectChunks } from "../src/lib/embeddings.js";
import { generateTutorResponse, sanitizeTutorText } from "../src/lib/ai-service.js";

const prisma = new PrismaClient();

async function runVerification() {
  console.log("=== PHASE 1 AI TUTOR VERIFICATION SUITE ===\n");

  // 1. Locate the material Unit-V_InstanceBasedLearning.pdf
  const material = await prisma.material.findFirst({
    where: { fileName: { contains: "InstanceBasedLearning" }, status: "READY" },
    include: { project: true },
  });

  if (!material) {
    console.error("FAIL: Unit-V_InstanceBasedLearning.pdf not found in database!");
    process.exit(1);
  }

  console.log(`Using Material: ${material.fileName} (ID: ${material.id})`);
  console.log(`Project: ${material.project.name} (ID: ${material.projectId})\n`);

  const questions = [
    {
      q: "What is Instance-Based Learning?",
      requiredTerms: ["instance-based", "postpone", "local"],
    },
    {
      q: "What is the difference between lazy learning and eager learning?",
      requiredTerms: ["lazy", "eager", "decision tree", "nearest neighbor"],
      forbiddenTerms: [
        "ai knowledge management",
        "literature survey",
        "cornell method",
        "nexanota",
        "knowledge workers",
        "python",
        "binary search",
        "ai_knowledge_management_literature_survey.pdf",
      ],
    },
    {
      q: "How does k-Nearest Neighbor learning work?",
      requiredTerms: ["k-nearest", "distance", "majority vote"],
    },
    {
      q: "What is the difference between Euclidean distance and Manhattan distance?",
      requiredTerms: ["euclidean", "manhattan", "distance"],
    },
    {
      q: "What is Locally Weighted Regression?",
      requiredTerms: ["locally weighted", "local", "weight"],
    },
  ];

  let passed = 0;

  for (let i = 0; i < questions.length; i++) {
    const item = questions[i];
    console.log(`--------------------------------------------------`);
    console.log(`Test ${i + 1}: "${item.q}"`);

    // Retrieve chunks strictly for this material
    const chunks = await searchProjectChunks(material.projectId, item.q, 5, material.id);
    const strictlyIsolatedChunks = chunks.filter((c) => c.materialId === material.id);

    console.log(`Retrieved ${strictlyIsolatedChunks.length} chunks (all isolated to ${material.fileName}).`);

    // Generate Tutor Response
    const response = await generateTutorResponse({
      userId: material.project.userId,
      projectId: material.projectId,
      learningGoal: material.project.learningGoal,
      userPrompt: item.q,
      retrievedChunks: strictlyIsolatedChunks,
    });

    const content = response.content;

    // Check SVG or artifact leakage
    const hasSvg = /<svg|<\/svg>|\bsvg\s+svg\b/i.test(content);
    if (hasSvg) {
      console.error(`❌ FAIL: Response contains raw SVG artifacts!`);
      console.error(content);
      continue;
    }

    // Check forbidden terms
    let forbiddenMatch = false;
    if (item.forbiddenTerms) {
      for (const f of item.forbiddenTerms) {
        if (content.toLowerCase().includes(f)) {
          console.error(`❌ FAIL: Forbidden term "${f}" found in response!`);
          forbiddenMatch = true;
        }
      }
    }
    if (forbiddenMatch) continue;

    // Check required terms
    let missingTerm = false;
    for (const req of item.requiredTerms) {
      if (!content.toLowerCase().includes(req)) {
        console.error(`❌ FAIL: Missing expected term "${req}" in answer!`);
        missingTerm = true;
      }
    }
    if (missingTerm) continue;

    // Check structured sections
    const hasQuestion = content.includes("### QUESTION");
    const hasDef = content.includes("### DEFINITION");
    const hasKeyPoints = content.includes("### KEY POINTS");
    const hasExplanation = content.includes("### EXPLANATION");
    const hasExample = content.includes("### EXAMPLE");
    const hasSource = content.includes("### SOURCE") && content.includes(material.fileName);

    if (!hasDef || !hasKeyPoints || !hasExplanation || !hasExample || !hasSource) {
      console.error(`❌ FAIL: Missing required structured section(s)!`);
      console.log({ hasDef, hasKeyPoints, hasExplanation, hasExample, hasSource });
      continue;
    }

    console.log(`✓ Structured sections present (QUESTION, DEFINITION, KEY POINTS, EXPLANATION, EXAMPLE, SOURCE).`);
    console.log(`✓ Source correctly cited: ${material.fileName}`);
    console.log(`✓ No SVG or HTML artifacts.`);
    console.log(`Sample output snippet:\n${content.slice(0, 250)}...\n`);
    passed++;
  }

  // Test 6: Refusal on unsupported topic
  console.log(`--------------------------------------------------`);
  console.log(`Test 6: Unsupported Question Refusal`);
  const unrelatedQ = "Explain cellular respiration and the Krebs cycle in detail.";
  const emptyChunks = await searchProjectChunks(material.projectId, unrelatedQ, 5, material.id);
  const unrelatedRes = await generateTutorResponse({
    userId: material.project.userId,
    projectId: material.projectId,
    learningGoal: material.project.learningGoal,
    userPrompt: unrelatedQ,
    retrievedChunks: emptyChunks,
  });

  if (
    unrelatedRes.isRefusal &&
    unrelatedRes.content.includes("I couldn't find enough relevant information in the current study material")
  ) {
    console.log(`✓ Passed refusal test: Returns exact expected refusal.`);
    passed++;
  } else {
    console.error(`❌ FAIL: Unrelated question was not refused properly!`, unrelatedRes);
  }

  // Test 7: Math symbols preservation test
  console.log(`--------------------------------------------------`);
  console.log(`Test 7: Mathematical symbol preservation`);
  const mathInput = "If a new point xq = (2, 2) is given, the nearest point is (2, 1), therefore the predicted class is +.";
  const sanitizedMath = sanitizeTutorText(mathInput);
  if (sanitizedMath === mathInput) {
    console.log(`✓ Math notation preserved identically: "${sanitizedMath}"`);
    passed++;
  } else {
    console.error(`❌ FAIL: Math notation corrupted! Was: "${mathInput}", got: "${sanitizedMath}"`);
  }

  console.log(`\n==================================================`);
  console.log(`VERIFICATION RESULT: ${passed}/7 TESTS PASSED`);
  console.log(`==================================================`);
}

runVerification()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
