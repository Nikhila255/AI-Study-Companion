import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId: '82b21146-d78f-4ba0-8237-9715c6f6d4c4' },
    orderBy: { chunkIndex: 'asc' },
    select: { content: true }
  });

  const fullText = chunks.map(c => c.content).join('\n\n');

  // 1. Look for Keywords: ...
  const kwMatch = fullText.match(/Keywords:\s*([^\.\n]+)/i);
  console.log('Keywords line match:', kwMatch ? kwMatch[1] : 'None');

  // 2. Look for Domain headers
  const domainMatches = Array.from(fullText.matchAll(/(?:Domain\s+\d+:|Section\s+\d+:)\s*([^\n\(\.\:]{3,60})/gi)).map(m => m[1].trim());
  console.log('Domain matches:', domainMatches);

  // 3. Look for defined terms: [Term] (refers to|is defined as|is an? approach)
  const defMatches = Array.from(fullText.matchAll(/([A-Z][A-Za-z0-9\s-]{2,40})\s+(?:refers to|is defined as|is an? (?:architecture|paradigm|framework|technique|approach) that)\s+([^\.\n]+)/gi)).map(m => ({
    term: m[1].trim(),
    def: m[2].trim()
  }));
  console.log('Definition matches:', defMatches.slice(0, 10));
}

main().finally(() => prisma.$disconnect());
