/**
 * Embeddings service.
 *
 * Engineering Decision (Phase 2):
 * - Primary:  OpenAI text-embedding-3-small (1536-dim). Requires OPENAI_API_KEY.
 * - Fallback: TF-IDF keyword scoring for environments without an OpenAI key.
 *             This allows the full Phase 2 pipeline to run locally without any
 *             external API, while producing sub-optimal (but testable) retrieval.
 *
 * Vector storage: embeddings are serialized as JSON float arrays and stored in
 * the DocumentChunk.embedding TEXT column in SQLite. Retrieval loads all project
 * chunks, deserializes embeddings, computes cosine similarity in-process, and
 * returns the top-k results.
 *
 * Trade-off: This is O(n) over chunks per project. Acceptable for prototype
 * scale (thousands of chunks). Phase 5 migration to PostgreSQL + pgvector
 * will make this O(log n) via HNSW index.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMBED_MODEL = "text-embedding-3-small";

/** Generate an embedding vector for a text string. */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (OPENAI_API_KEY) {
    return generateOpenAIEmbedding(text);
  }
  // Fallback: TF-IDF bag-of-words sparse vector (normalized to unit length)
  return generateTFIDFVector(text);
}

async function generateOpenAIEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: text.slice(0, 8000), // token safety limit
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI embedding API error: ${response.status} - ${err}`);
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };
  return data.data[0].embedding;
}

/**
 * TF-IDF fallback. Produces a sparse feature vector of fixed 2048 dimensions
 * using a stable hash function so vectors are comparable across calls.
 */
function generateTFIDFVector(text: string): number[] {
  const DIM = 2048;
  const vec = new Array(DIM).fill(0);
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const stopWords = new Set([
    "the", "and", "for", "are", "but", "not", "you", "all", "any", "can",
    "her", "was", "one", "our", "had", "his", "has", "its", "this", "that",
    "with", "have", "from", "they", "will", "been", "what", "when", "who",
    "into", "more", "than", "then", "also", "each", "some", "these", "which",
  ]);

  const freq: Record<string, number> = {};
  for (const word of words) {
    if (!stopWords.has(word)) {
      freq[word] = (freq[word] || 0) + 1;
    }
  }

  for (const [word, count] of Object.entries(freq)) {
    const idx = stableHash(word) % DIM;
    vec[idx] += count;
  }

  // L2 normalize
  const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < DIM; i++) vec[i] /= norm;
  }

  return vec;
}

function stableHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep 32-bit unsigned
  }
  return hash;
}

/** Cosine similarity between two L2-normalized vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return Math.max(-1, Math.min(1, dot));
}

/** Search result shape returned by the retrieval service. */
export interface RetrievalResult {
  chunkId: string;
  content: string;
  pageNumber: number;
  chunkIndex: number;
  similarity: number;
  materialId: string;
  materialName: string;
  projectId: string;
}

/**
 * Semantic retrieval — scoped strictly to a single projectId.
 *
 * Isolation guarantee: the WHERE clause always filters by projectId,
 * so chunks from other projects are never loaded or scored.
 */
import { prisma } from "./db";
import { classifyChunkContent } from "./pdf-processor";

export async function searchProjectChunks(
  projectId: string,
  query: string,
  topK = 5,
  materialId?: string
): Promise<RetrievalResult[]> {
  // Embed the query
  const queryVec = await generateEmbedding(query);

  // If no materialId provided, check if project has a latest ready material to prevent cross-document leakage
  let targetMaterialId = materialId;
  if (!targetMaterialId) {
    const latestReadyMaterial = await prisma.material.findFirst({
      where: { projectId, status: "READY" },
      orderBy: { createdAt: "desc" },
    });
    if (latestReadyMaterial) {
      targetMaterialId = latestReadyMaterial.id;
    }
  }

  // Load all chunks for this project & selected material
  const chunks = await prisma.documentChunk.findMany({
    where: {
      projectId,
      ...(targetMaterialId ? { documentId: targetMaterialId } : {}),
    },
    include: { document: { select: { fileName: true } } },
  });

  if (chunks.length === 0) return [];

  const lowerQuery = query.toLowerCase();
  // Detect query intent
  const isExplanatoryQuery =
    /\b(explain|what\s+is|what\s+does|how\s+does|how\s+do|why|difference|describe|define|example|overview|compare)\b/i.test(
      lowerQuery
    );
  const isAskingForQuestions =
    /\b(practice\s+questions?|exercises?|quiz\s+questions?|test\s+questions?|problems?|give\s+me\s+questions?)\b/i.test(
      lowerQuery
    );

  // Significant query keywords (ignoring standard stop words)
  const stopWords = new Set([
    "explain", "what", "is", "the", "does", "uploaded", "material", "say", "about",
    "in", "simple", "terms", "and", "give", "an", "example", "how", "why", "of",
    "to", "a", "for", "with", "can", "you", "tell", "me", "difference", "between",
    "please", "describe", "define"
  ]);
  const queryTokens = lowerQuery
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  // Score each chunk with multi-signal ranking
  const scored = chunks
    .map((chunk) => {
      if (!chunk.embedding) return null;
      let chunkVec: number[];
      try {
        chunkVec = JSON.parse(chunk.embedding) as number[];
      } catch {
        return null;
      }
      let sim = cosineSimilarity(queryVec, chunkVec);

      // Extract or classify content type
      let contentType = "EXPLANATION";
      if (chunk.metadata) {
        try {
          const meta = JSON.parse(chunk.metadata);
          if (meta.contentType) contentType = meta.contentType;
        } catch {}
      }
      if (!contentType || contentType === "EXPLANATION") {
        contentType = classifyChunkContent(chunk.content);
      }

      const lowerContent = chunk.content.toLowerCase();

      // Check for explicit page number in user query (e.g., "page 3", "on page 5")
      const pageMatch = lowerQuery.match(/\bpage\s*(\d+)\b/i);
      if (pageMatch) {
        const targetPage = parseInt(pageMatch[1], 10);
        if (chunk.pageNumber === targetPage) {
          sim += 0.60;
        }
      }

      // Check for math symbols and parameters
      const symbolMap: Record<string, string[]> = {
        epsilon: ["epsilon", "ϵ", "ε"],
        sigma: ["sigma", "σ"],
        delta: ["delta", "δ"],
        theta: ["theta", "θ"],
        alpha: ["alpha", "α"],
        beta: ["beta", "β"],
        gamma: ["gamma", "γ"],
        lambda: ["lambda", "λ"],
        mu: ["mu", "μ"],
        omega: ["omega", "ω"],
      };

      for (const [symName, variants] of Object.entries(symbolMap)) {
        if (lowerQuery.includes(symName) || variants.some(v => lowerQuery.includes(v))) {
          if (variants.some(v => lowerContent.includes(v))) {
            sim += 0.25;
          }
        }
      }

      // Multi-signal adjustments
      if (isExplanatoryQuery && !isAskingForQuestions) {
        if (contentType === "TABLE_OF_CONTENTS" && !lowerQuery.includes("table of contents") && !lowerQuery.includes("topics")) {
          // Table of contents chunks should not answer conceptual questions unless asked
          sim *= 0.05;
        } else if (contentType === "REFERENCES") {
          // Literature citations / bibliographies should not answer conceptual questions
          sim *= 0.05;
        } else if (contentType === "METADATA") {
          // Document preamble/test metadata should not answer conceptual questions
          sim *= 0.10;
        } else if (contentType === "PRACTICE_QUESTIONS") {
          // Practice questions should not eclipse actual explanations
          sim *= 0.25;
        } else {
          // Boost actual informational content
          if (contentType === "DEFINITION") sim *= 1.35;
          else if (contentType === "EXPLANATION") sim *= 1.25;
          else if (contentType === "SUMMARY") sim *= 1.15;
          else if (contentType === "EXAMPLE") {
            if (/\bexample\b/i.test(lowerQuery)) sim *= 1.35;
            else sim *= 1.10;
          }

          // Keyword coverage in explanation
          let tokenMatches = 0;
          for (const token of queryTokens) {
            if (lowerContent.includes(token)) tokenMatches++;
          }
          if (queryTokens.length > 0) {
            const matchRatio = tokenMatches / queryTokens.length;
            sim += matchRatio * 0.20;
          }

          // Multi-word phrase matching (2-word and 3-word ngrams from query)
          for (let i = 0; i < queryTokens.length - 1; i++) {
            const biGram = `${queryTokens[i]} ${queryTokens[i + 1]}`;
            if (lowerContent.includes(biGram)) {
              sim += 0.15;
            }
          }
        }
      } else if (isAskingForQuestions) {
        if (contentType === "PRACTICE_QUESTIONS") {
          sim *= 1.40;
        } else if (contentType === "TABLE_OF_CONTENTS") {
          sim *= 0.05;
        }
      }

      sim = Math.max(0, Math.min(1.0, sim));

      return {
        chunkId: chunk.id,
        content: chunk.content,
        pageNumber: chunk.pageNumber,
        chunkIndex: chunk.chunkIndex,
        similarity: sim,
        materialId: chunk.documentId,
        materialName: chunk.document.fileName,
        projectId: chunk.projectId,
      } satisfies RetrievalResult;
    })
    .filter((x): x is RetrievalResult => x !== null);

  // Sort descending by similarity
  scored.sort((a, b) => b.similarity - a.similarity);

  // Deduplicate chunks that have high lexical overlap
  const deduplicated: RetrievalResult[] = [];
  for (const res of scored) {
    const resTokens = new Set(res.content.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
    let isDuplicate = false;
    for (const accepted of deduplicated) {
      if (accepted.materialId === res.materialId && Math.abs(accepted.pageNumber - res.pageNumber) <= 1) {
        let matchCount = 0;
        resTokens.forEach((t) => {
          if (accepted.content.toLowerCase().includes(t)) matchCount++;
        });
        if (resTokens.size > 0 && matchCount / resTokens.size > 0.8) {
          isDuplicate = true;
          break;
        }
      }
    }
    if (!isDuplicate) {
      deduplicated.push(res);
    }
  }

  return deduplicated.slice(0, topK);
}
