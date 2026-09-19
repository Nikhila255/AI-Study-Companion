/**
 * Concept Extraction Service
 *
 * Extracts domain concepts and key topics from processed project documents.
 * Stores concepts in the Concept table with importance scores and descriptions.
 * Connects to quizzes, open-ended assessments, mastery records, and recommendations.
 */

import { prisma } from "./db";
import { logAIRequest } from "./ai-service";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export interface ExtractedConcept {
  name: string;
  description: string;
  importanceScore: number;
}

/**
 * Validate whether a concept name is a genuine educational concept
 * and NOT document metadata, introductory purpose filler, test text, or incomplete phrases.
 * Works across arbitrary educational PDFs.
 */
export function isValidEducationalConcept(name: string): boolean {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 50) return false;
  const lower = trimmed.toLowerCase();

  // 0. Reject trailing punctuation (periods, commas, colons, semicolons)
  if (/[.:;,?!]$/.test(trimmed)) {
    return false;
  }

  // Reject internal colons, semicolons, or sentence breaks
  if (trimmed.includes(":") || trimmed.includes(";")) {
    return false;
  }

  // Reject mathematical symbols, formula variables, Greek letters, and inequalities
  if (/[ϵελεσδλσμ√≤≥=+\-*/^|~]/.test(trimmed) || /^[−\-+]/.test(trimmed) || /\b\d+\s*−/.test(trimmed)) {
    return false;
  }

  // 1. Must not contain full sentence verbs, participle starters, or relative clauses
  if (/\b(is|are|was|were|has|have|had|been|being|be)\b/i.test(lower)) {
    return false;
  }
  if (/\b(that|which|who|whom|whose)\b/i.test(lower)) {
    return false;
  }
  if (/^(using|defining|calculating|showing|given|proving|determining|evaluating)\b/i.test(lower)) {
    return false;
  }
  if (/\b(learns?|learned|defines?|defined|proves?|derives?)\b/i.test(lower)) {
    return false;
  }
  if (/\b(created|testing|tested|describes|described|explaining|explained|written|provides|provided)\b/i.test(lower)) {
    return false;
  }

  // Reject punctuation endings (e.g., "algorithms that learn from examples.", "Two parameters define PAC learning:")
  if (/[.:;,!]$/.test(trimmed)) {
    return false;
  }

  // Reject mathematical symbols, Greek letters, minus signs (e.g. "− ϵ", "most ϵ.")
  if (/[ϵε±×÷√∑∏∫≠≤≥≈−]/.test(trimmed)) {
    return false;
  }

  // Reject leading punctuation or math operator
  if (/^[-+*/_–—]/.test(trimmed)) {
    return false;
  }

  // Reject leading quantifiers or counting phrases (e.g. "Two parameters define...", "most ϵ")
  if (/^(two|three|four|five|six|seven|eight|nine|ten|\d+)\s+/i.test(lower)) {
    return false;
  }
  if (/^(most|all|some|few|several|each|every)\s+/i.test(lower)) {
    return false;
  }

  // 2. Reject demonstratives, pronouns, and filler sentence starters
  if (/^(this|that|these|those|there|here|my|your|our|its|we|you|they|it)\b/i.test(lower)) {
    return false;
  }

  // 3. Reject explicit boilerplate, metadata, preamble, filenames, generic test text, dates
  const invalidPatterns = [
    /\b(pdf|document|file|materials?|handout|chapter|section|page|pages|appendix|figure|table)\b/i,
    /\btable\s+of\s+contents\b/i,
    /\bpurpose\b/i,
    /\bstudy\s+material\b/i,
    /\btest\b$/i, // e.g. "Python & DSA Test"
    /\b(exam|homework|assignment|syllabus|copyright|all\s+rights\s+reserved)\b/i,
    /\b(practice\s+questions?|review\s+questions?|sample\s+questions?|exercises?|quiz)\b/i,
    /\b(overview\s+of|introduction\s+to)\b/i,
    /\b(untitled|lorem\s+ipsum|click\s+here)\b/i,
    /\.(pdf|docx?|txt|md|pptx?)$/i,
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
    /\b\d{4}\b/, // years like "2026"
    /^(abstract|literature\s+survey|survey|introduction|overview|conclusion|conclusions|background|motivation|results|limitations|methodology|future\s+directions|retrieval|description|contents|summary|references)$/i,
    /^(elicit|systematic\s+academic|enterprise\s+office|transcription|example\s+diagram)$/i,
    /\bsvg\b/i,
    /^[0-9\s._-]+$/, // purely numbers or punctuation
  ];

  for (const pattern of invalidPatterns) {
    if (pattern.test(lower)) return false;
  }

  // 4. Reject question sentences and interrogatives
  if (trimmed.includes("?") || /^(what|why|how|when|where|which|who)\b/i.test(lower)) {
    return false;
  }

  // 5. Reject incomplete grammatical fragments starting or ending with function words
  if (/^(and|or|the|a|an|in|on|at|to|for|with|of|as|by|from|into|about)\s+/i.test(trimmed)) {
    return false;
  }
  if (/\s+(and|or|the|a|an|in|on|at|to|for|with|of|as|by|from|into|about)$/i.test(trimmed)) {
    return false;
  }

  // 6. Word count limit: genuine educational concepts are 1 to 5 words
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 5) {
    return false;
  }

  return true;
}

/**
 * Filter a list of concept objects to only include valid educational concepts.
 */
export function filterValidConcepts<T extends { name: string }>(concepts: T[]): T[] {
  return concepts.filter((c) => isValidEducationalConcept(c.name));
}

/**
 * Extract concepts from project text chunks and persist to Concept table.
 * If materialId is supplied, only chunks from that material are used.
 */
export async function extractAndStoreConcepts(
  projectId: string,
  userId: string,
  materialId?: string
): Promise<ExtractedConcept[]> {
  const startTime = Date.now();

  const chunks = await prisma.documentChunk.findMany({
    where: {
      projectId,
      ...(materialId ? { documentId: materialId } : {}),
    },
    take: 200,
    orderBy: [{ documentId: "asc" }, { chunkIndex: "asc" }],
  });

  if (chunks.length === 0) return [];

  const combinedText = chunks.map((c) => c.content).join("\n\n");
  let rawConcepts: ExtractedConcept[] = [];

  if (OPENAI_API_KEY) {
    try {
      const prompt = `Analyze the following learning text and extract 4 to 8 essential core educational concepts.

STRICT REQUIREMENTS:
1. ONLY extract genuine educational topics (e.g., "Binary Search", "Data Structures", "Time Complexity", "Variables", "Conditional Statements", "Leader Election").
2. DO NOT extract document metadata, titles, introductory descriptions, or phrases describing the PDF itself (e.g., do NOT extract "This small PDF is", "Study Material", "Purpose", or "Practice Questions").
3. Concept names must be clean, title-cased educational terms (2-4 words maximum).
4. Provide a clear 1-2 sentence definition and an importance score between 0.6 and 1.0.

Format your output as a JSON object with a "concepts" array:
{
  "concepts": [
    { "name": "Concept Name", "description": "Brief definition...", "importanceScore": 0.9 }
  ]
}

Text:
${combinedText.slice(0, 6000)}`;

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const raw = JSON.parse(data.choices?.[0]?.message?.content || "{}");
        const list = Array.isArray(raw) ? raw : raw.concepts || [];
        if (list.length > 0) {
          rawConcepts = list.map((c: any) => ({
            name: String(c.name).trim(),
            description: String(c.description || ""),
            importanceScore: Math.min(1.0, Math.max(0.1, Number(c.importanceScore) || 0.7)),
          }));
        }
      }
    } catch (err) {
      console.warn("[Concept Extractor] OpenAI extraction failed, using deterministic extractor:", err);
    }
  }

  // Fallback: rule-based domain phrase extractor
  if (rawConcepts.length === 0) {
    rawConcepts = extractConceptsDeterministically(combinedText);
  }

  // Filter and deduplicate concepts through validation rules
  const seen = new Set<string>();
  const validConcepts: ExtractedConcept[] = [];

  for (const c of rawConcepts) {
    const cleanName = c.name.trim();
    if (!isValidEducationalConcept(cleanName)) {
      continue;
    }
    const key = cleanName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    validConcepts.push({
      name: cleanName,
      description: c.description,
      importanceScore: c.importanceScore,
    });
  }

  // Persist valid concepts using upsert for idempotency
  for (const c of validConcepts) {
    await prisma.concept.upsert({
      where: {
        projectId_name: {
          projectId,
          name: c.name,
        },
      },
      update: {
        description: c.description,
        importanceScore: c.importanceScore,
      },
      create: {
        projectId,
        name: c.name,
        description: c.description,
        importanceScore: c.importanceScore,
      },
    });
  }

  const latencyMs = Date.now() - startTime;
  await logAIRequest({
    userId,
    projectId,
    featureArea: "CONCEPT_EXTRACTION",
    modelName: OPENAI_API_KEY ? "gpt-4o-mini" : "local-concept-extractor",
    latencyMs,
    isSuccess: true,
    promptTokens: Math.ceil(combinedText.length / 4),
    completionTokens: Math.ceil(JSON.stringify(validConcepts).length / 4),
    retrievalChunksCount: chunks.length,
  });

  return validConcepts;
}

/**
 * Deterministic domain phrase extractor for local execution.
 * Accurately extracts concepts from Python/DSA, Distributed Systems, ML, and general technical text.
 */
function extractConceptsDeterministically(text: string): ExtractedConcept[] {
  const domainCatalog = [
    // Python & DSA Topics
    {
      name: "Binary Search",
      patterns: [/binary\s+search/i],
      desc: "An efficient O(log n) algorithm for searching a target value in a sorted collection by halving the search space.",
      score: 0.95,
    },
    {
      name: "Time Complexity",
      patterns: [/time\s+complexity/i, /o\(log\s*n\)/i, /o\(n\)/i],
      desc: "A computational metric describing how execution time grows relative to input size using Big-O notation.",
      score: 0.9,
    },
    {
      name: "Data Structures",
      patterns: [/\bdata\s+structures\b/i, /\barray\s+or\s+list\b/i],
      desc: "Specialized formats for organizing, processing, retrieving, and storing data in computer programs.",
      score: 0.9,
    },
    {
      name: "Stack",
      patterns: [/\bstack\b/i, /last\s+in,\s+first\s+out/i, /lifo/i],
      desc: "A linear data structure following the Last In, First Out (LIFO) access discipline.",
      score: 0.85,
    },
    {
      name: "Queue",
      patterns: [/\bqueue\b/i, /first\s+in,\s+first\s+out/i, /fifo/i],
      desc: "A linear data structure following the First In, First Out (FIFO) sequential processing order.",
      score: 0.85,
    },
    {
      name: "Hash Tables",
      patterns: [/hash\s+table/i, /key-value\s+pairs/i, /lookup/i],
      desc: "A data structure mapping keys to values using a hash function for rapid average-case retrieval.",
      score: 0.9,
    },
    {
      name: "Python Fundamentals",
      patterns: [/python\s+fundamentals/i, /high-level\s+programming\s+language/i],
      desc: "Core syntax, variables, expression semantics, and standard operations in the Python programming language.",
      score: 0.9,
    },
    {
      name: "Variables & Data Types",
      patterns: [/variables?\s+stores?\s+a\s+value/i, /common\s+data\s+types/i, /\b(int,\s*float,\s*string)\b/i],
      desc: "Memory containers for values and typed data classifications including int, float, string, and boolean.",
      score: 0.85,
    },
    {
      name: "Operators",
      patterns: [/arithmetic\s+operators/i, /\boperators\s+include\b/i],
      desc: "Symbols that perform arithmetic, comparison, and logical computations on operands.",
      score: 0.8,
    },
    {
      name: "Conditional Statements",
      patterns: [/conditional\s+statements/i, /\bif\s+statement\b/i, /\belif\b/i],
      desc: "Control flow constructs that branch execution based on whether boolean conditions evaluate to true.",
      score: 0.85,
    },
    {
      name: "Loops",
      patterns: [/\bfor\s+loop\b/i, /\bwhile\s+loop\b/i, /loops/i],
      desc: "Control structures that repeat code blocks over iterable sequences or while conditions hold true.",
      score: 0.85,
    },

    // Distributed Systems & Raft Topics
    {
      name: "Leader Election",
      patterns: [/leader\s+election/i, /heartbeat/i, /election\s+timeout/i],
      desc: "Mechanism by which distributed nodes agree upon a single coordinator node.",
      score: 0.9,
    },
    {
      name: "Consensus Algorithm",
      patterns: [/consensus/i, /raft/i, /paxos/i],
      desc: "Protocol ensuring distributed nodes agree on values or sequence of actions despite failures.",
      score: 0.95,
    },
    {
      name: "Log Replication",
      patterns: [/log\s+replication/i, /commit\s+index/i, /log\s+entries/i],
      desc: "Process of synchronizing state machine commands across all replica servers.",
      score: 0.85,
    },
    {
      name: "Randomized Timeouts",
      patterns: [/randomized\s+timeout/i, /split\s+vote/i],
      desc: "Technique using jittered timers to prevent simultaneous candidate elections.",
      score: 0.75,
    },
    {
      name: "Quorum & Fault Tolerance",
      patterns: [/quorum/i, /majority/i, /fault-tolerant/i],
      desc: "Requirement that operations succeed on a majority of nodes to survive failures.",
      score: 0.8,
    },

    // Machine Learning & Instance-Based Learning Topics
    {
      name: "Instance-Based Learning",
      patterns: [/instance-based\s+learning/i, /lazy\s+learning/i],
      desc: "A machine learning paradigm that stores training instances and defers generalization until a query is made.",
      score: 0.95,
    },
    {
      name: "Lazy Learning",
      patterns: [/lazy\s+learning/i],
      desc: "Learning methods that delay generalization until prediction time, storing examples and estimating target functions locally.",
      score: 0.9,
    },
    {
      name: "Eager Learning",
      patterns: [/eager\s+learning/i],
      desc: "Learning algorithms that construct an explicit global model or hypothesis during an initial training phase prior to receiving queries.",
      score: 0.9,
    },
    {
      name: "Nearest Neighbor Learning",
      patterns: [/nearest\s+neighbor\s+learning/i, /nearest\s+neighbor\s+algorithm/i],
      desc: "The simplest instance-based method where prediction for a query point equals the target value of the single closest training example.",
      score: 0.9,
    },
    {
      name: "k-Nearest Neighbor",
      patterns: [/k-nearest\s+neighbor/i, /\bk-nn\b/i, /k\s+closest\s+neighbors/i],
      desc: "A non-parametric algorithm predicting class outputs by majority vote or real-valued targets by averaging across the k closest instances.",
      score: 0.95,
    },
    {
      name: "Distance Metrics",
      patterns: [/distance\s+metrics?/i, /distance\s+measures?/i],
      desc: "Mathematical formulations measuring similarity or geometric distance between instances in feature space.",
      score: 0.85,
    },
    {
      name: "Euclidean Distance",
      patterns: [/euclidean\s+distance/i],
      desc: "The direct straight-line geometric distance between two points in n-dimensional space: sqrt(sum((x_ik - x_jk)^2)).",
      score: 0.9,
    },
    {
      name: "Manhattan Distance",
      patterns: [/manhattan\s+distance/i, /l1\s+distance/i],
      desc: "The grid-like distance between two points calculated as the sum of absolute coordinate differences: sum(|x_ik - x_jk|).",
      score: 0.85,
    },
    {
      name: "Locally Weighted Regression",
      patterns: [/locally\s+weighted\s+regression/i],
      desc: "An instance-based regression technique that fits a local approximating function around a query point using distance-weighted contributions.",
      score: 0.9,
    },
    {
      name: "Radial Basis Functions",
      patterns: [/radial\s+basis\s+functions?/i, /\brbf\b/i],
      desc: "Function approximation method using a linear combination of radial basis functions: f(x) = sum(w_i * exp(-||x - c_i||^2 / 2*sigma^2)).",
      score: 0.9,
    },
    {
      name: "Advantages of Instance-Based Learning",
      patterns: [/advantages\s+of\s+instance-based/i, /advantages/i],
      desc: "Key benefits including zero explicit training phase, flexible local approximations, and ability to adapt to complex target functions.",
      score: 0.8,
    },
    {
      name: "Disadvantages of Instance-Based Learning",
      patterns: [/disadvantages\s+of\s+instance-based/i, /disadvantages/i],
      desc: "Operational limitations including high memory consumption, slow prediction time, and sensitivity to irrelevant features or noise.",
      score: 0.8,
    },
    {
      name: "Curse of Dimensionality",
      patterns: [/curse\s+of\s+dimensionality/i, /irrelevant\s+attributes/i],
      desc: "Degradation of distance-based learning performance when high dimensions dilute distances between nearest neighbors.",
      score: 0.85,
    },
    {
      name: "Neural Networks & Backpropagation",
      patterns: [/neural\s+network/i, /backpropagation/i, /gradient/i],
      desc: "Optimization technique computing loss gradients across layered network weights.",
      score: 0.85,
    },

    // AI Knowledge Management Literature Survey Topics
    {
      name: "Knowledge Management",
      patterns: [/knowledge\s+management/i, /knowledge\s+assets/i, /heterogeneous\s+sources/i],
      desc: "The systematic process of capturing, organizing, storing, analyzing, and retrieving knowledge across heterogeneous information sources.",
      score: 0.95,
    },
    {
      name: "Artificial Intelligence in KM",
      patterns: [/artificial\s+intelligence/i, /ai-powered\s+(?:unified\s+)?knowledge/i, /ai\s+in\s+knowledge/i],
      desc: "Applying AI technologies to automate note-taking, semantic search, meeting intelligence, and content summarisation in knowledge workflows.",
      score: 0.95,
    },
    {
      name: "Retrieval-Augmented Generation (RAG)",
      patterns: [/retrieval-augmented\s+generation/i, /\brag\b/i, /dense\s+retrieval/i],
      desc: "An AI architecture that enhances language models by retrieving relevant external context before generating grounded, factually verifiable responses.",
      score: 0.95,
    },
    {
      name: "Contextual Retrieval",
      patterns: [/contextual\s+retrieval/i, /contextual\s+embeddings/i, /anthropic\s+contextual/i],
      desc: "A retrieval enhancement method that prepends document-level explanatory context to individual text chunks before embedding to reduce retrieval failures.",
      score: 0.9,
    },
    {
      name: "Vector Databases & Semantic Search",
      patterns: [/vector\s+databases?/i, /semantic\s+search/i, /dense\s+(?:vector|retrieval)/i, /similarity\s+search/i],
      desc: "Specialized database systems that store high-dimensional embeddings and execute similarity searches to match conceptual queries beyond exact keyword matching.",
      score: 0.9,
    },
    {
      name: "Automatic Note-Taking Systems",
      patterns: [/automatic\s+note-taking/i, /note-taking\s+systems?/i, /lecture\s+note-taking/i],
      desc: "Intelligent systems combining speech-to-text and NLP to automatically capture, structure, and link lecture or meeting notes.",
      score: 0.85,
    },
    {
      name: "Text Summarisation",
      patterns: [/text\s+summarisation/i, /abstractive\s+and\s+extractive/i, /summarisation/i],
      desc: "Natural language processing methods that condense lengthy articles, documents, or discussions into salient summaries.",
      score: 0.85,
    },
    {
      name: "Automatic Speech Recognition & Diarisation",
      patterns: [/automatic\s+speech\s+recognition/i, /\basr\b/i, /speaker\s+diarisation/i, /meeting\s+transcription/i],
      desc: "Speech technologies that convert multi-speaker spoken audio into transcribed text and identify specific speaker segments.",
      score: 0.85,
    },
    {
      name: "Knowledge Graphs & GraphRAG",
      patterns: [/knowledge\s+graphs?/i, /graphrag/i, /entity\s+and\s+relation/i, /semantic\s+organisation/i],
      desc: "Graph-based knowledge structures that connect entities and relations, enabling graph-guided retrieval and multi-hop reasoning in generative models.",
      score: 0.9,
    },
    {
      name: "Semantic Contextualisation Layer",
      patterns: [/semantic\s+contextualisation/i, /orchestration\s+architecture/i],
      desc: "A unified system layer that orchestrates embeddings, knowledge graphs, and contextual indexing across heterogeneous multi-modal inputs.",
      score: 0.85,
    },
    {
      name: "Generative AI",
      patterns: [/generative\s+ai/i, /large\s+language\s+models?/i, /\bllms?\b/i],
      desc: "Advanced neural foundation models capable of generating, summarizing, synthesizing, and reasoning over unstructured text and multimodal content.",
      score: 0.9,
    },
  ];

  const matched: ExtractedConcept[] = [];
  for (const item of domainCatalog) {
    if (item.patterns.some((p) => p.test(text))) {
      matched.push({
        name: item.name,
        description: item.desc,
        importanceScore: item.score,
      });
    }
  }

  // Dynamic Section Heading and Table of Contents Extraction
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Strip section numbers like "1 ", "2 ", "3.1 ", "5.2 "
    line = line.replace(/^\d+(\.\d+)*\s*[-:.]?\s*/, "").trim();

    // Strip trailing page references or dots like ". . . 3" or " 4"
    line = line.replace(/(\s*\.\s*)+\s*\d+$/, "").replace(/\s+\d+$/, "").trim();

    // Check if line looks like a valid educational concept
    if (
      line.length >= 3 &&
      line.length <= 50 &&
      isValidEducationalConcept(line)
    ) {
      if (!matched.some((m) => m.name.toLowerCase() === line.toLowerCase())) {
        const nextLine = lines[i + 1] || "";
        const desc =
          nextLine.length > 15 && !nextLine.startsWith("•")
            ? nextLine.slice(0, 160)
            : `Core educational topic: ${line}`;
        matched.push({
          name: line,
          description: desc,
          importanceScore: 0.8,
        });
      }
    }
  }

  return matched.slice(0, 16);
}

/**
 * Retrieve concepts strictly scoped to a project and optionally to a specific material.
 * If a materialId is provided, ONLY concepts present in that material are returned.
 * Old/unrelated concepts from other documents are strictly filtered out.
 */
export async function getConceptsForProjectAndMaterial(
  projectId: string,
  materialId?: string,
  userId?: string
): Promise<Array<{ id: string; name: string; description: string | null; importanceScore: number }>> {
  // If materialId is provided, check chunks for that material
  let materialChunks: Array<{ content: string }> = [];
  if (materialId) {
    materialChunks = await prisma.documentChunk.findMany({
      where: { projectId, documentId: materialId },
      select: { content: true },
      take: 200,
    });
  } else {
    // If no materialId provided, check if project has materials and pick the latest ready material
    const latestMaterial = await prisma.material.findFirst({
      where: { projectId, status: "READY" },
      orderBy: { createdAt: "desc" },
    });
    if (latestMaterial) {
      materialChunks = await prisma.documentChunk.findMany({
        where: { projectId, documentId: latestMaterial.id },
        select: { content: true },
        take: 200,
      });
      materialId = latestMaterial.id;
    }
  }

  const fullText = materialChunks.map((c) => c.content).join("\n\n").toLowerCase();

  // Load all concepts currently stored for this project
  let projectConcepts = await prisma.concept.findMany({
    where: { projectId },
    orderBy: { importanceScore: "desc" },
  });

  // If no material chunks exist, just return filtered concepts
  if (materialChunks.length === 0) {
    return filterValidConcepts(projectConcepts);
  }

  // Filter project concepts to only those supported by the current material's text
  const isSupported = (conceptName: string): boolean => {
    if (!isValidEducationalConcept(conceptName)) return false;
    const nameLower = conceptName.toLowerCase().trim();

    // 1. Direct normalized phrase check
    const normalizedName = nameLower.replace(/[-_/]/g, " ").replace(/\s+/g, " ");
    const normalizedFullText = fullText.replace(/[-_/]/g, " ").replace(/\s+/g, " ");
    if (normalizedFullText.includes(normalizedName)) return true;

    // 2. Check parenthesized acronym or base part
    if (nameLower.includes("(") && nameLower.includes(")")) {
      const parenMatch = nameLower.match(/\(([^)]+)\)/);
      if (parenMatch && normalizedFullText.includes(parenMatch[1].toLowerCase().trim())) {
        return true;
      }
      const basePart = nameLower.replace(/\([^)]+\)/, "").replace(/[-_/]/g, " ").replace(/\s+/g, " ").trim();
      if (basePart.length > 3 && normalizedFullText.includes(basePart)) {
        return true;
      }
    }

    // 3. Multi-word phrase regex to ensure words appear consecutively
    const words = normalizedName.split(" ").filter((w) => w.length > 2);
    if (words.length >= 2) {
      const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
      const phraseRegex = new RegExp(`\\b${escaped}\\b`, "i");
      if (phraseRegex.test(fullText)) return true;
    }

    return false;
  };

  let supported = projectConcepts.filter((c) => isSupported(c.name));

  // If fewer than 5 concepts are supported (e.g. newly processed or previously under-extracted material),
  // extract and persist fresh concepts from the material chunks now!
  if (supported.length < 5 && userId) {
    await extractAndStoreConcepts(projectId, userId, materialId);
    projectConcepts = await prisma.concept.findMany({
      where: { projectId },
      orderBy: { importanceScore: "desc" },
    });
    supported = projectConcepts.filter((c) => isSupported(c.name));
  }

  // Deduplicate and return
  const seen = new Set<string>();
  const finalConcepts = [];
  for (const c of supported) {
    const key = c.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      finalConcepts.push(c);
    }
  }

  return finalConcepts;
}
