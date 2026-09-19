import { PrismaClient } from '@prisma/client';
import { getConceptsForProjectAndMaterial } from '../src/lib/concept-extractor.js';
const prisma = new PrismaClient();

async function test() {
  const projectId = '3f719e4e-2547-493a-953d-23537ec140ba';
  const materialId = 'dcb836ec-91b4-45a9-89f5-0c27c7bf9d76';

  const chunks = await prisma.documentChunk.findMany({
    where: { projectId, documentId: materialId },
    select: { chunkIndex: true, pageNumber: true, content: true }
  });
  console.log('Unit IV chunks count:', chunks.length);
  if (chunks.length > 0) {
    console.log('First chunk sample:', chunks[0].content.slice(0, 300));
  }

  const concepts = await getConceptsForProjectAndMaterial(projectId, materialId, '285f1e00-48ef-4fe0-9462-d812a8537906');
  console.log('Concepts returned for Unit IV:', concepts);
}

test().finally(() => prisma.$disconnect());
