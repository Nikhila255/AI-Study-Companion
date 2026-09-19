import { prisma } from "../src/lib/db";
import { searchProjectChunks } from "../src/lib/embeddings";

async function main() {
  const projectId = "3f719e4e-2547-493a-953d-23537ec140ba";

  console.log("=== Test 1: Explain binary search in simple terms ===");
  const r1 = await searchProjectChunks(projectId, "Explain binary search in simple terms and give an example", 3);
  for (const r of r1) {
    console.log(`[Score: ${r.similarity.toFixed(3)}] [P${r.pageNumber} Doc: ${r.materialName}]: ${r.content.slice(0, 120).replace(/\n/g, " ")}...`);
  }

  console.log("\n=== Test 2: What is instance-based learning and what are its advantages? ===");
  const r2 = await searchProjectChunks(projectId, "What is instance-based learning and what are its advantages?", 3);
  for (const r of r2) {
    console.log(`[Score: ${r.similarity.toFixed(3)}] [P${r.pageNumber} Doc: ${r.materialName}]: ${r.content.slice(0, 120).replace(/\n/g, " ")}...`);
  }

  console.log("\n=== Test 3: Unsupported topic (Quantum computing) ===");
  const r3 = await searchProjectChunks(projectId, "Explain quantum superposition and entanglement in quantum computing", 3);
  for (const r of r3) {
    console.log(`[Score: ${r.similarity.toFixed(3)}] [P${r.pageNumber} Doc: ${r.materialName}]: ${r.content.slice(0, 120).replace(/\n/g, " ")}...`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
