import { PrismaClient } from '@prisma/client';
import { getConceptsForProjectAndMaterial } from '../src/lib/concept-extractor.js';
const prisma = new PrismaClient();

async function test() {
  const projectId = '3f719e4e-2547-493a-953d-23537ec140ba';
  const materialId = 'dcb836ec-91b4-45a9-89f5-0c27c7bf9d76';
  const user = await prisma.user.findFirst({ where: { email: 'tester_1789648523194@studycompanion.dev' } });
  const userId = user.id;

  // 1. Fetch materials for this project
  const materials = await prisma.material.findMany({
    where: {
      projectId,
      ...(materialId ? { id: materialId } : {}),
    },
    select: {
      id: true,
      fileName: true,
      status: true,
      totalPages: true,
      _count: { select: { chunks: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  console.log('Active material:', materials[0]?.fileName);

  // 2. Scoped concepts
  const scopedConcepts = await getConceptsForProjectAndMaterial(
    projectId,
    materialId,
    userId
  );
  console.log('Scoped concepts for Unit IV:', scopedConcepts.map(c => c.name));

  const scopedConceptIds = new Set(scopedConcepts.map((c) => c.id));

  // 3. Question attempts
  const attempts = await prisma.questionAttempt.findMany({
    where: {
      userId,
      question: {
        assessment: { projectId },
        ...(scopedConceptIds.size > 0 ? { conceptId: { in: Array.from(scopedConceptIds) } } : {}),
      },
    },
    include: {
      question: {
        select: {
          conceptId: true,
          concept: { select: { name: true } },
          questionType: true,
          difficultyLevel: true,
        },
      },
    },
  });

  console.log('Attempts matching query:', attempts.map(a => ({
    id: a.id,
    concept: a.question.concept?.name,
    isCorrect: a.isCorrect
  })));

  // 4. Mastery records
  const masteryRecords = await prisma.masteryRecord.findMany({
    where: {
      projectId,
      userId,
      conceptId: { in: Array.from(scopedConceptIds) },
    },
    include: { concept: true },
  });

  console.log('Mastery records for scoped concepts:', masteryRecords.map(m => ({
    concept: m.concept.name,
    score: m.masteryScore,
    totalAttempts: m.totalAttempts
  })));
}

test().finally(() => prisma.$disconnect());
