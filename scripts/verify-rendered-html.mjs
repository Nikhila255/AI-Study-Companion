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

// Exact mirror of TutorSection.tsx functions
function cleanTutorText(text) {
  if (!text) return "";
  return text
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<\/?[a-z0-9]+:svg[^>]*>/gi, "")
    .replace(/<svg[^>]*>/gi, "")
    .replace(/<\/svg>/gi, "")
    .replace(/\b(?:svg|SVG)\b/gi, "")
    .replace(/@GEN_AI[a-zA-Z0-9_-]*/g, "")
    .replace(/<(?!\/?(?:code|pre)\b)[^>]+>/gi, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFEFF]/g, "")
    .replace(/\[\?\]/g, "")
    .replace(/\\:/g, ":")
    .replace(/\\_/g, "_")
    .replace(/\\~/g, "~")
    .replace(/\*\*\s*\*\*/g, "")
    .replace(/__\s*__/g, "")
    .replace(/^(\s*[-*•]\s*)+(\*\*[•*-]\*\*\s*)?/gm, "• ")
    .replace(/^(\s*\*\*[•*-]\*\*\s*)/gm, "• ")
    .replace(/^[•\-\*]\s*\*\*[•\-\*]\*\*\s*/gm, "• ")
    .replace(/^[\)\]\}]+\s*/gm, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function cleanBulletText(line) {
  let cleaned = line.trim();
  cleaned = cleaned.replace(/^(?:[\s\-\*•>]|(?:\*\*[•\-\*]\*\*)|(?:__•__))+\s*/gi, "");
  cleaned = cleaned.replace(/^[\s\-\*•:]+\s*/i, "");
  cleaned = cleaned.replace(/\*\*\s*\*\*/g, "").trim();
  cleaned = cleaned.replace(/^[•\-\*]\s*/, "").trim();
  return cleaned;
}

function parseInlineMarkdown(text) {
  const cleaned = text
    .replace(/\\:/g, ":")
    .replace(/\\_/g, "_")
    .replace(/\\~/g, "~")
    .replace(/\\-/g, "-")
    .replace(/\\\*/g, "*")
    .replace(/\b(?:svg|SVG)\b/gi, "")
    .replace(/\*\*\s*\*\*/g, "")
    .replace(/__\s*__/g, "")
    .replace(/\*\*([•\-\*])\*\*/g, "$1");

  const tokens = cleaned.split(/(\*\*[^*]+?\*\*|__[^_]+?__|`[^`]+?`|\*[^*]+?\*)/g);
  return tokens.map((tok) => {
    if (!tok) return "";
    if ((tok.startsWith("**") && tok.endsWith("**")) || (tok.startsWith("__") && tok.endsWith("__"))) {
      const inner = tok.slice(2, -2).trim();
      return inner ? `<strong>${inner}</strong>` : "";
    }
    if (tok.startsWith("`") && tok.endsWith("`")) {
      return `<code>${tok.slice(1, -1)}</code>`;
    }
    if (tok.startsWith("*") && tok.endsWith("*") && !tok.startsWith("**")) {
      return `<em>${tok.slice(1, -1)}</em>`;
    }
    return tok.replace(/\*\*/g, "").replace(/__/g, "");
  }).join("");
}

async function verifyTutorQuestions() {
  console.log("=== VERIFYING TUTOR RENDERING & GROUNDING ===\n");

  const material = await prisma.material.findFirst({
    where: { fileName: { contains: "InstanceBasedLearning" }, status: "READY" },
    include: { project: { include: { space: { include: { user: true } }, user: true } } },
  });

  const project = material.project;
  const user = project.space?.user || project.user;
  const cookie = await createAuthCookie(user);

  const questions = [
    "What is the difference between lazy learning and eager learning?",
    "What is decision tree?",
  ];

  for (const question of questions) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Testing: "${question}"`);
    console.log(`--------------------------------------------------`);

    const res = await fetch(`${BASE_URL}/api/projects/${project.id}/tutor`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        prompt: question,
        materialId: material.id,
      }),
    });

    const data = await res.json();
    const rawContent = data.message.content;

    // Check 1: No visible "svg"
    const hasSvg = /\bsvg\b/i.test(cleanTutorText(rawContent));
    console.log(`Check 1 - No 'svg' artifacts: ${!hasSvg ? "PASS" : "FAIL"}`);

    // Check 2: Sections separation
    const rawSections = cleanTutorText(rawContent).split(/(?=###\s+)/g);
    const sectionHeaders = rawSections.map((s) => s.match(/^###\s+([A-Z\s]+)/i)?.[1]?.trim()).filter(Boolean);
    console.log(`Check 2 - Section headers found:`, sectionHeaders);

    // Check 3: Key Points bullets
    const keyPointsSection = rawSections.find((s) => /^###\s+KEY\s*POINTS/i.test(s));
    const rawPoints = keyPointsSection
      ? keyPointsSection.replace(/^###\s+KEY\s*POINTS\s*/i, "").split(/\n+/).filter(Boolean)
      : [];

    let duplicateBulletFound = false;
    rawPoints.forEach((line, idx) => {
      const cleanedPt = cleanBulletText(line);
      const parsedHtml = parseInlineMarkdown(cleanedPt);
      if (cleanedPt.startsWith("•") || cleanedPt.startsWith("-") || cleanedPt.startsWith("*")) {
        duplicateBulletFound = true;
      }
      console.log(`  [Point ${idx + 1}] Cleaned: "${cleanedPt}" -> Rendered HTML: "${parsedHtml}"`);
    });
    console.log(`Check 3 - Duplicate bullets eliminated: ${!duplicateBulletFound ? "PASS" : "FAIL"}`);

    // Check 4: Markdown bold formatting (no raw **)
    const defText = rawSections.find((s) => /^###\s+DEFINITION/i.test(s))?.replace(/^###\s+DEFINITION\s*/i, "").trim() || "";
    const renderedDefinition = parseInlineMarkdown(defText);
    const hasRawAsterisks = /\*\*/.test(renderedDefinition);
    console.log(`Check 4 - Markdown parsed without raw asterisks: ${!hasRawAsterisks ? "PASS" : "FAIL"}`);
    console.log(`  Rendered Definition: "${renderedDefinition}"`);

    // Check 5: Source section
    const sourceSection = rawSections.find((s) => /^###\s+SOURCE/i.test(s));
    const cleanSource = sourceSection
      ? sourceSection.replace(/^###\s+SOURCE\s*/i, "").replace(/^(?:\*\*)?Source(?:\*\*)?[:\s\-·]*/i, "").replace(/^[•\-\*]\s*/, "").trim()
      : "";
    console.log(`Check 5 - Clean Source: "${cleanSource}"`);
    const isSourceClean = cleanSource.includes("Unit-V_InstanceBasedLearning.pdf · Page");
    console.log(`  Source clean & correct format: ${isSourceClean ? "PASS" : "FAIL"}`);

    const qPass = !hasSvg && !duplicateBulletFound && !hasRawAsterisks && isSourceClean;
    console.log(`Verdict for "${question}": ${qPass ? "PASS" : "FAIL"}`);
  }
}

verifyTutorQuestions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
