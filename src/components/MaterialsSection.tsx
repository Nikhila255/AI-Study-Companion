"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  RotateCcw,
  X,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface MaterialItem {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  status: "QUEUED" | "PROCESSING" | "READY" | "FAILED";
  errorMessage: string | null;
  totalPages: number;
  createdAt: string;
  _count: { chunks: number };
}

interface SearchResult {
  chunkId: string;
  materialName: string;
  pageNumber: number;
  content: string;
  similarity: number;
}

interface MaterialsSectionProps {
  projectId: string;
}

export default function MaterialsSection({ projectId }: MaterialsSectionProps) {
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchDone, setSearchDone] = useState(false);
  const [expandedChunk, setExpandedChunk] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMaterials = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/materials`);
      if (!res.ok) return;
      const data = await res.json();
      setMaterials(data.materials || []);
    } catch (err) {
      console.error("Error fetching materials:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Poll while any material is in QUEUED or PROCESSING state
  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  useEffect(() => {
    const hasInProgress = materials.some(
      (m) => m.status === "QUEUED" || m.status === "PROCESSING"
    );

    if (hasInProgress && !pollingRef.current) {
      pollingRef.current = setInterval(fetchMaterials, 2500);
    } else if (!hasInProgress && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [materials, fetchMaterials]);

  const handleFileSelect = async (file: File) => {
    setUploadError("");

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Only PDF files are supported.");
      return;
    }
    if (file.size === 0) {
      setUploadError("The selected file is empty.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setUploadError("File exceeds the 50 MB limit.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/projects/${projectId}/materials`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }
      await fetchMaterials();
    } catch (err: any) {
      setUploadError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRetry = async (materialId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/materials/${materialId}`, {
        method: "PATCH",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Retry failed");
      }
      await fetchMaterials();
    } catch (err: any) {
      setUploadError(err.message);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError("");
    setSearchDone(false);

    try {
      const res = await fetch(`/api/projects/${projectId}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, topK: 5 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setSearchResults(data.results || []);
      setSearchDone(true);
    } catch (err: any) {
      setSearchError(err.message || "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
    return isToday ? `Today, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : d.toLocaleDateString();
  };

  const readyCount = materials.filter((m) => m.status === "READY").length;

  return (
    <div id="materials-section">
      {/* Upload Area */}
      <div
        className="glass-card"
        id="upload-drop-zone"
        style={{
          border: `2px dashed ${dragOver ? "var(--accent-primary)" : "var(--border-subtle)"}`,
          textAlign: "center",
          padding: "32px",
          cursor: "pointer",
          transition: "var(--transition)",
          marginBottom: "24px",
          background: dragOver ? "rgba(99,102,241,0.06)" : undefined,
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFileSelect(file);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          style={{ display: "none" }}
          id="pdf-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
          }}
        />

        {uploading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <Loader2 size={32} color="var(--accent-primary)" style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ color: "var(--text-secondary)" }}>Uploading and queuing for processing...</span>
          </div>
        ) : (
          <>
            <Upload size={32} color="var(--accent-primary)" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontWeight: 600, color: "#f1f5f9", marginBottom: "4px" }}>
              Drop a PDF here or click to browse
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Supports text-based PDFs up to 50 MB
            </div>
          </>
        )}
      </div>

      {uploadError && (
        <div className="alert-error" id="upload-error-alert" style={{ marginBottom: "16px" }}>
          {uploadError}
          <button
            onClick={() => setUploadError("")}
            style={{ float: "right", background: "none", border: "none", color: "inherit", cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Materials List */}
      <div style={{ marginBottom: "28px" }}>
        <div className="section-header" style={{ marginBottom: "12px" }}>
          <h3 className="section-title" style={{ fontSize: "1rem" }}>
            Uploaded Materials ({materials.length})
          </h3>
          {readyCount > 0 && (
            <span className="badge badge-emerald" id="ready-materials-badge">
              {readyCount} Ready
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "24px", color: "var(--text-secondary)" }}>
            <Loader2 size={20} style={{ display: "inline-block" }} /> Loading materials...
          </div>
        ) : materials.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px",
              border: "1px dashed var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              color: "var(--text-secondary)",
              fontSize: "0.9rem",
            }}
            id="no-materials-message"
          >
            No materials uploaded yet. Upload a PDF to get started.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }} id="materials-list">
            {materials.map((mat) => (
              <div
                key={mat.id}
                className="glass-card"
                id={`material-${mat.id}`}
                style={{ padding: "16px 20px" }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <FileText size={22} color="var(--accent-primary)" />
                    <div>
                      <div style={{ fontWeight: 600, color: "#f8fafc", fontSize: "0.95rem" }}>
                        {mat.fileName}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        {formatBytes(mat.fileSizeBytes)} · Uploaded: {formatDate(mat.createdAt)}
                        {mat.status === "READY" && mat.totalPages > 0 &&
                          ` · ${mat.totalPages} page${mat.totalPages !== 1 ? "s" : ""} · ${mat._count.chunks} chunks`}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <StatusBadge status={mat.status} />
                    {mat.status === "FAILED" && (
                      <button
                        onClick={() => handleRetry(mat.id)}
                        className="btn btn-secondary btn-sm"
                        id={`retry-btn-${mat.id}`}
                        title="Retry processing"
                      >
                        <RotateCcw size={14} />
                        <span>Retry</span>
                      </button>
                    )}
                  </div>
                </div>

                {mat.status === "FAILED" && mat.errorMessage && (
                  <div
                    className="alert-error"
                    style={{ marginTop: "10px", fontSize: "0.83rem" }}
                    id={`error-${mat.id}`}
                  >
                    {mat.errorMessage}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Semantic Search Section — only shown when there are READY materials */}
      {readyCount > 0 && (
        <div id="retrieval-section">
          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "24px" }}>
            <h3 className="section-title" style={{ fontSize: "1rem", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Search size={18} color="var(--accent-cyan)" />
              Test Knowledge Retrieval
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "14px" }}>
              Search through your uploaded materials using natural language. Results are scoped strictly to this project.
            </p>

            <form onSubmit={handleSearch} id="search-form" style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                className="form-input"
                id="search-input"
                placeholder="e.g. How does leader election work?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={searching || !searchQuery.trim()}
                id="search-submit-btn"
              >
                {searching ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={16} />}
                <span>{searching ? "Searching..." : "Search"}</span>
              </button>
            </form>

            {searchError && (
              <div className="alert-error" style={{ marginTop: "10px" }} id="search-error">{searchError}</div>
            )}

            {searchDone && (
              <div style={{ marginTop: "16px" }} id="search-results">
                {searchResults.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                    No relevant results found. Try a different query.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                      Top {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} from your project materials:
                    </div>
                    {searchResults.map((result, idx) => (
                      <div
                        key={result.chunkId}
                        className="glass-card"
                        id={`search-result-${idx}`}
                        style={{ padding: "14px 18px", cursor: "pointer" }}
                        onClick={() => setExpandedChunk(expandedChunk === result.chunkId ? null : result.chunkId)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                              <FileText size={14} color="var(--accent-primary)" />
                              <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "#f1f5f9" }}>
                                {result.materialName}
                              </span>
                              <span className="badge badge-cyan" style={{ fontSize: "0.72rem" }}>
                                Page {result.pageNumber}
                              </span>
                              <span
                                style={{
                                  fontSize: "0.72rem",
                                  color: result.similarity > 0.7 ? "var(--accent-emerald)" : "var(--text-muted)",
                                  fontWeight: 600,
                                }}
                              >
                                {Math.round(result.similarity * 100)}% match
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: "0.85rem",
                                color: "var(--text-secondary)",
                                display: expandedChunk === result.chunkId ? "block" : "-webkit-box",
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                lineHeight: 1.55,
                              }}
                            >
                              {result.content}
                            </div>
                          </div>
                          <div style={{ marginLeft: "8px", color: "var(--text-muted)" }}>
                            {expandedChunk === result.chunkId ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function StatusBadge({ status }: { status: MaterialItem["status"] }) {
  switch (status) {
    case "READY":
      return (
        <span className="badge badge-emerald" id="status-badge-ready">
          <CheckCircle2 size={13} /> Ready
        </span>
      );
    case "PROCESSING":
      return (
        <span className="badge badge-cyan" style={{ animation: "pulse 1.5s ease-in-out infinite" }} id="status-badge-processing">
          <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Processing
        </span>
      );
    case "QUEUED":
      return (
        <span className="badge badge-amber" id="status-badge-queued">
          <Clock size={13} /> Queued
        </span>
      );
    case "FAILED":
      return (
        <span className="badge" style={{ background: "rgba(244,63,94,0.15)", color: "#fca5a5", border: "1px solid rgba(244,63,94,0.3)" }} id="status-badge-failed">
          <AlertCircle size={13} /> Failed
        </span>
      );
    default:
      return <span className="badge badge-indigo">{status}</span>;
  }
}
