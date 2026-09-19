import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const m = await prisma.material.findUnique({
    where: { id: '82b21146-d78f-4ba0-8237-9715c6f6d4c4' },
    include: {
      _count: { select: { chunks: true } }
    }
  });
  console.log('Material 82b21146:', m);

  // Check any chunks for this material
  const sampleChunks = await prisma.documentChunk.findMany({
    where: { documentId: '82b21146-d78f-4ba0-8237-9715c6f6d4c4' },
    take: 5,
    select: { id: true, pageNumber: true, chunkIndex: true, content: true, metadata: true }
  });
  console.log('Sample Chunks for 82b21146:', sampleChunks.length);
  for (const c of sampleChunks) {
    console.log(`Page ${c.pageNumber}, Chunk ${c.chunkIndex}: ${c.content.substring(0, 150)}...`);
  }

  // Also check if any other materials exist matching "knowledge" or "survey" or "ai"
  const allM = await prisma.material.findMany({
    where: {
      fileName: { contains: 'knowledge', mode: 'insensitive' }
    }
  });
  console.log('Matching materials:', allM);
}

main().finally(() => prisma.$disconnect());
