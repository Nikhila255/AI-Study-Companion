// scripts/seed-demo.mjs - Seed realistic demo dataset for presentation and evaluation
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function seed() {
  console.log("Seeding realistic demo environment for AI Study Companion...");

  const passwordHash = await bcrypt.hash("LearnerPass123!", 10);
  const adminPasswordHash = await bcrypt.hash("AdminPass123!", 10);

  // 1. Create / Upsert Demo Learner
  const learner = await prisma.user.upsert({
    where: { email: "alex.learner@studycompanion.dev" },
    update: {},
    create: {
      email: "alex.learner@studycompanion.dev",
      fullName: "Alex Learner",
      passwordHash,
      role: "LEARNER",
    },
  });

  // 2. Create / Upsert Demo Admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@studycompanion.dev" },
    update: { role: "ADMIN" },
    create: {
      email: "admin@studycompanion.dev",
      fullName: "Platform Admin",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
  });

  // 3. Create Space
  let space = await prisma.space.findFirst({
    where: { userId: learner.id, name: "Distributed Systems & Cloud Architecture" },
  });

  if (!space) {
    space = await prisma.space.create({
      data: {
        userId: learner.id,
        name: "Distributed Systems & Cloud Architecture",
        description: "Core algorithms for consensus, state machine replication, and fault tolerance",
        iconColor: "#6366F1",
      },
    });
  }

  // 4. Create Project
  let project = await prisma.project.findFirst({
    where: { spaceId: space.id, name: "Raft Consensus Protocol" },
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        spaceId: space.id,
        userId: learner.id,
        name: "Raft Consensus Protocol",
        description: "Comprehensive study of leader election, log replication, and randomized timeouts",
        learningGoal: "Master state machine replication and partition handling under the Raft consensus algorithm",
      },
    });
  }

  // 5. Ensure Uploads Directory & Sample PDF
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const sampleStoragePath = path.join(uploadsDir, `${project.id}_raft_consensus_notes.pdf`);
  const samplePdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
5 0 obj<</Length 180>>stream
BT /F1 12 Tf 50 700 Td (The Raft consensus algorithm ensures fault-tolerant state machine replication. Leader election uses randomized election timeouts to prevent split votes. Log replication guarantees entries are committed only when stored on a quorum of servers.) Tj ET
endstream
endobj
xref
0 6
0000000000 65535 f 
trailer<</Size 6/Root 1 0 R>>
startxref
0
%%EOF`;

  fs.writeFileSync(sampleStoragePath, Buffer.from(samplePdf, "utf-8"));

  // 6. Create Material
  let material = await prisma.material.findFirst({
    where: { projectId: project.id, fileName: "raft_consensus_notes.pdf" },
  });

  if (!material) {
    material = await prisma.material.create({
      data: {
        projectId: project.id,
        userId: learner.id,
        fileName: "raft_consensus_notes.pdf",
        fileSizeBytes: 506,
        mimeType: "application/pdf",
        storagePath: sampleStoragePath,
        status: "READY",
        totalPages: 1,
      },
    });
  }

  // 7. Chunks
  const existingChunks = await prisma.documentChunk.count({ where: { documentId: material.id } });
  if (existingChunks === 0) {
    await prisma.documentChunk.create({
      data: {
        documentId: material.id,
        projectId: project.id,
        pageNumber: 1,
        chunkIndex: 0,
        content: "The Raft consensus algorithm ensures fault-tolerant state machine replication. Leader election uses randomized election timeouts to prevent split votes. Log replication guarantees entries are committed only when stored on a quorum of servers.",
        tokenCount: 45,
        metadata: JSON.stringify({ source: "raft_consensus_notes.pdf", pageNumber: 1 }),
      },
    });
  }

  // 8. Key Concepts
  const conceptsData = [
    {
      name: "Leader Election",
      description: "Mechanism by which distributed nodes agree upon a single coordinator node.",
      importanceScore: 0.9,
    },
    {
      name: "Consensus Algorithm",
      description: "Protocol ensuring distributed nodes agree on values or sequence of actions despite failures.",
      importanceScore: 0.95,
    },
    {
      name: "Log Replication",
      description: "Process of synchronizing state machine commands across all replica servers.",
      importanceScore: 0.85,
    },
    {
      name: "Randomized Election Timeouts",
      description: "Technique using jittered timers to prevent simultaneous candidate elections.",
      importanceScore: 0.8,
    },
  ];

  for (const c of conceptsData) {
    await prisma.concept.upsert({
      where: {
        projectId_name: { projectId: project.id, name: c.name },
      },
      update: {},
      create: {
        projectId: project.id,
        name: c.name,
        description: c.description,
        importanceScore: c.importanceScore,
      },
    });
  }

  // 9. Initial Mastery Records
  const allConcepts = await prisma.concept.findMany({ where: { projectId: project.id } });
  for (const concept of allConcepts) {
    const score = concept.name === "Leader Election" ? 88.0 : concept.name === "Consensus Algorithm" ? 75.0 : 54.0;
    const trajectory = score >= 80 ? "IMPROVING" : score >= 60 ? "STABLE" : "REQUIRING_ATTENTION";

    await prisma.masteryRecord.upsert({
      where: {
        projectId_userId_conceptId: {
          projectId: project.id,
          userId: learner.id,
          conceptId: concept.id,
        },
      },
      update: {},
      create: {
        projectId: project.id,
        userId: learner.id,
        conceptId: concept.id,
        masteryScore: score,
        trajectory,
        totalAttempts: 3,
        successfulAttempts: score >= 70 ? 3 : 1,
      },
    });
  }

  // 10. Recommendations
  const weakConcept = allConcepts.find((c) => c.name === "Randomized Election Timeouts");
  await prisma.recommendation.create({
    data: {
      projectId: project.id,
      userId: learner.id,
      conceptId: weakConcept?.id,
      recommendedAction: "Review Page 1 of raft_consensus_notes.pdf on Randomized Election Timeouts",
      rationale: "Recent attempts indicated difficulty with election timeouts and split votes. A targeted review will strengthen your mental model.",
      priority: 1,
    },
  });

  // 11. Initial Learning Events
  await prisma.learningEvent.create({
    data: {
      userId: learner.id,
      projectId: project.id,
      eventType: "PROJECT_CREATED",
      payload: JSON.stringify({ projectName: project.name, learningGoal: project.learningGoal }),
    },
  });

  console.log("\n==================================================");
  console.log("DEMO ENVIRONMENT READY!");
  console.log("==================================================");
  console.log("Learner Credentials:");
  console.log("  Email:    alex.learner@studycompanion.dev");
  console.log("  Password: LearnerPass123!\n");
  console.log("Admin Credentials:");
  console.log("  Email:    admin@studycompanion.dev");
  console.log("  Password: AdminPass123!\n");
  console.log("Demo Space:   'Distributed Systems & Cloud Architecture'");
  console.log("Demo Project: 'Raft Consensus Protocol'");
  console.log("==================================================\n");

  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
