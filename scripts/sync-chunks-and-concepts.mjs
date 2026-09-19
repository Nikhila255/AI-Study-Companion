import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function classifyChunkContent(content) {
  if (!content || typeof content !== "string") return "EXPLANATION";
  const trimmed = content.trim();

  // 1. Check for Practice Questions / Exercises
  const questionHeaderPattern =
    /\b(practice\s+questions?|review\s+questions?|sample\s+questions?|exercises?|self-assessment|quiz\s+questions?|problems?)\b/i;
  const numberedQuestionMatches = trimmed.match(
    /(?:^|\n)\s*(?:\d+[\.\)]|\([a-z0-9]+\))\s+[^\n]*\?/gi
  );
  const questionMarkCount = (trimmed.match(/\?/g) || []).length;
  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);

  if (
    questionHeaderPattern.test(trimmed) ||
    (numberedQuestionMatches && numberedQuestionMatches.length >= 2) ||
    (questionMarkCount >= 3 && lines.length > 0 && questionMarkCount / lines.length >= 0.35)
  ) {
    return "PRACTICE_QUESTIONS";
  }

  // 2. Check for Metadata / Preamble / Purpose / Boilerplate
  const metadataPatterns = [
    /^purpose\b/im,
    /this\s+(?:small\s+)?(?:pdf|document|file|material)\s+is\s+created\s+specifically/i,
    /for\s+testing\s+the\s+ai\s+study\s+companion/i,
    /^table\s+of\s+contents\b/im,
    /\ball\s+rights\s+reserved\b/i,
    /\bcopyright\s+©?\s*\d{4}/i,
  ];

  if (metadataPatterns.some((pattern) => pattern.test(trimmed))) {
    const stripped = trimmed
      .replace(/purpose/gi, "")
      .replace(/this\s+(?:small\s+)?(?:pdf|document|file|material)[^.\n]*/gi, "")
      .trim();
    if (stripped.length < 120) {
      return "METADATA";
    }
  }

  return "EXPLANATION";
}

async function main() {
  console.log("=== Backfilling Chunk Content Types ===");
  const chunks = await prisma.documentChunk.findMany({
    include: { document: { select: { fileName: true } } },
  });

  for (const c of chunks) {
    const contentType = classifyChunkContent(c.content);
    let meta = {};
    if (c.metadata) {
      try {
        meta = JSON.parse(c.metadata);
      } catch {}
    }
    meta.contentType = contentType;
    meta.source = c.document?.fileName || meta.source || "uploaded document";
    meta.pageNumber = c.pageNumber;

    await prisma.documentChunk.update({
      where: { id: c.id },
      data: { metadata: JSON.stringify(meta) },
    });
    console.log(`Chunk ${c.id} (Page ${c.pageNumber}): classified as ${contentType}`);
  }

  console.log("\n=== Checking Python Fundamentals Project Concepts ===");
  const pythonProj = await prisma.project.findFirst({
    where: { name: "Python Fundamentals" },
    include: { concepts: true },
  });

  if (pythonProj) {
    console.log(`Project found: ${pythonProj.name} (${pythonProj.id})`);
    const standardConcepts = [
      {
        name: "Binary Search",
        description: "An efficient O(log n) search algorithm on sorted collections that repeatedly halves the search space.",
        importanceScore: 0.95,
      },
      {
        name: "Stack",
        description: "A linear data structure operating under the Last In, First Out (LIFO) discipline.",
        importanceScore: 0.85,
      },
      {
        name: "Queue",
        description: "A sequential data structure operating under the First In, First Out (FIFO) discipline.",
        importanceScore: 0.85,
      },
      {
        name: "Data Structures",
        description: "Specialized formats for organizing, processing, retrieving, and storing data efficiently.",
        importanceScore: 0.9,
      },
      {
        name: "Hash Tables",
        description: "A key-value mapping structure using hash functions for rapid average-case lookup.",
        importanceScore: 0.9,
      },
      {
        name: "Loops",
        description: "Control flow structures (for, while) that repeat execution over sequences or while conditions hold.",
        importanceScore: 0.85,
      },
      {
        name: "Conditional Statements",
        description: "Control flow constructs (if, elif, else) branching execution based on boolean condition evaluations.",
        importanceScore: 0.85,
      },
      {
        name: "Time Complexity",
        description: "A computational metric using Big-O notation to describe execution time scaling relative to input size.",
        importanceScore: 0.9,
      },
      {
        name: "Variables & Data Types",
        description: "Named memory containers storing values classified by typed formats including int, float, string, and bool.",
        importanceScore: 0.85,
      },
      {
        name: "Python Fundamentals",
        description: "High-level programming concepts, readable syntax, and arithmetic operations in Python.",
        importanceScore: 0.9,
      },
    ];

    for (const sc of standardConcepts) {
      await prisma.concept.upsert({
        where: {
          projectId_name: {
            projectId: pythonProj.id,
            name: sc.name,
          },
        },
        update: {
          description: sc.description,
          importanceScore: sc.importanceScore,
        },
        create: {
          projectId: pythonProj.id,
          name: sc.name,
          description: sc.description,
          importanceScore: sc.importanceScore,
        },
      });
      console.log(`Upserted concept: ${sc.name}`);
    }
  }

  console.log("\n=== Complete! ===");
}

main().catch(console.error).finally(() => prisma.$disconnect());
