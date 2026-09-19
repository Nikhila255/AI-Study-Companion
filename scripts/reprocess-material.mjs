import { PrismaClient } from "@prisma/client";
import { processMaterial } from "../src/lib/pdf-processor.js";
import { extractAndStoreConcepts } from "../src/lib/concept-extractor.js";

const prisma = new PrismaClient();

async function main() {
  const materialId = "78914ec5-c6cc-4e01-b1ec-5a1b13b718cb";
  const projectId = "3f719e4e-2547-493a-953d-23537ec140ba";
  const userId = "e4939acb-0f18-498c-9ba8-bc20add70427";

  console.log(`Reprocessing material ${materialId}...`);
  await processMaterial(materialId);

  const chunks = await prisma.documentChunk.findMany({
    where: { documentId: materialId },
    orderBy: [{ pageNumber: "asc" }, { chunkIndex: "asc" }],
  });

  console.log(`✓ Clean chunk count: ${chunks.length}`);
  for (const c of chunks) {
    const meta = c.metadata ? JSON.parse(c.metadata) : {};
    console.log(`[P${c.pageNumber} C${c.chunkIndex}] type=${meta.contentType || "UNKNOWN"} len=${c.content.length}: ${c.content.slice(0, 80).replace(/\n/g, " ")}...`);
  }

  // Remove stale / invalid concepts if any
  const deleted = await prisma.concept.deleteMany({
    where: {
      projectId,
      name: { in: ["This small PDF is", "Python & DSA Test"] },
    },
  });
  console.log(`Removed ${deleted.count} stale/invalid concepts.`);

  // Extract concepts cleanly
  const concepts = await extractAndStoreConcepts(projectId, userId);
  console.log(`Updated project concepts (${concepts.length}):`, concepts.map((c) => c.name));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
