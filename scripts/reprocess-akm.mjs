import { processMaterial } from '../src/lib/pdf-processor.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const materialId = '82b21146-d78f-4ba0-8237-9715c6f6d4c4';
  console.log(`Reprocessing material ${materialId}...`);
  await processMaterial(materialId);
  console.log('Material reprocessed successfully!');

  const updated = await prisma.material.findUnique({
    where: { id: materialId },
    include: { _count: { select: { chunks: true } } }
  });
  console.log('Updated material:', updated);

  const sampleChunks = await prisma.documentChunk.findMany({
    where: { documentId: materialId },
    take: 5,
    orderBy: { chunkIndex: 'asc' },
    select: { pageNumber: true, chunkIndex: true, content: true, metadata: true }
  });

  console.log('=== FIRST 5 CHUNKS OF REPROCESSED MATERIAL ===');
  for (const c of sampleChunks) {
    console.log(`Page ${c.pageNumber} Chunk ${c.chunkIndex} [${c.metadata}]:`);
    console.log(c.content.substring(0, 200) + '...\n');
  }
}

main().finally(() => prisma.$disconnect());
