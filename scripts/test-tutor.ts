import { prisma } from "../src/lib/db";
import { searchProjectChunks } from "../src/lib/embeddings";
import { generateTutorResponse } from "../src/lib/ai-service";

async function testQuery(title: string, userPrompt: string) {
  console.log(`\n========================================`);
  console.log(`TEST: ${title}`);
  console.log(`Prompt: "${userPrompt}"`);
  console.log(`========================================`);

  const projectId = "3f719e4e-2547-493a-953d-23537ec140ba";
  const userId = "e4939acb-0f18-498c-9ba8-bc20add70427";

  const chunks = await searchProjectChunks(projectId, userPrompt, 5);
  const response = await generateTutorResponse({
    userId,
    projectId,
    learningGoal: "Machine Learning & Python Mastery",
    userPrompt,
    retrievedChunks: chunks,
  });

  console.log(`Refusal: ${response.isRefusal}`);
  console.log(`Citations (${response.citations.length}):`, response.citations.map(c => `${c.fileName} (P${c.pageNumber}, sim=${c.similarity})`));
  console.log(`Response content:\n${response.content}`);
}

async function main() {
  await testQuery(
    "Explain binary search",
    "Explain binary search in simple terms and give an example."
  );

  await testQuery(
    "Instance-Based Learning & Advantages",
    "What is instance-based learning and what are its advantages?"
  );

  await testQuery(
    "Unsupported Question (Quantum computing)",
    "Explain quantum superposition and entanglement in quantum computing."
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
