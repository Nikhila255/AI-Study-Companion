import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { verifyProjectAccess, AuthorizationError } from "@/lib/security";
import { searchProjectChunks } from "@/lib/embeddings";

interface RouteParams {
  params: { projectId: string };
}

// ─── POST /api/projects/[projectId]/search ────────────────────────────────────
// Semantic search over the project's document chunks.
//
// Retrieval isolation guarantee (Phase 2 requirement):
// searchProjectChunks() filters exclusively by projectId in its WHERE clause.
// A query for Project A CANNOT return chunks belonging to Project B.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Verify project ownership
    await verifyProjectAccess(params.projectId, session.userId);

    const body = await req.json();
    const { query, topK } = body;

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return NextResponse.json(
        { error: "Query must be a string of at least 3 characters." },
        { status: 400 }
      );
    }

    const results = await searchProjectChunks(
      params.projectId,
      query.trim(),
      Math.min(Number(topK) || 5, 20) // cap at 20
    );

    return NextResponse.json({
      query,
      projectId: params.projectId,
      results: results.map((r) => ({
        chunkId: r.chunkId,
        materialName: r.materialName,
        pageNumber: r.pageNumber,
        chunkIndex: r.chunkIndex,
        content: r.content,
        similarity: Math.round(r.similarity * 1000) / 1000,
      })),
      totalResults: results.length,
    });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed. Please try again." }, { status: 500 });
  }
}
