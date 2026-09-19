# AI Usage Documentation — AI Study Companion

This document provides complete transparency regarding how Artificial Intelligence was utilized both **during the development of the codebase** and **within the runtime architecture of the final application**.

---

## Part A: AI Used to BUILD the Product

During development, AI assistants (specifically Google DeepMind Antigravity, Gemini 3.8, and Claude 3.5 Sonnet) served as pair-programming and engineering copilots under strict human oversight.

### 1. Development Workflows Accelerated by AI
- **Repository Auditing & Root-Cause Diagnosis**:
  - Identified the scoping bug in `src/lib/pdf-processor.ts` where an uninvoked nested function left `pages` undeclared.
  - Investigated `pdf-parse@2.4.5` v2 class API migration (`new PDFParse({ data: uint8 })`).
- **Data Modeling & Type Safety**:
  - Implemented the full schema models (`MasteryRecord`, `Recommendation`, `QuestionAttempt`, `AIRequestLog`).
  - Drafted TypeScript interfaces ensuring type compliance across API routes and components.
- **Test Automation Suite Design**:
  - Developed the comprehensive 22-point end-to-end verification harness (`test_e2e.mjs`) simulating realistic multi-tenant learners and administrators.
- **Production Optimization**:
  - Diagnosed Windows file-lock (`EPERM`) mechanics during Prisma engine builds.
  - Resolved missing package declarations for icons in `src/types/global.d.ts`.

### 2. Human Review & Verification Rigor
- **Zero Mock Policy**: No test was weakened, mocked, or bypassed to create artificial passes.
- **Manual Architecture Review**: All database relationships, foreign key cascades, and authorization gates in `src/lib/security.ts` were manually inspected and validated.
- **Independent Automated Testing**: All automated test runs (`test_phase1.mjs`, `test_phase2.mjs`, `test_e2e.mjs`) were executed in actual Node/Next environments against the SQLite database.

---

## Part B: AI Used INSIDE the Final Product

The final product uses Artificial Intelligence as a pedagogical tutor, an adaptive assessment engine, and an automated learning analyst.

### 1. Grounded Conversational AI Tutor
- **Role**: Answers student questions grounded strictly in their uploaded PDF materials.
- **Grounded Citation Engine**:
  - Extracts and displays verifiable citations: `Source: [Material Name] — Page [N]`.
  - Links citations directly to retrieved document chunks stored in `DocumentChunk`.
- **Unsupported Question Handling**:
  - If a student asks a query with no supporting evidence in their uploaded materials (e.g. asking about quantum teleportation inside a distributed systems project), the Tutor returns a safe refusal (`isRefusal: true`) and suggests relevant next steps.
- **Prompt Injection Defense**:
  - Documents are treated as untrusted text. System instructions enforce priority over any user-uploaded directives trying to override system behavior or reveal API keys.

### 2. Automatic Concept Extraction
- **Role**: Automatically analyzes processed text chunks to discover 3-6 core technical topics (e.g., *Leader Election*, *Consensus Algorithm*, *Log Replication*).
- **Persistence**: Upserts concepts directly to the `Concept` table, making them available across quizzes, assessments, and recommendations.

### 3. Adaptive Quiz Generation & Scoring
- **Role**: Generates dynamic multiple-choice questions calibrated to the student's weakest concepts.
- **Structured Schema Enforcement**: Validates questions as JSON objects containing 4 distinct options, a correct index, difficulty level, and explanation.
- **Mastery Feedback Loop**: Immediately records student performance into `QuestionAttempt` and updates `MasteryRecord`.

### 4. Open-Ended Assessment Evaluator
- **Role**: Evaluates free-form student explanations using structured pedagogical rubrics.
- **Feedback Dimensions**:
  1. *What You Understood* (strengths and conceptual reasoning).
  2. *What Was Correct* (verified technical facts).
  3. *What Is Missing / Needs Correction* (unaddressed nuances or edge cases).
  4. *What to Review Next* (actionable reading directives).
- **Semantic Score**: Computes an objective 0.0 to 100.0% score that feeds directly into mastery calculations.

### 5. Recommendation Engine
- **Role**: Answers *"What should I do next?"* by analyzing mastery scores, recent mistakes, and available document pages.
- **Prioritization**: Ranks recommendations into High, Medium, and Low priorities with clear rationales.

### 6. AI Observability & Telemetry
- **Role**: Every AI request is recorded in `AIRequestLog`:
  - `modelName`, `featureArea`, `latencyMs`, `promptTokens`, `completionTokens`, `totalTokens`, `estimatedCostUsd`, `isSuccess`.
- **Admin Dashboard**: Exposes aggregate latency, success rates, and token cost telemetry to administrators.
