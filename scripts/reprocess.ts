import { prisma } from "../src/lib/db";
import { processMaterial } from "../src/lib/pdf-processor";
import { extractAndStoreConcepts } from "../src/lib/concept-extractor";

async function main() {
  const materialId = "78914ec5-c6cc-4e01-b1ec-5a1b13b718cb";
  const projectId = "3f719e4e-2547-493a-953d-23537ec140ba";
  const userId = "e4939acb-0f18-498c-9ba8-bc20add70427";

  console.log(`Starting reprocessing of material ${materialId}...`);
  await processMaterial(materialId);

  const chunks = await prisma.documentChunk.findMany({
    where: { documentId: materialId },
    orderBy: [{ pageNumber: "asc" }, { chunkIndex: "asc" }],
  });

  console.log(`\n========================================`);
  console.log(`Clean Chunks Count: ${chunks.length}`);
  console.log(`========================================`);

  for (const c of chunks) {
    const meta = c.metadata ? JSON.parse(c.metadata) : {};
    console.log(`\n--- [P${c.pageNumber} C${c.chunkIndex}] type=${meta.contentType || "UNKNOWN"} (len: ${c.content.length}) ---`);
    console.log(c.content);
  }

  // Remove stale / invalid concept records if present in the project
  const deleted = await prisma.concept.deleteMany({
    where: {
      projectId,
      name: { in: ["This small PDF is", "Python & DSA Test"] },
    },
  });
  console.log(`\nCleaned up ${deleted.count} invalid concepts.`);



  // Extract concepts cleanly
  const concepts = await extractAndStoreConcepts(projectId, userId);
  console.log(`\nActive Project Concepts (${concepts.length}):`);
  for (const con of concepts) {
    console.log(`  - ${con.name} (score: ${con.importanceScore})`);
  }
}

main()
  .catch((err) => {
    console.error("Reprocessing failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
