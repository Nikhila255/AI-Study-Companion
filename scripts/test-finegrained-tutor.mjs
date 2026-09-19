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

async function runFineGrainedTests() {
  console.log("=== COMPREHENSIVE FINE-GRAINED AI TUTOR VERIFICATION ===\n");

  const material = await prisma.material.findFirst({
    where: { fileName: { contains: "InstanceBasedLearning" }, status: "READY" },
    include: { project: { include: { space: { include: { user: true } }, user: true } } },
  });

  if (!material) {
    console.error("FAIL: Material not found in DB!");
    process.exit(1);
  }

  const project = material.project;
  const user = project.space?.user || project.user;
  const cookie = await createAuthCookie(user);

  const testCases = [
    {
      id: "Q1",
      name: "Document Overview / Topics in document",
      prompt: "What topics are in this document?",
      required: ["instance-based learning", "nearest neighbor", "radial basis functions"],
      forbidden: ["literature survey", "cornell method"],
    },
    {
      id: "Q2",
      name: "Broad Concept: Instance-Based Learning",
      prompt: "Explain Instance-Based Learning.",
      required: ["instance-based", "lazy learning", "local approximation"],
      forbidden: ["literature survey"],
    },
    {
      id: "Q3",
      name: "Topic Deep Dive: Radial Basis Functions",
      prompt: "Explain Radial Basis Functions.",
      required: ["radial basis", "gaussian", "centers"],
      forbidden: ["literature survey"],
    },
    {
      id: "Q4",
      name: "Formula Term-by-Term: RBF Formula",
      prompt: "Explain the RBF formula term by term.",
      required: ["f(x)", "sum", "wi", "exp", "ci", "sigma"],
      forbidden: ["literature survey"],
    },
    {
      id: "Q5",
      name: "Specific Symbol: Meaning of sigma",
      prompt: "What does sigma mean?",
      required: ["sigma", "width", "spread", "gaussian"],
      forbidden: ["literature survey"],
    },
    {
      id: "Q6",
      name: "Specific Symbol: Meaning of ci",
      prompt: "What does ci mean?",
      required: ["ci", "center", "basis function"],
      forbidden: ["literature survey"],
    },
    {
      id: "Q7",
      name: "Numerical Problem / Example: (2,2) Walkthrough",
      prompt: "Explain the (2,2) example.",
      required: ["(2, 2)", "(2,1)", "+", "nearest"],
      forbidden: ["literature survey"],
    },
    {
      id: "Q8",
      name: "Mentioned-Only Concept: Decision Tree",
      prompt: "What is Decision Tree?",
      required: ["decision tree", "eager learning", "example"],
      forbidden: ["organize information assets", "literature survey"],
    },
    {
      id: "Q9",
      name: "Mentioned-Only Concept: Neural Networks",
      prompt: "Explain Neural Networks.",
      required: ["neural networks", "eager learning", "example"],
      forbidden: ["organize information assets", "literature survey"],
    },
  ];

  let passed = 0;

  for (const tc of testCases) {
    console.log(`--------------------------------------------------`);
    console.log(`[TEST ${tc.id}] ${tc.name}`);
    console.log(`Prompt: "${tc.prompt}"`);

    const res = await fetch(`${BASE_URL}/api/projects/${project.id}/tutor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        prompt: tc.prompt,
        materialId: material.id,
      }),
    });

    if (!res.ok) {
      console.error(`❌ HTTP error: ${res.status} ${res.statusText}`);
      continue;
    }

    const data = await res.json();
    const content = data.message.content;

    // Check SVG / Parser artifacts
    const hasSvg = /<svg|<\/svg>|\bsvg\b/i.test(content);
    if (hasSvg) {
      console.error(`❌ FAIL: Contains SVG artifacts!`);
      continue;
    }

    // Check forbidden terms
    let forbiddenFound = false;
    for (const f of tc.forbidden) {
      if (content.toLowerCase().includes(f)) {
        console.error(`❌ FAIL: Forbidden term "${f}" found!`);
        forbiddenFound = true;
      }
    }
    if (forbiddenFound) continue;

    // Check required terms
    let missingRequired = false;
    for (const r of tc.required) {
      if (!content.toLowerCase().includes(r)) {
        console.error(`❌ FAIL: Missing required term "${r}"!`);
        missingRequired = true;
      }
    }
    if (missingRequired) continue;

    // Check sections
    const hasDef = content.includes("### DEFINITION");
    const hasKeyPoints = content.includes("### KEY POINTS");
    const hasExplanation = content.includes("### EXPLANATION");
    const hasExample = content.includes("### EXAMPLE");
    const hasSource = content.includes("### SOURCE") && content.includes(material.fileName);

    if (!hasDef || !hasKeyPoints || !hasExplanation || !hasExample || !hasSource) {
      console.error(`❌ FAIL: Missing required section(s)!`);
      continue;
    }

    console.log(`✓ Status 200 OK`);
    console.log(`✓ Structured sections present (DEFINITION, KEY POINTS, EXPLANATION, EXAMPLE, SOURCE)`);
    console.log(`✓ Zero forbidden terms`);
    console.log(`✓ Zero SVG/parser artifacts`);
    console.log(`✓ Clean source: Unit-V_InstanceBasedLearning.pdf`);
    console.log(`Snippet: ${content.slice(0, 220).replace(/\n+/g, " ")}...`);
    passed++;
  }

  console.log(`\n==================================================`);
  console.log(`RESULT: ${passed}/${testCases.length} TESTS PASSED`);
  console.log(`==================================================\n`);

  if (passed !== testCases.length) {
    process.exit(1);
  }
}

runFineGrainedTests()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
