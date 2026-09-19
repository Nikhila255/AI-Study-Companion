import { extractAndStoreConcepts, getConceptsForProjectAndMaterial } from '../src/lib/concept-extractor.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const projectId = '3f719e4e-2547-493a-953d-23537ec140ba';
  const userId = '285f1e00-48ef-4fe0-9462-d812a8537906';
  const materialId = '82b21146-d78f-4ba0-8237-9715c6f6d4c4';

  console.log('Extracting concepts for material 82b21146...');
  const extracted = await extractAndStoreConcepts(projectId, userId, materialId);
  console.log(`Extracted ${extracted.length} concepts:`, extracted.map(e => e.name));

  console.log('\nGetting concepts strictly scoped to material 82b21146...');
  const scoped = await getConceptsForProjectAndMaterial(projectId, materialId, userId);
  console.log(`Scoped concepts count: ${scoped.length}`);
  console.log(scoped.map(s => s.name));

  // Check if Binary Search is in scoped:
  const hasBinarySearch = scoped.some(s => s.name.toLowerCase().includes('binary search'));
  console.log('Is Binary Search in scoped concepts?', hasBinarySearch ? 'LEAK (FAIL)' : 'CLEAN (PASS)');
}

main().finally(() => prisma.$disconnect());
