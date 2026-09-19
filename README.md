# AI Study Companion — AI-Powered Learning & Growth Workspace

> **Full Stack AI Engineer Challenge Submission**  
> Built strictly according to the **Project Requirements Document (PRD), Version 3.0 — Candidate Challenge Edition**.

---

## 1. Project Overview & Problem Statement

Most AI learning applications function as ephemeral chatbots: you ask a question, receive an answer, and close the tab. Context evaporates, learning progress is untracked, and responses are frequently ungrounded or prone to hallucinations.

**AI Study Companion** transforms passive AI interactions into a **persistent, contextual, and measurable learning workspace**. It anchors learning around structured projects, grounds conversational assistance in verified course materials with page citations, dynamically evaluates understanding through adaptive quizzes and open-ended rubrics, estimates concept mastery over time, and delivers actionable study recommendations.

### The Primary Learning Loop
```
Create Space
    ↓
Create Project
    ↓
Add Learning Material (PDF)
    ↓
Process & Extract Concepts
    ↓
AI Tutor (Grounded Answers + Verified Citations)
    ↓
Unsupported Question Handling & Safe Refusal
    ↓
Adaptive MCQ Quiz
    ↓
Open-Ended Rubric Assessment
    ↓
Concept Mastery & Growth Analysis
    ↓
Project Learning Analytics
    ↓
Actionable Next-Step Recommendations
    ↓
Continue Learning Journey
```

---

## 2. Key Features

- 🔐 **Hard Multi-Tenant & Project Isolation**: User A can never access User B's spaces or projects; Project A never retrieves chunks from Project B.
- 📄 **Asynchronous PDF Processing Pipeline**: Background ingestion with `pdf-parse` v2, recursive character splitting (500 chars, 64-char overlap), and page metadata preservation.
- 🧠 **Automatic Concept Extraction**: Discovers and tracks key technical concepts upon document upload.
- 🔍 **Project-Scoped RAG**: Vector similarity search with dual-mode support (OpenAI `text-embedding-3-small` or 2048-dim normalized TF-IDF feature vectors).
- 💬 **Grounded AI Tutor**: Context-aware explanations citing exact sources (`Source: [File] — Page [N]`).
- 🛡️ **Unsupported Question Handling**: Explicit refusal (`isRefusal: true`) when material evidence is absent, preventing confident hallucinations.
- 🧱 **Prompt Injection Defense**: Treats uploaded documents as untrusted data; enforces system prompt precedence.
- 🎯 **Adaptive MCQ Quizzing**: Calibrates question selection and difficulty (EASY, MEDIUM, HARD) based on concept weaknesses.
- 📝 **Open-Ended Conceptual Assessments**: 4-part pedagogical rubric evaluation (What was understood, What was correct, What is missing, What to review next).
- 📈 **Mastery & Growth Trajectories**: Transparent formula tracking concept mastery (0–100%) and trends (`IMPROVING`, `STABLE`, `REQUIRING_ATTENTION`).
- 💡 **Actionable Recommendations**: Next-step study guidance prioritized by urgency and linked to specific material pages.
- 📊 **Project & Global Analytics**: Live event stream, quiz accuracy distributions, and AI token/latency telemetry.
- 👑 **Protected Admin Dashboard**: Restricted to `ADMIN` role for system health, user metrics, material processing statuses, and AI cost tracking.

---

## 3. Tech Stack

- **Frontend**: Next.js 14.2 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons.
- **Backend & API**: Next.js Server Components, API Route Handlers, Node.js runtime.
- **Database & ORM**: SQLite (`dev.db`), Prisma ORM 5.22.0.
- **Authentication**: Stateless JWT (`jose`), `bcryptjs` password hashing, HTTP-only cookies.
- **Document Processing**: `pdf-parse` v2.4.5 class API.
- **AI & Retrieval**: OpenAI API (`gpt-4o-mini`, `text-embedding-3-small`) with deterministic offline fallbacks.

---

## 4. Project Structure

```
ai-study-companion/
├── docs/                       # Comprehensive PRD & Architecture Documentation
│   ├── PRD_CHECKLIST.md        # Requirement compliance matrix (100% PASS)
│   ├── ARCHITECTURE.md         # System design & Mermaid diagrams
│   ├── AI_USAGE.md             # Development vs production AI documentation
│   ├── DEVELOPMENT_PROMPTS.md  # Authentic prompts by feature area
│   ├── AI_EVALUATION.md        # Benchmark test cases & evaluation metrics
│   ├── SECURITY.md             # Threat model & isolation guarantees
│   ├── LIMITATIONS.md          # Honest appraisal of prototype constraints
│   └── FUTURE.md               # Production roadmap (PostgreSQL, BullMQ, pgvector)
├── prisma/
│   ├── schema.prisma           # Complete data model (12 core entities)
│   └── dev.db                  # Local SQLite database
├── scripts/
│   └── seed-demo.mjs           # Seed realistic learner & admin demo dataset
├── src/
│   ├── app/
│   │   ├── (auth)/             # Login & Registration pages
│   │   ├── (dashboard)/        # Dashboard, Spaces, Projects, Admin pages
│   │   └── api/                # RESTful API Route Handlers
│   ├── components/             # Reusable UI & Project Workspace Tabs
│   │   ├── TutorSection.tsx    # Grounded AI Tutor with citations
│   │   ├── QuizSection.tsx     # Adaptive MCQ Practice
│   │   ├── AssessmentSection.tsx # Open-Ended Rubric Assessment
│   │   ├── MasterySection.tsx  # Mastery & Growth Trajectory Tracker
│   │   ├── RecommendationsSection.tsx # Actionable Next Steps
│   │   ├── AnalyticsSection.tsx# Project Analytics & Activity Feed
│   │   └── MaterialsSection.tsx# PDF Ingestion & Chunk Inspector
│   └── lib/                    # Business Logic, RAG & Security Services
│       ├── ai-service.ts       # Grounding, citations, and telemetry logger
│       ├── auth.ts             # JWT sessions & cookie management
│       ├── concept-extractor.ts# Automatic domain concept discovery
│       ├── db.ts               # Prisma singleton client
│       ├── embeddings.ts       # Project-isolated vector search & TF-IDF
│       ├── mastery.ts          # Transparent scoring & trajectory engine
│       ├── pdf-processor.ts    # Background PDF parsing & chunking pipeline
│       ├── quiz-service.ts     # Adaptive quiz generator & grader
│       ├── recommendations.ts  # Actionable study task generator
│       └── security.ts         # Tenant ownership & admin guards
├── test_phase1.mjs             # Phase 1 Test Suite (Auth, Spaces, Projects)
├── test_phase2.mjs             # Phase 2 Test Suite (PDF, Chunks, Retrieval)
├── test_e2e.mjs                # Full End-to-End Verification Suite (22 tests)
└── package.json
```

---

## 5. Local Setup & Quick Start

### Prerequisites
- Node.js 18+ or 20+
- npm

### 1. Installation
```bash
git clone <repository-url>
cd ai-study-companion
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default configuration:
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="ai-study-companion-super-secret-key-32-chars-minimum-prod"
NODE_ENV="development"

# Optional: Add your OpenAI API key for live LLM completions.
# If omitted, high-quality local deterministic fallbacks run automatically!
# OPENAI_API_KEY="sk-..."
```

### 3. Database Migration & Demo Seeding
```bash
npx prisma db push
node scripts/seed-demo.mjs
```

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) (or `http://localhost:3001`).

---

## 6. Demo Accounts & Recommended Presentation Flow

The demo seed script (`node scripts/seed-demo.mjs`) automatically configures two accounts:

### Demo Credentials
| Role | Email | Password |
| :--- | :--- | :--- |
| **Learner** | `alex.learner@studycompanion.dev` | `LearnerPass123!` |
| **Admin** | `admin@studycompanion.dev` | `AdminPass123!` |

### Recommended Live Demo Flow
1. **Sign in as Learner** (`alex.learner@studycompanion.dev`).
2. Open the Space: **Distributed Systems & Cloud Architecture**.
3. Open the Project: **Raft Consensus Protocol**.
4. **Inspect Materials**: View `raft_consensus_notes.pdf` in status `READY` with extracted chunks.
5. **Ask Grounded Question**: Open the **AI Tutor** tab and send:
   > *"What does my material say about leader election and split votes?"*
   Notice the grounded answer with verifiable citation: `Source: raft_consensus_notes.pdf — Page 1`.
6. **Ask Unsupported Question**: Send:
   > *"What does my uploaded material say about quantum teleportation?"*
   Notice the safe refusal banner (`isRefusal: true`) and helpful next-step guidance.
7. **Take an Adaptive Quiz**: Open the **Adaptive Quiz** tab, click **Start Adaptive Quiz**, answer the MCQ, and inspect the immediate explanation and concept mastery update.
8. **Complete Open-Ended Assessment**: Open the **Open-Ended Assessment** tab, submit an explanation, and review the 4-part pedagogical rubric evaluation.
9. **Review Mastery & Growth**: Open **Mastery & Growth** to observe the updated score and trajectory classification (`IMPROVING`, `STABLE`, `REQUIRING_ATTENTION`).
10. **Review Recommendations**: Open **Recommendations** to view prioritized study actions based on your recent performance.
11. **Review Project Analytics**: Open **Analytics** to view the live event feed, quiz accuracy, and AI latency.
12. **Sign in as Admin** (`admin@studycompanion.dev`): Navigate to `/admin` to inspect platform-wide users, processing statuses, live AI request logs, and infrastructure health.

---

## 7. Running Automated Test Suites

The project features three comprehensive test suites validating every layer of the system:

```bash
# Phase 1: Authentication, Spaces, Projects, and Sessions (18/18 PASS)
node test_phase1.mjs

# Phase 2: PDF Pipeline, Chunks, Retrieval, and Idempotency (13/13 PASS)
node test_phase2.mjs

# Comprehensive End-to-End Suite: Full Learner & Admin Lifecycle (22/22 PASS)
node test_e2e.mjs
```

### Production Build Validation
Verify zero TypeScript and compilation errors:
```bash
npx next build
```

---

## 8. Summary of PRD Verification Results

| Category | PRD Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| **P0 Core** | Authentication & Protected Routes | **PASS** | `test_phase1.mjs` |
| **P0 Core** | Spaces & Projects Management | **PASS** | `test_phase1.mjs` |
| **P0 Core** | PDF Upload, Chunking & Status Pipeline | **PASS** | `test_phase2.mjs` |
| **P0 Core** | Project-Scoped RAG Retrieval | **PASS** | `test_phase2.mjs` |
| **P0 Core** | Grounded AI Tutor with Page Citations | **PASS** | `test_e2e.mjs` #8 |
| **P0 Core** | Unsupported Question Safe Refusal | **PASS** | `test_e2e.mjs` #9 |
| **P0 Core** | Prompt Injection Defense | **PASS** | `test_e2e.mjs` #10 |
| **P0 Core** | Adaptive MCQ Practice & Mastery Update | **PASS** | `test_e2e.mjs` #12, #13 |
| **P0 Core** | Open-Ended Rubric Assessment | **PASS** | `test_e2e.mjs` #14, #15 |
| **P0 Core** | Concept Mastery & Growth Trajectories | **PASS** | `test_e2e.mjs` #16 |
| **P0 Core** | Targeted Study Recommendations | **PASS** | `test_e2e.mjs` #17 |
| **P0 Core** | Event-Driven Learning Analytics | **PASS** | `test_e2e.mjs` #18 |
| **P0 Core** | Cross-Tenant Isolation (User & Project) | **PASS** | `test_e2e.mjs` #19 |
| **P0 Core** | Admin Dashboard & Access Guard | **PASS** | `test_e2e.mjs` #20, #21 |
| **P0 Core** | AI Observability & Telemetry | **PASS** | `test_e2e.mjs` #22 |
| **P0 Core** | Production Build (`npx next build`) | **PASS** | Exit Code 0 |

For full requirement matrices, architectural diagrams, and threat models, refer to the [`docs/`](./docs/) directory.
