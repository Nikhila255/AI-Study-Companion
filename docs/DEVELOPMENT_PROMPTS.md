# Development Prompts — AI Study Companion

This document records the materially important engineering prompts used during the conception, debugging, implementation, and verification of the **AI Study Companion**.

---

## 1. Architecture & Repository Audit

### Prompt 1.1: Complete Architectural Inspection
```text
You are the lead Full Stack AI Engineer. Do not blindly rebuild the application.
Inspect the complete repository: package.json, prisma schema, existing API routes,
authentication, spaces, projects, material processing, retrieval/RAG, and tests.
Run the existing tests, identify what works, identify what fails, and present a
clear repository audit and phase-by-phase implementation plan mapped to PRD v3.0.
```
*Rationale*: Ensured the existing codebase was preserved rather than discarded, establishing an accurate baseline of working features vs broken components.

---

## 2. PDF Processing & RAG Pipeline Debugging

### Prompt 2.1: Diagnosing PDF Extraction Failure
```text
Investigate the PDF processing failure where materials move from QUEUED to PROCESSING to FAILED.
Check the installed pdf-parse version (2.4.5), inspect its actual exported API, check parser lifecycle,
and identify why chunks are not being persisted to DocumentChunk. Fix the actual implementation
without weakening the test suite.
```
*Outcome*: Discovered an unfinished edit in `src/lib/pdf-processor.ts` where an uninvoked nested function left `pages` undeclared. Migrated the implementation to the `PDFParse` v2 class API (`new PDFParse({ data: uint8 })`), resolved resource cleanup via `parser.destroy()`, and achieved 13/13 passing tests in `test_phase2.mjs`.

---

## 3. Grounded AI Tutor & Citation Engine

### Prompt 3.1: Strict Grounding & Unsupported Question Handling
```text
Implement the AI Tutor service and API route. The Tutor must:
1. Perform project-scoped retrieval using searchProjectChunks(projectId, prompt).
2. Format evidence with explicit page citations: "Source: [FileName] — Page [N]".
3. Detect when a question is unsupported by retrieved chunks (similarity below threshold)
   and explicitly refuse to fabricate an answer (isRefusal: true).
4. Defend against prompt injections embedded in uploaded document text.
5. Persist the conversation and log telemetry to AIRequestLog.
```
*Outcome*: Authored `src/lib/ai-service.ts` and `src/app/api/projects/[projectId]/tutor/route.ts` with dual-mode LLM/deterministic fallback, citation badges, and refusal banners.

---

## 4. Adaptive Quiz & Open-Ended Assessment

### Prompt 4.1: Adaptive Quiz Question Generation
```text
Implement an adaptive quiz engine that:
1. Inspects the learner's current concept mastery records.
2. Selects concepts needing reinforcement (lowest mastery first).
3. Dynamically calibrates difficulty (EASY, MEDIUM, HARD).
4. Enforces strict structured JSON schema validation.
5. Immediately evaluates answers and updates the concept's MasteryRecord.
```
*Outcome*: Created `src/lib/quiz-service.ts` and `src/app/api/projects/[projectId]/quiz/route.ts` with interactive stepper UI.

### Prompt 4.2: Open-Ended Assessment with Rubric Feedback
```text
Build the open-ended assessment service. When a learner submits a free-form explanation:
1. Evaluate using a 4-part pedagogical rubric:
   - What was understood
   - What was correct
   - What is missing / needs correction
   - What to review next
2. Compute an objective semantic score (0.0 to 100.0%).
3. Update concept mastery records and record the learning event.
```
*Outcome*: Created `src/lib/assessment-service.ts` and `src/app/api/projects/[projectId]/assessments/route.ts`.

---

## 5. Mastery Calculation & Growth Analysis

### Prompt 5.1: Transparent Mastery Formula
```text
Design a transparent and explainable concept mastery scoring engine:
1. Formula: (MCQ_Accuracy * 45%) + (OpenEnded_Average * 45%) + (ActivityBonus).
2. Trajectory classification: Compare rolling 3-attempt average with historical average.
   - Delta >= +8% -> IMPROVING
   - Delta <= -8% or recent < 40% -> REQUIRING_ATTENTION
   - Otherwise -> STABLE
3. Provide growth trajectory summaries for project dashboards.
```
*Outcome*: Implemented `src/lib/mastery.ts` and `src/components/MasterySection.tsx`.

---

## 6. Recommendations & Next Steps

### Prompt 6.1: Actionable Recommendation Generation
```text
Build a recommendation engine answering 'What should I do next?'.
Inspect concept weaknesses (<65% mastery), concepts requiring attention, recent quiz mistakes,
and available uploaded materials. Generate actionable tasks like:
'Review Page 1 of raft_notes.pdf' or 'Practice 3 questions on Leader Election'.
Assign priorities (High, Medium, Low) and persist to Recommendation table.
```
*Outcome*: Created `src/lib/recommendations.ts` and `src/components/RecommendationsSection.tsx`.

---

## 7. Admin Observability & Platform Security

### Prompt 7.1: Role-Based Admin Telemetry
```text
Implement a protected Admin Dashboard route (/admin) and API (/api/admin/overview):
1. Restrict access strictly to users with role === 'ADMIN'; return HTTP 403 to ordinary learners.
2. Aggregate users, projects, material processing status, and recent learning events.
3. Calculate AI observability metrics: total calls, latency percentiles, estimated token costs,
   and success rates from AIRequestLog.
4. Report system health (database status, memory usage, uptime).
```
*Outcome*: Authored `src/app/api/admin/overview/route.ts` and `src/app/(dashboard)/admin/page.tsx`.

---

## 8. End-to-End Verification & Build Validation

### Prompt 8.1: Full E2E Verification Harness
```text
Create test_e2e.mjs testing the complete learner and admin journey end-to-end:
User Registration -> Space Creation -> Project Creation -> PDF Upload ->
Background Processing -> Chunk Storage -> Concept Extraction -> Tutor Grounding ->
Citations -> Unsupported Question Refusal -> Prompt Injection Defense ->
Adaptive Quiz -> Open-Ended Assessment -> Mastery Update -> Growth Analysis ->
Recommendations -> Analytics -> Tenant Isolation -> Admin Authorization -> AI Logs.
Verify that all 22 test points pass with zero failures.
```
*Outcome*: Delivered `test_e2e.mjs` verifying all 22 requirements with 100% pass rate.
