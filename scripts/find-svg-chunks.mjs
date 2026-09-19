import { prisma } from '../src/lib/db.js';

async function main() {
  const materials = await prisma.material.findMany({
    where: { fileName: { contains: 'Unit-V' } },
    include: { chunks: { orderBy: { pageNumber: 'asc' } } }
  });

  for (const m of materials) {
    console.log(`=== MATERIAL ${m.id} (${m.fileName}, ${m.chunks.length} chunks) ===`);
    for (const c of m.chunks) {
      if (c.content.toLowerCase().includes('svg')) {
        console.log(`CHUNK WITH SVG: page ${c.pageNumber}:`, c.content);
      }
    }
  }

  // Also check AI Knowledge Management
  const akmMats = await prisma.material.findMany({
    where: { fileName: { contains: 'Knowledge' } },
    include: { chunks: { orderBy: { pageNumber: 'asc' } } }
  });
  for (const m of akmMats) {
    console.log(`=== MATERIAL ${m.id} (${m.fileName}, ${m.chunks.length} chunks) ===`);
    for (const c of m.chunks) {
      if (c.content.toLowerCase().includes('svg')) {
        console.log(`AKM CHUNK WITH SVG: page ${c.pageNumber}:`, c.content.slice(0, 300));
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
