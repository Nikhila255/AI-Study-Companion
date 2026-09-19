import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const prisma = new PrismaClient();

async function main() {
  const materials = await prisma.material.findMany({
    select: { id: true, fileName: true, status: true, projectId: true, project: { select: { name: true, userId: true, user: { select: { email: true } } } } }
  });
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, userId: true, user: { select: { email: true } }, spaceId: true }
  });
  const concepts = await prisma.concept.findMany({
    select: { id: true, name: true, projectId: true }
  });
  const mastery = await prisma.masteryRecord.findMany({
    select: { id: true, projectId: true, userId: true, conceptId: true, masteryScore: true, trajectory: true, totalAttempts: true, concept: { select: { name: true } } }
  });
  const attempts = await prisma.questionAttempt.findMany({
    select: { id: true, userId: true, isCorrect: true, semanticScore: true, question: { select: { conceptId: true, questionType: true, assessment: { select: { projectId: true } } } } }
  });

  fs.writeFileSync('db_dump.json', JSON.stringify({ materials, projects, concepts, mastery, attempts }, null, 2), 'utf-8');
  console.log('Saved db_dump.json');
}

main().finally(() => prisma.$disconnect());
