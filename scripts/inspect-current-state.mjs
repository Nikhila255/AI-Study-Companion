import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const materials = await prisma.material.findMany({
    select: { id: true, fileName: true, status: true, projectId: true, project: { select: { name: true, userId: true, user: { select: { email: true } } } } }
  });
  console.log('=== ALL MATERIALS ===');
  console.log(JSON.stringify(materials, null, 2));

  const projects = await prisma.project.findMany({
    select: { id: true, name: true, userId: true, user: { select: { email: true } }, spaceId: true }
  });
  console.log('=== ALL PROJECTS ===');
  console.log(JSON.stringify(projects, null, 2));

  const concepts = await prisma.concept.findMany({
    select: { id: true, name: true, projectId: true }
  });
  console.log('=== ALL CONCEPTS COUNT ===', concepts.length);
  console.log(concepts.slice(0, 30));
}

main().finally(() => prisma.$disconnect());
