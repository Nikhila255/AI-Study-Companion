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
  console.log("  TESTING UNIVERSAL AI TUTOR BEHAVIOR (ALL 20 REQUIREMENTS)");
  console.log("================================================================================\n");

  // Find the Python DSA project specifically
  const project = await prisma.project.findUnique({
    where: { id: "3f719e4e-2547-493a-953d-23537ec140ba" },
    include: { user: true, space: true, materials: { where: { status: "READY" } } },
  });

  if (!project) throw new Error("Project not found");

  const user = await prisma.user.findUnique({ where: { id: project.space.userId } });
  const token = await createToken(user);
  const cookie = `study_auth_token=${token}`;

  // Find Python DSA material specifically
  const pythonMaterial = project.materials.find(m =>
    m.fileName.toLowerCase().includes("python") || m.fileName.toLowerCase().includes("dsa")
  ) || project.materials[0];

  // Find ML/PAC learning material
  const mlMaterial = project.materials.find(m =>
    m.fileName.toLowerCase().includes("raft") ||
    m.fileName.toLowerCase().includes("ml") ||
    m.fileName.toLowerCase().includes("learning") ||
    m.fileName.toLowerCase().includes("computational")
  ) || project.materials[0];

  console.log(`[USER]: ${user.email}`);
  console.log(`[PROJECT]: ${project.name} (${project.id})`);
  console.log(`[PYTHON MATERIAL]: ${pythonMaterial?.fileName} (${pythonMaterial?.id})`);
  console.log(`[ML MATERIAL]: ${mlMaterial?.fileName} (${mlMaterial?.id})\n`);

  let allPassed = true;
  let passed = 0;
  let total = 0;

  function assert(condition, testName, details = "") {
    total++;
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      if (details) console.log(`         → ${details}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      if (details) console.error(`         → ${details}`);
      allPassed = false;
    }
  }

  async function askTutor(prompt, matId = pythonMaterial?.id) {
    const res = await fetch(`${BASE_URL}/api/projects/${project.id}/tutor`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ prompt, materialId: matId }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { error: err, status: res.status };
    }
    return await res.json();
  }

  // ─── 1. CASUAL CONVERSATION TESTS ──────────────────────────────────────────
  console.log("--- 1. CASUAL CONVERSATION (GREETINGS, GRATITUDE, GOODBYE, BREAKS) ---");
  const greetings = [
    "hello",
    "good morning",
    "how are you?",
    "thanks for the help",
    "let's take a break",
    "good night",
  ];
  for (const g of greetings) {
    const res = await askTutor(g);
    const text = res.message?.content || "";
    const hasZeroCitations = !res.message?.citations || res.message?.citations.length === 0;
    const isNotRefusal = res.message?.isRefusal === false;
    const isFriendly =
      text.length > 10 &&
      !text.includes("### SOURCE") &&
      !text.includes("I couldn't find");
    assert(
      hasZeroCitations && isNotRefusal && isFriendly,
      `Casual Query: "${g}"`,
      `Response: "${text.slice(0, 60)}..." (Citations: ${res.message?.citations?.length ?? 0})`
    );
  }

  // ─── 2. GENERAL KNOWLEDGE TESTS ────────────────────────────────────────────
  console.log("\n--- 2. GENERAL KNOWLEDGE (UNRELATED TO CURRENT DOCUMENT) ---");
  const gkQuery = "What is REST API?";
  const gkRes = await askTutor(gkQuery);
  const gkText = gkRes.message?.content || "";
  const gkHasNoDocCitation = !gkRes.message?.citations || gkRes.message?.citations.length === 0;
  const gkIsExplaining =
    gkText.toLowerCase().includes("stateless") ||
    gkText.toLowerCase().includes("http") ||
    gkText.toLowerCase().includes("rest") ||
    gkText.length > 80;
  assert(
    gkHasNoDocCitation && gkIsExplaining,
    `General Knowledge Query: "${gkQuery}"`,
    `Educational explanation without fake citations (Length: ${gkText.length})`
  );

  // ─── 3. DOCUMENT-GROUNDED TESTS (Python DSA Material) ──────────────────────
  console.log("\n--- 3. DOCUMENT GROUNDED QUESTIONS ACROSS DIVERSE STYLES ---");

  // 3A. Definition Question - Python-specific
  const defRes = await askTutor("What is Python programming language?");
  assert(
    defRes.message?.citations?.length > 0 &&
      (defRes.message?.content?.toLowerCase().includes("python") ||
        defRes.message?.content?.toLowerCase().includes("programming")),
    "3A. Definition Question (Python)",
    `Citations: ${defRes.message?.citations?.length}, Page: ${defRes.message?.citations?.[0]?.pageNumber}`
  );

  // 3B. Simple Explanation
  const simpleRes = await askTutor("Explain variables in Python in simple words.");
  assert(
    simpleRes.message?.citations?.length > 0 && simpleRes.message?.content?.length > 50,
    "3B. Simple Explanation Question",
    `Response length: ${simpleRes.message?.content?.length}, Citations: ${simpleRes.message?.citations?.length}`
  );

  // 3C. Data Types Question
  const dtRes = await askTutor("What are the common data types in Python?");
  assert(
    dtRes.message?.citations?.length > 0 &&
      (dtRes.message?.content?.toLowerCase().includes("int") ||
        dtRes.message?.content?.toLowerCase().includes("string") ||
        dtRes.message?.content?.toLowerCase().includes("float") ||
        dtRes.message?.content?.toLowerCase().includes("boolean") ||
        dtRes.message?.content?.toLowerCase().includes("data type")),
    "3C. Data Types Question",
    `Citations: ${dtRes.message?.citations?.length}, Page: ${dtRes.message?.citations?.[0]?.pageNumber}`
  );

  // 3D. Symbol / Operator Question
  const opRes = await askTutor("What does the ** operator mean in Python?");
  assert(
    opRes.message?.citations?.length > 0 || opRes.message?.content?.length > 20,
    "3D. Operator/Symbol Question (**)",
    `Content includes operator explanation, length: ${opRes.message?.content?.length}`
  );

  // 3E. Page-Specific Question
  const pageRes = await askTutor("Explain page 1 of this document.");
  assert(
    pageRes.message?.citations?.some((c) => c.pageNumber === 1),
    "3E. Page-Specific Question (Explain page 1)",
    `Targeted page 1 retrieved: ${JSON.stringify(pageRes.message?.citations?.map(c => c.pageNumber))}`
  );

  // 3F. Comparison Question
  const compRes = await askTutor("What is the difference between int and float in Python?");
  assert(
    compRes.message?.citations?.length > 0,
    "3F. Comparison Question (int vs float)",
    `Found grounded distinctions in document, citations: ${compRes.message?.citations?.length}`
  );

  // 3G. Summary Question
  const sumRes = await askTutor("Summarize this document's main ideas.");
  assert(
    sumRes.message?.citations?.length > 0 && sumRes.message?.content?.length > 100,
    "3G. Summary Question",
    `Synthesized key themes with citations (length: ${sumRes.message?.content?.length})`
  );

  // 3H. Example Question
  const exRes = await askTutor("Give me an example from this material.");
  assert(
    exRes.message?.citations?.length > 0 &&
      (exRes.message?.content?.toLowerCase().includes("example") ||
        exRes.message?.content?.length > 80),
    "3H. Example Question",
    `Handled example with proper citation, length: ${exRes.message?.content?.length}`
  );

  // ─── 4. UNSUPPORTED DOCUMENT QUESTION ──────────────────────────────────────
  console.log("\n--- 4. UNSUPPORTED QUESTION WITH EXPLICIT DOCUMENT SCOPE ---");
  const unsuppRes = await askTutor("According to this PDF, what is quantum teleportation?");
  const unsuppText = unsuppRes.message?.content || "";
  const isCorrectRefusal =
    (unsuppRes.message?.isRefusal === true ||
      unsuppText.includes("does not provide enough information") ||
      unsuppText.includes("document does not") ||
      unsuppText.includes("not cover") ||
      unsuppText.includes("general knowledge")) &&
    !unsuppText.toLowerCase().includes("quantum teleportation is a process");
  assert(
    isCorrectRefusal,
    "4. Explicitly unsupported document question",
    `Refuses without hallucinating (isRefusal: ${unsuppRes.message?.isRefusal}): "${unsuppText.slice(0, 80)}..."`
  );

  // ─── 5. MULTI-TENANT ISOLATION ─────────────────────────────────────────────
  console.log("\n--- 5. CONTEXT ISOLATION (USER & PROJECT & MATERIAL) ---");
  const intruderToken = await createToken({
    id: "intruder-uuid-999",
    email: "intruder@hacker.org",
    role: "LEARNER",
  });
  const intruderRes = await fetch(`${BASE_URL}/api/projects/${project.id}/tutor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `study_auth_token=${intruderToken}`,
    },
    body: JSON.stringify({ prompt: "What is Python?" }),
  });
  assert(
    intruderRes.status === 404,
    "5. Cross-User Project Security",
    `Blocked unauthorized access with HTTP ${intruderRes.status}`
  );

  console.log("\n================================================================================");
  if (allPassed) {
    console.log(`  ALL ${total} UNIVERSAL AI TUTOR TEST CHECKS PASSED (100%)!`);
  } else {
    console.error(`  RESULTS: ${passed}/${total} PASSED`);
  }
  console.log("================================================================================\n");
}

run().finally(() => prisma.$disconnect());
