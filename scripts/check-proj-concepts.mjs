import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const concepts = await prisma.concept.findMany({
    where: { projectId: '3f719e4e-2547-493a-953d-23537ec140ba' },
    select: { id: true, name: true, description: true }
  });
  console.log(`Concepts for project 3f719e4e (${concepts.length}):`);
  console.log(concepts);
}

main().finally(() => prisma.$disconnect());
