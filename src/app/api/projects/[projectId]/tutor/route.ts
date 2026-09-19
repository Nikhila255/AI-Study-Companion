import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { verifyProjectAccess, AuthorizationError } from "@/lib/security";
import { prisma } from "@/lib/db";
import { searchProjectChunks } from "@/lib/embeddings";
import { generateTutorResponse, classifyTutorIntent } from "@/lib/ai-service";

interface RouteParams {
  params: { projectId: string };
}

// ─── GET /api/projects/[projectId]/tutor ─────────────────────────────────────
// Retrieve existing conversation and messages for this project.
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await verifyProjectAccess(params.projectId, session.userId);

    const conversation = await prisma.conversation.findFirst({
      where: {
        projectId: params.projectId,
        userId: session.userId,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ conversation: null, messages: [] });
    }

    const parsedMessages = conversation.messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      content: m.content,
      citations: m.citations ? JSON.parse(m.citations) : [],
      isRefusal: m.isRefusal,
      createdAt: m.createdAt,
    }));

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
      },
      messages: parsedMessages,
    });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/projects/[projectId]/tutor ────────────────────────────────────
// Ask AI Tutor a question. Grounded in project materials with citations and refusal.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const project = await verifyProjectAccess(params.projectId, session.userId);

    const body = await req.json();
    const prompt = body.prompt?.trim();
    const materialId = body.materialId ? String(body.materialId) : undefined;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required. Please ask a study question." },
        { status: 400 }
      );
    }

    // 0. EARLY INTENT PRE-CLASSIFICATION — short-circuit casual queries without chunk retrieval
    const earlyIntent = classifyTutorIntent(prompt, true, false);
    if (earlyIntent === "CASUAL_CONVERSATION") {
      // Get or create conversation for storage
      let convForCasual = await prisma.conversation.findFirst({
        where: { projectId: params.projectId, userId: session.userId },
        include: { messages: { take: 0 } },
      });
      if (!convForCasual) {
        convForCasual = await prisma.conversation.create({
          data: { projectId: params.projectId, userId: session.userId, title: prompt.slice(0, 40) + "..." },
          include: { messages: true },
        });
      }
      const casualRes = await generateTutorResponse({
        userId: session.userId,
        projectId: params.projectId,
        learningGoal: project.learningGoal,
        userPrompt: prompt,
        retrievedChunks: [],
        recentMessages: [],
      });
      await prisma.message.create({ data: { conversationId: convForCasual.id, sender: "USER", content: prompt } });
      const casualMsg = await prisma.message.create({
        data: { conversationId: convForCasual.id, sender: "ASSISTANT", content: casualRes.content, isRefusal: false },
      });
      return NextResponse.json({
        conversationId: convForCasual.id,
        message: { id: casualMsg.id, sender: "ASSISTANT", content: casualRes.content, citations: [], isRefusal: false, createdAt: casualMsg.createdAt },
        model: casualRes.model,
        latencyMs: casualRes.latencyMs,
      });
    }

    // 1. Identify and validate current active material strictly within project
    let activeMaterial = null;
    if (materialId) {
      activeMaterial = await prisma.material.findFirst({
        where: { id: materialId, projectId: params.projectId },
      });
      if (!activeMaterial) {
        return NextResponse.json(
          { error: "Selected study material does not belong to this project." },
          { status: 400 }
        );
      }
    } else {
      activeMaterial = await prisma.material.findFirst({
        where: { projectId: params.projectId, status: "READY" },
        orderBy: { createdAt: "desc" },
      });
    }

    // 2. Get or create project conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        projectId: params.projectId,
        userId: session.userId,
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 6,
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          projectId: params.projectId,
          userId: session.userId,
          title: prompt.slice(0, 40) + "...",
        },
        include: {
          messages: true,
        },
      });
    }

    let expandedChunks: any[] = [];
    if (activeMaterial) {
      // 3. Perform strictly isolated project & material-scoped retrieval
      const retrievedChunks = await searchProjectChunks(
        params.projectId,
        prompt,
        6,
        activeMaterial.id
      );

      // Discard any chunk that does not strictly belong to the active material
      const isolatedChunks = retrievedChunks.filter(
        (c) => c.projectId === params.projectId && c.materialId === activeMaterial.id
      );

      // 4. Context Expansion: Retrieve adjacent chunks (chunkIndex ± 1) from active material
      const chunkIndices = new Set<number>();
      for (const c of isolatedChunks) {
        chunkIndices.add(c.chunkIndex);
        if (c.chunkIndex > 0) chunkIndices.add(c.chunkIndex - 1);
        chunkIndices.add(c.chunkIndex + 1);
      }

      const expandedDbChunks = await prisma.documentChunk.findMany({
        where: {
          documentId: activeMaterial.id,
          projectId: params.projectId,
          chunkIndex: { in: Array.from(chunkIndices) },
        },
        orderBy: { chunkIndex: "asc" },
      });

      expandedChunks = expandedDbChunks.map((c) => {
        const match = isolatedChunks.find((ic) => ic.chunkId === c.id);
        return {
          chunkId: c.id,
          content: c.content,
          pageNumber: c.pageNumber,
          // Adjacent (non-matched) chunks get a low similarity so they don't override intent classifier
          similarity: match ? match.similarity : 0.08,
          materialId: activeMaterial!.id,
          materialName: activeMaterial!.fileName,
        };
      });
    }

    // 5. Prepare recent message history for context
    const recentMessages = (conversation.messages || [])
      .reverse()
      .map((m) => ({ sender: m.sender, content: m.content }));

    // 6. Generate grounded tutor response using only current material
    const tutorRes = await generateTutorResponse({
      userId: session.userId,
      projectId: params.projectId,
      learningGoal: project.learningGoal,
      userPrompt: prompt,
      retrievedChunks: expandedChunks,
      recentMessages,
    });

    // 5. Store user message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: "USER",
        content: prompt,
      },
    });

    // 6. Store assistant message
    const assistantMsg = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: "ASSISTANT",
        content: tutorRes.content,
        citations: tutorRes.citations.length > 0 ? JSON.stringify(tutorRes.citations) : null,
        isRefusal: tutorRes.isRefusal,
      },
    });

    // 7. Record learning event
    await prisma.learningEvent.create({
      data: {
        userId: session.userId,
        projectId: params.projectId,
        eventType: "TUTOR_INTERACTION",
        payload: JSON.stringify({
          promptLength: prompt.length,
          hasCitations: tutorRes.citations.length > 0,
          citationCount: tutorRes.citations.length,
          isRefusal: tutorRes.isRefusal,
        }),
      },
    });

    return NextResponse.json({
      conversationId: conversation.id,
      message: {
        id: assistantMsg.id,
        sender: "ASSISTANT",
        content: assistantMsg.content,
        citations: tutorRes.citations,
        isRefusal: tutorRes.isRefusal,
        createdAt: assistantMsg.createdAt,
      },
      model: tutorRes.model,
      latencyMs: tutorRes.latencyMs,
    });
  } catch (error: any) {
    console.error("[Tutor Route Error]:", error);
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to generate tutor response. Please try again." },
      { status: 500 }
    );
  }
}
