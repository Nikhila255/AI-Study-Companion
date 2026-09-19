# Known Limitations — AI Study Companion

This document provides a transparent appraisal of current architectural trade-offs, prototype constraints, and system boundaries in accordance with the PRD.

---

## 1. Document Ingestion & Optical Character Recognition (OCR)
- **Text-Based PDFs Supported**: The ingestion pipeline uses `pdf-parse` v2 to extract native text streams.
- **Scanned / Image-Only PDFs**: PDFs composed purely of bitmap images or scanned document photos without embedded text streams cannot be parsed by `pdf-parse`. The system detects zero extractable characters and marks the material as `FAILED` with the clear explanation:
  > *"No extractable text found in this PDF. The document may be scanned, encrypted, or image-only."*
- **Multimodal OCR**: Integrating Tesseract or Google Cloud Vision OCR is deferred to the production roadmap.

---

## 2. In-Process Background Job Execution
- **Asynchronous Execution**: Document processing is detached from HTTP responses using Node.js `setImmediate()`, returning HTTP 202 Accepted immediately.
- **Crash Recovery**: If the Next.js process restarts mid-processing, the job is not durably persisted in an external queue like Redis/BullMQ. The material record remains in `PROCESSING`.
- **Mitigation Implemented**: The API provides a `PATCH /api/projects/[projectId]/materials/[materialId]` endpoint to retry failed or stalled processing jobs idempotently.

---

## 3. Database Concurrency & SQLite Constraints
- **Concurrency**: The prototype uses SQLite (`dev.db`). SQLite utilizes file-level locking during writes. While highly performant for prototypes and development testing, high-concurrency production workloads will experience lock contention.
- **Windows File Locks**: On Windows systems, running multiple Node processes (e.g. `npm run dev` and `npx prisma studio` concurrently) can lock the native query engine DLL (`EPERM`), requiring processes to stop before running schema migrations.

---

## 4. Vector Storage & Search Scaling
- **In-Process Similarity Scoring**: Vector embeddings are serialized as JSON float arrays in the SQLite `DocumentChunk.embedding` column. Retrieval loads all project chunks into memory and computes cosine similarity in-process ($O(N)$ over project chunks).
- **Prototype Scale**: Extremely fast for projects containing up to thousands of chunks. Projects with hundreds of thousands of chunks require indexed vector databases (`pgvector` with HNSW).

---

## 5. Embedding Fallback Representation
- **Primary Provider**: OpenAI `text-embedding-3-small` (1536 dimensions).
- **Local Fallback**: When `OPENAI_API_KEY` is not present, the system defaults to a deterministic 2048-dimensional TF-IDF sparse feature vector with stable hashing.
- **Trade-off**: The local fallback allows the entire test suite and learning loop to run 100% offline without credentials, but lacks the deep semantic nuance of neural embeddings.
