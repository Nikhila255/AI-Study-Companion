/**
 * PDF Processing Pipeline
 *
 * Responsibilities:
 *  1. Extract text from PDF (with page-level metadata) using pdf-parse v2
 *  2. Split extracted text into chunks suitable for semantic retrieval
 *  3. Generate embeddings for each chunk (or fallback vector)
 *  4. Persist chunks to DocumentChunk table
 *  5. Update Material status throughout: QUEUED → PROCESSING → READY | FAILED
 *
 * Engineering Decisions:
 *  - Chunking: Recursive character splitting at 500 chars with 64-char overlap.
 *  - Boundaries respected: paragraph (\n\n) → sentence (. ) → word ( ).
 *  - Preserves source-page traceability on every chunk.
 *  - Idempotency: Existing chunks for material are deleted before writing new ones.
 */

import { prisma } from "./db";
import { generateEmbedding } from "./embeddings";
import { extractAndStoreConcepts } from "./concept-extractor";
import fs from "fs";
import path from "path";

// Chunking constants
const CHUNK_SIZE = 800; // characters for rich pedagogical paragraphs
const CHUNK_OVERLAP = 100;

export type ChunkContentType =
  | "EXPLANATION"
  | "DEFINITION"
  | "EXAMPLE"
  | "CODE"
  | "SUMMARY"
  | "PRACTICE_QUESTIONS"
  | "TABLE_OF_CONTENTS"
  | "REFERENCES"
  | "METADATA";

/**
 * Clean and normalize raw extracted text from PDF documents.
 * Removes SVG tags, repeated SVG tokens, XML/UI artifacts, control characters,
 * repeated running headers/footers, and page-footer artifacts while preserving genuine educational content.
 */
export function normalizeExtractedText(rawText: string): string {
  if (!rawText || typeof rawText !== "string") return "";

  return rawText
    // Remove raw SVG elements or tags
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<\/?svg[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ") // remove stray XML/HTML tags
    // Remove standalone 'svg' or repeated 'svg' tokens
    .replace(/(?:^|\s)svg(?:\s|$)/gi, " ")
    .replace(/(?:\bsvg\b\s*){2,}/gi, " ")
    // Remove control characters (keep newlines and tabs)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Remove repeated running headers common in surveys and papers
    .replace(/Literature\s+Survey:\s+AI-Powered\s+Unified\s+Knowledge\s+Management\s+Platform/gi, "")
    .replace(/AI-Powered\s+Knowledge\s+Management\s*\|\s*[A-Za-z]+\s+\d{4}/gi, "")
    // Remove standalone trailing page numbers (e.g., "\n  3 \n")
    .replace(/\n\s*\d+\s*$/g, "")
    .replace(/(?:^|\n)\s*Page\s+\d+\s*(?:of\s+\d+)?\s*(?:\n|$)/gi, "\n")
    // Normalize newlines and excessive whitespace
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extract section heading if present at the beginning of a chunk.
 */
export function extractSectionHeading(text: string): string | null {
  const match = text.match(/(?:^|\n)\s*(\d+(?:\.\d+)*\s+[A-Z][A-Za-z0-9\s-]{2,45})/);
  if (match) return match[1].trim();

  const headerMatch = text.match(/(?:^|\n)\s*([A-Z][A-Za-z0-9\s-]{2,35})\s*(?:\n|$)/);
  if (headerMatch && !/^(the|this|an?|and|or|for|with|in|on)\b/i.test(headerMatch[1])) {
    return headerMatch[1].trim();
  }
  return null;
}

/**
 * Classify a chunk's content type to help semantic retrieval distinguish
 * explanatory material from practice questions, table of contents, and metadata.
 */
export function classifyChunkContent(content: string): ChunkContentType {
  if (!content || typeof content !== "string") return "EXPLANATION";
  const trimmed = content.trim();
  const lower = trimmed.toLowerCase();

  // 1. Check for Table of Contents
  // Detect: "Contents" header, dotted leader lines (. . . . . 3), or lines with section number + title + page number
  const hasContentsHeader = /^(?:contents|table\s+of\s+contents)\b/im.test(trimmed);
  const dottedLeaderMatches = trimmed.match(/(?:\.[\s\t]*){3,}\d+/g);
  const tocLineMatches = trimmed.match(/(?:^|\n)\s*\d+(?:\.\d+)*\s+[A-Za-z\s-]{2,40}\s+\d+\s*(?:\n|$)/g);
  if (
    hasContentsHeader ||
    (dottedLeaderMatches && dottedLeaderMatches.length >= 1) ||
    (tocLineMatches && tocLineMatches.length >= 2)
  ) {
    return "TABLE_OF_CONTENTS";
  }

  // 2. Check for Practice Questions / Exercises (avoid matching "open research problems")
  const questionHeaderPattern =
    /(?:^|\n)\s*(?:practice\s+questions?|review\s+questions?|sample\s+questions?|exercises?|self-assessment|quiz\s+questions?|(?:practice\s+)?problems?\s*:\s*\d+)\b/i;
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

  // 3. Check for Metadata / Preamble / Purpose / Boilerplate
  const metadataPatterns = [
    /^purpose\b/im,
    /this\s+(?:small\s+)?(?:pdf|document|file|material)\s+is\s+created\s+specifically/i,
    /for\s+testing\s+the\s+ai\s+study\s+companion/i,
    /\ball\s+rights\s+reserved\b/i,
    /\bcopyright\s+©?\s*\d{4}/i,
    /^based\s+on\s+tom\s+mitchell/im,
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

  // 4. Check for References / Bibliography / Citations
  if (
    /(?:^|\n)\s*(?:\d+(?:\.\d+)*\s+)?(?:references|bibliography|works\s+cited)\b/i.test(trimmed) ||
    (/(?:https?:\/\/[^\s]+|doi\.org\/|arxiv:\d{4}\.\d+|\bieee\s+xplore\b|\bacm\s+digital\s+library\b|\bspringerlink\b|\bsciencedirect\b)/i.test(trimmed) &&
      (trimmed.match(/\(\s*\d{4}\s*\)/g) || []).length >= 2)
  ) {
    return "REFERENCES";
  }

  // 5. Check for Summary / Key Takeaways / Conclusions
  if (/(?:^|\n)\s*(?:\d+(?:\.\d+)*\s+)?(?:summary|key\s+takeaways|in\s+summary|conclusions?|future\s+directions)\b/i.test(trimmed)) {
    return "SUMMARY";
  }

  // 5. Check for Concrete Examples & Case Studies
  if (
    /(?:^|\n)\s*(?:\d+(?:\.\d+)*\s+)?(?:example|case\s+study|primary\s+study)\b/i.test(trimmed) ||
    /(?:for\s+example|such\s+as|benchmarked\s+against|training\s+data:|instance\s+class\b|\(\d+,\s*\d+\)\s+[+-])/i.test(trimmed)
  ) {
    return "EXAMPLE";
  }

  // 6. Check for Definitions / Core Concepts / Architectural Descriptions
  if (
    /(?:is\s+defined\s+as|can\s+be\s+defined\s+as|refers\s+to|is\s+an?\s+(?:approach|paradigm|architecture|framework|technique|method|system)\s+that|core\s+concept\b|key\s+idea\b|defined\s+by)/i.test(
      trimmed
    )
  ) {
    return "DEFINITION";
  }

  // 7. Check for Code Snippets
  if (/(?:def\s+[a-z_]\w*\(|class\s+[A-Z]\w*|import\s+[a-z_]|```)/.test(trimmed)) {
    return "CODE";
  }

  return "EXPLANATION";
}

export interface PageContent {
  pageNumber: number;
  text: string;
}

/**
 * Extract text from a PDF file, grouped by page.
 * Uses pdf-parse v2 API with text normalization and cleanup.
 */
export async function extractTextFromPDF(
  filePath: string
): Promise<{ pages: PageContent[]; totalPages: number }> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`PDF file not found at storage path: ${absolutePath}`);
  }

  const buffer = fs.readFileSync(absolutePath);
  const uint8 = new Uint8Array(buffer);

  // pdf-parse v2 class API
  const { PDFParse } = await import("pdf-parse");

  const parser = new PDFParse({
    data: uint8,
  });

  try {
    const result = await parser.getText();

    let pages: PageContent[] = [];
    if (result.pages && Array.isArray(result.pages) && result.pages.length > 0) {
      pages = result.pages.map((page: any, index: number) => ({
        pageNumber: page.num ?? index + 1,
        text: normalizeExtractedText(page.text || ""),
      }));
    } else if (result.text && result.text.trim()) {
      // Fallback if pages array wasn't populated but concatenated document text exists
      pages = [{ pageNumber: 1, text: normalizeExtractedText(result.text) }];
    }

    const totalPages = result.total || pages.length || 1;

    // Check if any meaningful text was extracted
    const combinedText = pages.map((p) => p.text).join(" ").trim();
    if (combinedText.length === 0) {
      throw new Error(
        "No extractable text found in this PDF. The document may be scanned, encrypted, or image-only."
      );
    }

    return { pages, totalPages };
  } finally {
    await parser.destroy().catch(() => {});
  }
}

/**
 * Recursive character text splitter.
 * Respects paragraph (\n\n) -> newline (\n) -> sentence (. ) -> word ( ) boundaries.
 * CRITICAL FIX: Breaks immediately when splitAt reaches or exceeds the end of text,
 * completely preventing single-character trailing chunk duplications.
 */
export function splitIntoChunks(text: string, size: number, overlap: number): string[] {
  if (!text || text.length <= size) return text ? [text.trim()] : [];

  const separators = ["\n\n", "\n", ". ", "? ", "! ", "; ", " "];
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    let splitAt = end;

    // Try to find a clean boundary working backwards from `end`
    if (end < text.length) {
      for (const sep of separators) {
        const idx = text.lastIndexOf(sep, end);
        if (idx > start + Math.floor(size * 0.4)) {
          splitAt = idx + sep.length;
          break;
        }
      }
    }

    const chunkContent = text.slice(start, splitAt).trim();
    if (chunkContent.length > 0) {
      chunks.push(chunkContent);
    }

    // If we have reached the end of the text, break immediately!
    if (splitAt >= text.length) {
      break;
    }

    // Move forward but retain overlap on whole word boundaries (NEVER chop mid-word)
    let nextStart = Math.max(start + 1, splitAt - overlap);
    if (nextStart < splitAt) {
      const spaceIdx = text.indexOf(" ", nextStart);
      if (spaceIdx !== -1 && spaceIdx < splitAt) {
        nextStart = spaceIdx + 1;
      }
    }
    start = nextStart;
  }

  return chunks;
}

/**
 * Main entry point called by the upload API after creating the Material record.
 * Designed to be called with fire-and-forget (no await at call site).
 */
export async function processMaterial(materialId: string): Promise<void> {
  // Mark as PROCESSING immediately
  await prisma.material.update({
    where: { id: materialId },
    data: { status: "PROCESSING", errorMessage: null },
  });

  try {
    const material = await prisma.material.findUniqueOrThrow({
      where: { id: materialId },
    });

    // --- Step 1: Extract text from PDF ---
    const { pages, totalPages } = await extractTextFromPDF(material.storagePath);

    // --- Step 2: Chunk extracted text, preserving page references ---
    const allChunks: Array<{
      pageNumber: number;
      chunkIndex: number;
      content: string;
      tokenCount: number;
    }> = [];

    let globalChunkIndex = 0;
    for (const page of pages) {
      if (!page.text || !page.text.trim()) continue;
      const pageChunks = splitIntoChunks(page.text, CHUNK_SIZE, CHUNK_OVERLAP);
      for (const chunkText of pageChunks) {
        const cleaned = chunkText.trim();
        if (cleaned.length < 15) continue; // skip near-empty chunks
        allChunks.push({
          pageNumber: page.pageNumber,
          chunkIndex: globalChunkIndex++,
          content: cleaned,
          tokenCount: Math.ceil(cleaned.length / 4), // rough 4-char/token estimate
        });
      }
    }

    if (allChunks.length === 0) {
      throw new Error("No meaningful text chunks could be extracted from this PDF.");
    }

    // --- Step 3: Generate embeddings and store chunks ---
    // Delete any existing chunks for this material (idempotency for retries)
    await prisma.documentChunk.deleteMany({
      where: { documentId: materialId },
    });

    for (const chunk of allChunks) {
      let embedding: number[] | null = null;
      try {
        embedding = await generateEmbedding(chunk.content);
      } catch (embErr) {
        // Non-fatal: store chunk without embedding; retrieval fallback will handle
        console.warn(`Embedding failed for chunk ${chunk.chunkIndex}:`, embErr);
      }

      const contentType = classifyChunkContent(chunk.content);

      await prisma.documentChunk.create({
        data: {
          documentId: materialId,
          projectId: material.projectId,
          pageNumber: chunk.pageNumber,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          embedding: embedding ? JSON.stringify(embedding) : null,
          metadata: JSON.stringify({
            source: material.fileName,
            pageNumber: chunk.pageNumber,
            contentType,
          }),
        },
      });
    }

    // --- Step 4: Mark READY ---
    await prisma.material.update({
      where: { id: materialId },
      data: {
        status: "READY",
        totalPages,
        errorMessage: null,
        updatedAt: new Date(),
      },
    });

    // Emit learning event
    await prisma.learningEvent.create({
      data: {
        userId: material.userId,
        projectId: material.projectId,
        eventType: "MATERIAL_PROCESSED",
        payload: JSON.stringify({
          materialId,
          fileName: material.fileName,
          totalPages,
          chunkCount: allChunks.length,
        }),
      },
    });

    console.log(
      `[PDF Processor] ✓ materialId=${materialId} pages=${totalPages} chunks=${allChunks.length}`
    );

    // Extract key concepts from material in background
    extractAndStoreConcepts(material.projectId, material.userId).catch((cErr) => {
      console.warn("[PDF Processor] Concept extraction error:", cErr.message);
    });
  } catch (err: any) {
    console.error(`[PDF Processor] ✗ materialId=${materialId}:`, err.message);
    await prisma.material
      .update({
        where: { id: materialId },
        data: {
          status: "FAILED",
          errorMessage: err.message || "Unknown processing error",
          updatedAt: new Date(),
        },
      })
      .catch((updateErr) => {
        console.error("[PDF Processor] Failed to update error status:", updateErr);
      });
  }
}
