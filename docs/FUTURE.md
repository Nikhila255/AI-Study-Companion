# Future Improvements & Production Roadmap — AI Study Companion

This document outlines the planned evolutionary phases to transition the prototype into an enterprise-scale learning platform.

---

## 1. Storage & Vector Architecture
- **PostgreSQL & `pgvector`**:
  - Replace SQLite with PostgreSQL to support concurrent writes, connection pooling (via PgBouncer), and ACID isolation.
  - Store chunk vectors as `vector(1536)` and build HNSW / IVFFlat indexes to achieve sub-millisecond retrieval scaling to millions of documents.
- **Hybrid Dense-Sparse Retrieval**:
  - Combine dense neural vector search (`text-embedding-3-small`) with BM25 sparse keyword ranking via Reciprocal Rank Fusion (RRF) for optimal precision on specialized technical terms.

---

## 2. Distributed Job Infrastructure
- **Redis & BullMQ**:
  - Decouple background PDF parsing and concept extraction into independent worker processes.
  - Implement durable job queues with exponential backoff, dead-letter queues (DLQ), and persistent progress bars.
- **Multimodal OCR Pipeline**:
  - Ingest scanned documents and diagrams using Google Cloud Document AI or Tesseract OCR with PDF layout detection.

---

## 3. Advanced Pedagogical Features
- **Streaming AI Tutor (SSE)**:
  - Stream conversational responses using Server-Sent Events (SSE) with real-time token rendering for lower perceived latency.
- **Spaced Repetition System (SRS)**:
  - Implement the SuperMemo SM-2 algorithm to schedule adaptive reviews for concepts classified as `REQUIRING_ATTENTION`.
- **Interactive Concept Knowledge Graphs**:
  - Render dynamic SVG/WebGL concept maps displaying prerequisite relationships and real-time mastery color coding across the project.
- **Flashcard Generation & Audio Tutor**:
  - Generate active recall flashcard decks directly from extracted concepts.
  - Provide voice-enabled study sessions via Web Speech API and text-to-speech models.
