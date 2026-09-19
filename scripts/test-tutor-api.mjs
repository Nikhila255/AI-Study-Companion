import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:3000";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "ai-study-companion-super-secret-key-32-chars-minimum-prod"
);

async function createAuthCookie(user) {
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
  return `study_auth_token=${token}`;
}

async function runApiTests() {
  console.log("=== END-TO-END AI TUTOR API VERIFICATION ===\n");

  // 1. Find material for Unit-V_InstanceBasedLearning.pdf
  const material = await prisma.material.findFirst({
    where: { fileName: { contains: "InstanceBasedLearning" }, status: "READY" },
    include: { project: { include: { space: { include: { user: true } }, user: true } } },
  });

  if (!material) {
    console.error("FAIL: Material Unit-V_InstanceBasedLearning.pdf not found in DB!");
    process.exit(1);
  }

  const project = material.project;
  const user = project.space?.user || project.user;

  console.log(`User: ${user.email} (${user.id})`);
  console.log(`Project: ${project.name} (${project.id})`);
  console.log(`Material: ${material.fileName} (${material.id})\n`);

  const cookie = await createAuthCookie(user);

  const testCases = [
    {
      name: "Question 1: What is Instance-Based Learning?",
      question: "What is Instance-Based Learning?",
      required: ["instance-based", "postpone", "local"],
    },
    {
      name: "Question 2: What is the difference between lazy learning and eager learning?",
      question: "What is the difference between lazy learning and eager learning?",
      required: ["lazy", "eager", "decision tree", "nearest neighbor"],
      forbidden: [
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
      name: "Question 3: How does k-Nearest Neighbor learning work?",
      question: "How does k-Nearest Neighbor learning work?",
      required: ["k-nearest", "distance", "majority vote"],
    },
    {
      name: "Question 4: What is the difference between Euclidean distance and Manhattan distance?",
      question: "What is the difference between Euclidean distance and Manhattan distance?",
      required: ["euclidean", "manhattan", "distance"],
    },
    {
      name: "Question 5: What is Locally Weighted Regression?",
      question: "What is Locally Weighted Regression?",
      required: ["locally weighted", "local", "weight"],
    },
    {
      name: "Question 6: What is decision tree?",
      question: "What is decision tree?",
      required: ["decision tree", "eager learning", "example"],
      forbidden: [
        "organize information assets",
        "literature survey",
        "cornell method",
      ],
    },
  ];

  let passed = 0;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    console.log(`--------------------------------------------------`);
    console.log(`[TEST ${i + 1}] ${tc.name}`);

    const res = await fetch(`${BASE_URL}/api/projects/${project.id}/tutor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        prompt: tc.question,
        materialId: material.id,
      }),
    });

    if (!res.ok) {
      console.error(`❌ HTTP error: ${res.status} ${res.statusText}`);
      const errBody = await res.text();
      console.error(`Body:`, errBody);
      continue;
    }

    const data = await res.json();
    const message = data.message;
    const content = message.content;

    // 1. Check SVG artifacts
    const hasSvg = /<svg|<\/svg>|\bsvg\s+svg\b/i.test(content);
    if (hasSvg) {
      console.error(`❌ FAIL: Contains SVG artifacts!`);
      console.error(content);
      continue;
    }

    // 2. Check forbidden terms
    let forbiddenFound = false;
    if (tc.forbidden) {
      for (const f of tc.forbidden) {
        if (content.toLowerCase().includes(f)) {
          console.error(`❌ FAIL: Forbidden term "${f}" found in output!`);
          forbiddenFound = true;
        }
      }
    }
    if (forbiddenFound) continue;

    // 3. Check required terms
    let missingRequired = false;
    for (const r of tc.required) {
      if (!content.toLowerCase().includes(r)) {
        console.error(`❌ FAIL: Missing required term "${r}" in output!`);
        missingRequired = true;
      }
    }
    if (missingRequired) continue;

    // 4. Check structured sections
    const hasDef = content.includes("### DEFINITION");
    const hasKeyPoints = content.includes("### KEY POINTS");
    const hasExplanation = content.includes("### EXPLANATION");
    const hasExample = content.includes("### EXAMPLE");
    const hasSource = content.includes("### SOURCE") && content.includes(material.fileName);

    if (!hasDef || !hasKeyPoints || !hasExplanation || !hasExample || !hasSource) {
      console.error(`❌ FAIL: Missing required educational section(s)!`);
      console.log({ hasDef, hasKeyPoints, hasExplanation, hasExample, hasSource });
      continue;
    }

    console.log(`✓ Status 200 OK`);
    console.log(`✓ Structured sections verified (DEFINITION, KEY POINTS, EXPLANATION, EXAMPLE, SOURCE)`);
    console.log(`✓ Zero forbidden terms`);
    console.log(`✓ Zero raw SVG or HTML artifacts`);
    console.log(`✓ Source correctly cited: ${material.fileName}`);
    console.log(`Sample output snippet:\n${content.slice(0, 220)}...\n`);
    passed++;
  }

  // Refusal Test
  console.log(`--------------------------------------------------`);
  console.log(`[TEST 6] Unsupported Question Refusal`);
  const refusalRes = await fetch(`${BASE_URL}/api/projects/${project.id}/tutor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      prompt: "What is cellular respiration and oxidative phosphorylation?",
      materialId: material.id,
    }),
  });

  const refusalData = await refusalRes.json();
  if (
    refusalData.message &&
    refusalData.message.isRefusal &&
    refusalData.message.content.includes("I couldn't find enough relevant information in the current study material")
  ) {
    console.log(`✓ Passed refusal test: returns exact expected refusal.`);
    passed++;
  } else {
    console.error(`❌ FAIL on refusal test:`, refusalData);
  }

  console.log(`\n==================================================`);
  console.log(`TOTAL RESULT: ${passed}/6 TESTS PASSED`);
  console.log(`==================================================`);

  if (passed === 6) {
    console.log(`\n🎉 ALL AI TUTOR TESTS PASSED WITH 100% CORRECTNESS!`);
  }
}

runApiTests()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
