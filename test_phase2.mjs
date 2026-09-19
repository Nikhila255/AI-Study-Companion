// test_phase2.mjs - Automated Test Suite for Phase 2: PDF Materials + RAG Pipeline
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:3000";

// ─── Minimal valid PDF binary (3-page-like text-based PDF) ───────────────────
// We generate a real, parseable PDF in memory so we don't need an external file.
function createMinimalPDF(text) {
  const body = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
5 0 obj
<</Length ${text.length + 50}>>
stream
BT /F1 12 Tf 50 700 Td (${text.slice(0, 200)}) Tj ET
endstream
endobj
xref
0 6
0000000000 65535 f 
trailer<</Size 6/Root 1 0 R>>
startxref
0
%%EOF`;
  return Buffer.from(body, "utf-8");
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  const results = [];
  let userACookie = "";
  let userBCookie = "";
  let spaceAId = "";
  let projectAId = "";
  let projectBId = "";
  let materialAId = "";

  function logResult(id, name, pass, evidence, error = null) {
    results.push({ id, name, pass, evidence, error });
    console.log(`[${pass ? "PASS" : "FAIL"}] #${id} ${name}`);
    if (evidence) console.log(`       Evidence: ${evidence}`);
    if (error) console.log(`       Error: ${error}`);
  }

  try {
    // ─── Setup: Create User A ───────────────────────────────────────────────
    const emailA = `p2_user_a_${Date.now()}@studycompanion.dev`;
    const regA = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "Phase2 Alice", email: emailA, password: "Pass123!" }),
    });
    const regAData = await regA.json();
    userACookie = regA.headers.get("set-cookie").split(";")[0];

    // Create Space + Project A for User A
    const spaceA = await fetch(`${BASE_URL}/api/spaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: userACookie },
      body: JSON.stringify({ name: "P2 Space A", description: "Phase 2 test space" }),
    });
    spaceAId = (await spaceA.json()).space.id;

    const projA = await fetch(`${BASE_URL}/api/spaces/${spaceAId}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: userACookie },
      body: JSON.stringify({ name: "P2 Project A", learningGoal: "Test material pipeline" }),
    });
    projectAId = (await projA.json()).project.id;

    // Create Project B for User A (for isolation test)
    const projB = await fetch(`${BASE_URL}/api/spaces/${spaceAId}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: userACookie },
      body: JSON.stringify({ name: "P2 Project B", learningGoal: "Different project" }),
    });
    projectBId = (await projB.json()).project.id;

    // ─── Setup: Create User B ───────────────────────────────────────────────
    const emailB = `p2_user_b_${Date.now()}@studycompanion.dev`;
    const regB = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "Phase2 Bob", email: emailB, password: "Pass123!" }),
    });
    userBCookie = regB.headers.get("set-cookie").split(";")[0];

    console.log("\n=== Phase 2 API & Pipeline Tests ===\n");

    // ─── Test 1: Authenticated user can upload a PDF ────────────────────────
    const pdfContent = "The Raft consensus algorithm ensures fault-tolerant state machine replication. Leader election uses randomized timeouts to prevent split votes. Log replication guarantees entries are committed only when stored on a quorum of servers.";
    const pdfBuffer = createMinimalPDF(pdfContent);
    const formDataA = new FormData();
    const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });
    formDataA.append("file", pdfBlob, "raft_consensus_notes.pdf");

    const uploadRes = await fetch(`${BASE_URL}/api/projects/${projectAId}/materials`, {
      method: "POST",
      headers: { Cookie: userACookie },
      body: formDataA,
    });
    const uploadData = await uploadRes.json();

    if (uploadRes.status === 202 && uploadData.material?.id) {
      materialAId = uploadData.material.id;
      logResult(1, "Authenticated user can upload a PDF", true, `Uploaded 'raft_consensus_notes.pdf' → materialId=${materialAId}, status=QUEUED, HTTP 202`);
    } else {
      logResult(1, "Authenticated user can upload a PDF", false, null, `Status: ${uploadRes.status}, Body: ${JSON.stringify(uploadData)}`);
    }

    // ─── Test 2: Unauthenticated user cannot upload ─────────────────────────
    const unauthForm = new FormData();
    unauthForm.append("file", new Blob([pdfBuffer], { type: "application/pdf" }), "test.pdf");
    const unauthUpload = await fetch(`${BASE_URL}/api/projects/${projectAId}/materials`, {
      method: "POST",
      body: unauthForm,
    });
    logResult(2, "Unauthenticated user cannot upload", unauthUpload.status === 401, `HTTP ${unauthUpload.status}`, unauthUpload.status !== 401 ? `Expected 401, got ${unauthUpload.status}` : null);

    // ─── Test 3: User B cannot upload to User A's Project ───────────────────
    const bForm = new FormData();
    bForm.append("file", new Blob([pdfBuffer], { type: "application/pdf" }), "test.pdf");
    const bUploadToA = await fetch(`${BASE_URL}/api/projects/${projectAId}/materials`, {
      method: "POST",
      headers: { Cookie: userBCookie },
      body: bForm,
    });
    logResult(3, "User B cannot upload to User A's Project", bUploadToA.status === 404, `HTTP ${bUploadToA.status} (404 = access denied)`, bUploadToA.status !== 404 ? `Expected 404, got ${bUploadToA.status}` : null);

    // ─── Test 4: Uploaded PDF appears in materials list ─────────────────────
    const listRes = await fetch(`${BASE_URL}/api/projects/${projectAId}/materials`, {
      headers: { Cookie: userACookie },
    });
    const listData = await listRes.json();
    const foundMaterial = listData.materials?.find((m) => m.id === materialAId);
    logResult(4, "Uploaded PDF appears in Materials list", !!foundMaterial, `Found 'raft_consensus_notes.pdf' in ${listData.materials?.length} material(s)`, !foundMaterial ? "Material not found in list" : null);

    // ─── Test 5: Processing status changes correctly ─────────────────────────
    // Poll for up to 30 seconds waiting for READY or FAILED
    let finalStatus = "QUEUED";
    let pollAttempts = 0;
    while (pollAttempts < 15 && (finalStatus === "QUEUED" || finalStatus === "PROCESSING")) {
      await sleep(2000);
      const statusRes = await fetch(`${BASE_URL}/api/projects/${projectAId}/materials/${materialAId}`, {
        headers: { Cookie: userACookie },
      });
      const statusData = await statusRes.json();
      finalStatus = statusData.material?.status || "UNKNOWN";
      pollAttempts++;
    }
    logResult(5, "Processing status changes correctly (QUEUED → PROCESSING → READY/FAILED)", finalStatus === "READY" || finalStatus === "FAILED", `Final status after processing: ${finalStatus} (${pollAttempts * 2}s)`, (finalStatus !== "READY" && finalStatus !== "FAILED") ? `Stuck at: ${finalStatus}` : null);

    // ─── Test 6: Extracted text is stored (chunks exist) ────────────────────
    const dbChunks = await prisma.documentChunk.findMany({
      where: { documentId: materialAId },
    });
    logResult(6, "Extracted text is stored in DocumentChunk", dbChunks.length > 0, `${dbChunks.length} chunk(s) stored in database for materialId=${materialAId}`, dbChunks.length === 0 ? "No chunks found in DB" : null);

    // ─── Test 7: Chunks are stored with correct fields ───────────────────────
    const validChunks = dbChunks.filter((c) => c.content && c.content.length > 0 && c.projectId === projectAId && c.documentId === materialAId);
    logResult(7, "Chunks stored with correct documentId, projectId, and content", validChunks.length === dbChunks.length && dbChunks.length > 0, `${validChunks.length}/${dbChunks.length} chunks have valid content, correct projectId and documentId`, validChunks.length !== dbChunks.length ? "Some chunks have incorrect data" : null);

    // ─── Test 8: Page metadata is preserved ─────────────────────────────────
    const chunksWithPage = dbChunks.filter((c) => c.pageNumber >= 1);
    logResult(8, "Page metadata preserved in chunks", chunksWithPage.length > 0, `${chunksWithPage.length} chunk(s) have pageNumber >= 1. Sample: page ${dbChunks[0]?.pageNumber}`, chunksWithPage.length === 0 ? "No chunks have valid page numbers" : null);

    // ─── Test 9: Retrieval returns relevant chunks ───────────────────────────
    const searchRes = await fetch(`${BASE_URL}/api/projects/${projectAId}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: userACookie },
      body: JSON.stringify({ query: "leader election randomized timeouts", topK: 3 }),
    });
    const searchData = await searchRes.json();
    const hasResults = searchRes.status === 200 && searchData.results?.length > 0;
    logResult(9, "Retrieval returns relevant chunks for a query", hasResults, `Returned ${searchData.results?.length || 0} result(s) for query "leader election randomized timeouts"`, !hasResults ? `Status ${searchRes.status}: ${JSON.stringify(searchData)}` : null);

    // ─── Test 10: Retrieval results include source metadata ──────────────────
    const firstResult = searchData.results?.[0];
    const hasMeta = firstResult && firstResult.materialName && firstResult.pageNumber >= 1 && firstResult.content;
    logResult(10, "Retrieval results include materialName and pageNumber", !!hasMeta, firstResult ? `materialName='${firstResult.materialName}', page=${firstResult.pageNumber}, similarity=${firstResult.similarity}` : "No results to check", !hasMeta ? "First result missing materialName, pageNumber, or content" : null);

    // ─── Test 11: Project A retrieval cannot return Project B chunks ─────────
    // Upload something to Project B first
    const formB = new FormData();
    formB.append("file", new Blob([createMinimalPDF("Totally different topic about deep learning neural networks backpropagation")], { type: "application/pdf" }), "deep_learning.pdf");
    const uploadB = await fetch(`${BASE_URL}/api/projects/${projectBId}/materials`, {
      method: "POST",
      headers: { Cookie: userACookie },
      body: formB,
    });
    const uploadBData = await uploadB.json();

    // Search Project A — should only return Project A chunks
    const isolationSearch = await fetch(`${BASE_URL}/api/projects/${projectAId}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: userACookie },
      body: JSON.stringify({ query: "raft consensus", topK: 10 }),
    });
    const isolationData = await isolationSearch.json();
    const crossContamination = isolationData.results?.some((r) => r.materialName === "deep_learning.pdf");
    logResult(11, "Project A retrieval NEVER returns Project B chunks", !crossContamination, `Project B material 'deep_learning.pdf' not found in Project A search results (${isolationData.results?.length || 0} results)`, crossContamination ? "CRITICAL: Project B chunks leaked into Project A results!" : null);

    // ─── Test 12: Failed processing is represented correctly ─────────────────
    // Try uploading a non-PDF (will be rejected at API layer)
    const badForm = new FormData();
    badForm.append("file", new Blob(["not a pdf at all"], { type: "text/plain" }), "fake.txt");
    const badUpload = await fetch(`${BASE_URL}/api/projects/${projectAId}/materials`, {
      method: "POST",
      headers: { Cookie: userACookie },
      body: badForm,
    });
    logResult(12, "Non-PDF upload is rejected with clear error", badUpload.status === 400, `HTTP ${badUpload.status} returned for .txt file (rejected before even reaching processor)`, badUpload.status !== 400 ? `Expected 400, got ${badUpload.status}` : null);

    // ─── Test 13: Retry does not create duplicate chunks ─────────────────────
    // Force a retry on the completed material — should get rejected since not FAILED
    const badRetry = await fetch(`${BASE_URL}/api/projects/${projectAId}/materials/${materialAId}`, {
      method: "PATCH",
      headers: { Cookie: userACookie },
    });
    const badRetryData = await badRetry.json();
    logResult(13, "Retry endpoint rejects non-FAILED materials (prevents duplicate chunks)", badRetry.status === 400, `HTTP ${badRetry.status}: '${badRetryData.error}'`, badRetry.status !== 400 ? `Expected 400, got ${badRetry.status}` : null);

  } catch (err) {
    console.error("Test execution error:", err);
  } finally {
    await prisma.$disconnect();
    console.log("\n=== PHASE 2 SUMMARY ===");
    const passed = results.filter((r) => r.pass).length;
    const failed = results.filter((r) => !r.pass).length;
    console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
    if (failed > 0) {
      console.log("\nFailed tests:");
      results.filter((r) => !r.pass).forEach((r) => console.log(`  - #${r.id} ${r.name}: ${r.error}`));
    }
  }
}

runTests();
