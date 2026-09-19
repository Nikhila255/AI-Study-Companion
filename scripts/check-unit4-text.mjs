import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const projectId = '3f719e4e-2547-493a-953d-23537ec140ba';
  const materialId = 'dcb836ec-91b4-45a9-89f5-0c27c7bf9d76';

  const chunks = await prisma.documentChunk.findMany({
    where: { projectId, documentId: materialId },
    select: { chunkIndex: true, pageNumber: true, content: true }
  });
  console.log('Unit IV chunks count:', chunks.length);
  const text = chunks.map(c => c.content).join('\n\n');
  console.log('Total text length:', text.length);

  const conceptsInProject = await prisma.concept.findMany({
    where: { projectId },
    select: { id: true, name: true }
  });
  console.log('All concepts in project:', conceptsInProject.length);

  const matched = conceptsInProject.filter(c => {
    const n = c.name.toLowerCase();
    return text.toLowerCase().includes(n);
  });
  console.log('Concepts that appear in Unit IV text:');
  console.log(matched);
}

test().finally(() => prisma.$disconnect());
