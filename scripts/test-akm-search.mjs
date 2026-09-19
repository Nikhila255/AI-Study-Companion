import { searchProjectChunks } from '../src/lib/embeddings.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const projectId = '3f719e4e-2547-493a-953d-23537ec140ba';
  const materialId = '82b21146-d78f-4ba0-8237-9715c6f6d4c4';
  const query = 'What is Artificial Intelligence in Knowledge Management?';

  console.log(`Searching for: "${query}" in material ${materialId}...`);
  const results = await searchProjectChunks(projectId, query, 5, materialId);
  console.log(`Found ${results.length} results:`);
  for (const r of results) {
    console.log(`Page ${r.pageNumber} (score: ${r.similarity}): ${r.content.substring(0, 150)}...\n`);
  }
}

main().finally(() => prisma.$disconnect());
