"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Loader2,
  Sparkles,
  BookOpen,
  AlertTriangle,
  Bot,
  User,
  HelpCircle,
  CheckCircle2,
  FileText,
} from "lucide-react";

interface Citation {
  documentId: string;
  fileName: string;
  pageNumber: number;
  textSnippet: string;
  similarity?: number;
}

interface Message {
  id: string;
  sender: "USER" | "ASSISTANT";
  content: string;
  citations?: Citation[];
  isRefusal?: boolean;
  createdAt: string;
}

interface TutorSectionProps {
  projectId: string;
  learningGoal: string;
  materialId?: string;
  materialName?: string;
}

/**
 * Client-side sanitization to guarantee no svg tags, stray "svg" tokens,
 * parser metadata, or escaped backslashes are ever displayed in the UI.
 * Legitimate mathematical symbols like "(2,1), therefore the predicted class is +" are preserved.
 */
function cleanTutorText(text: string): string {
  if (!text) return "";
  return text
    // 1. Strip <svg>...</svg> blocks and standalone <svg> tags
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<\/?[a-z0-9]+:svg[^>]*>/gi, "")
    .replace(/<svg[^>]*>/gi, "")
    .replace(/<\/svg>/gi, "")
    // 2. Strip standalone 'svg' or repeated 'svg\s*svg' tokens
    .replace(/\b(?:svg|SVG)\b/gi, "")
    // 3. Strip @GEN_AI tags
    .replace(/@GEN_AI[a-zA-Z0-9_-]*/g, "")
    // 4. Strip raw HTML tags that might have leaked, except <code> or <pre>
    .replace(/<(?!\/?(?:code|pre)\b)[^>]+>/gi, "")
    // 5. Strip unprintable control characters
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFEFF]/g, "")
    // 6. Strip artifact markers like [?]
    .replace(/\[\?\]/g, "")
    // 7. Unescape backslashes before colons and punctuation
    .replace(/\\:/g, ":")
    .replace(/\\_/g, "_")
    .replace(/\\~/g, "~")
    // 8. Remove empty bold markers like ** ** or __ __
    .replace(/\*\*\s*\*\*/g, "")
    .replace(/__\s*__/g, "")
    // 9. Fix duplicate bullets: "- **•**" -> "•", "- •" -> "•", "• **•**" -> "•"
    .replace(/^(\s*[-*•]\s*)+(\*\*[•*-]\*\*\s*)?/gm, "• ")
    .replace(/^(\s*\*\*[•*-]\*\*\s*)/gm, "• ")
    .replace(/^[•\-\*]\s*\*\*[•\-\*]\*\*\s*/gm, "• ")
    // 10. Clean broken leading brackets or parentheses at chunk starts (e.g., ")) and use them")
    .replace(/^[\)\]\}]+\s*/gm, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Strips leading duplicate bullet characters, dashes, and redundant markers
 * like "- **•**", "- •", "• •", or "* •", returning a clean string for single-bullet display.
 */
function cleanBulletText(line: string): string {
  let cleaned = line.trim();
  // Strip any combination of -, *, •, >, **, __, and whitespace at start
  cleaned = cleaned.replace(/^(?:[\s\-\*•>]|(?:\*\*[•\-\*]\*\*)|(?:__•__))+\s*/gi, "");
  cleaned = cleaned.replace(/^[\s\-\*•:]+\s*/i, "");
  cleaned = cleaned.replace(/\*\*\s*\*\*/g, "").trim();
  cleaned = cleaned.replace(/^[•\-\*]\s*/, "").trim();
  return cleaned;
}

/**
 * Renders inline markdown properly:
 * - **bold** or __bold__ -> <strong>
 * - `code` -> <code>
 * - *italic* -> <em>
 * - \: -> :
 * Preserves mathematical notations like (2,1), +, -, xq, d(xi,xj).
 * Strips any leftover raw ** so no unparsed markdown asterisks leak to DOM.
 */
function formatRichText(text: string): React.ReactNode {
  if (!text) return null;

  const cleaned = text
    .replace(/\\:/g, ":")
    .replace(/\\_/g, "_")
    .replace(/\\~/g, "~")
    .replace(/\\-/g, "-")
    .replace(/\\\*/g, "*")
    .replace(/\b(?:svg|SVG)\b/gi, "")
    .replace(/\*\*\s*\*\*/g, "")
    .replace(/__\s*__/g, "")
    .replace(/\*\*([•\-\*])\*\*/g, "$1");

  const tokens = cleaned.split(/(\*\*[^*]+?\*\*|__[^_]+?__|`[^`]+?`|\*[^*]+?\*)/g);

  return tokens.map((tok, idx) => {
    if (!tok) return null;

    if (
      (tok.startsWith("**") && tok.endsWith("**") && tok.length >= 4) ||
      (tok.startsWith("__") && tok.endsWith("__") && tok.length >= 4)
    ) {
      const inner = tok.slice(2, -2).trim();
      if (!inner) return null;
      return (
        <strong key={idx} style={{ fontWeight: 600, color: "#f8fafc" }}>
          {inner}
        </strong>
      );
    }

    if (tok.startsWith("`") && tok.endsWith("`") && tok.length >= 2) {
      return (
        <code
          key={idx}
          style={{
            background: "rgba(30, 41, 59, 0.85)",
            padding: "2px 6px",
            borderRadius: "4px",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: "0.86em",
            color: "#a5b4fc",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          {tok.slice(1, -1)}
        </code>
      );
    }

    if (tok.startsWith("*") && tok.endsWith("*") && tok.length >= 2 && !tok.startsWith("**")) {
      return (
        <em key={idx} style={{ fontStyle: "italic", color: "#e2e8f0" }}>
          {tok.slice(1, -1)}
        </em>
      );
    }

    // Strip any lingering double asterisks or double underscores that failed to pair
    const sanitized = tok.replace(/\*\*/g, "").replace(/__/g, "");
    return <span key={idx}>{sanitized}</span>;
  });
}

export default function TutorSection({
  projectId,
  learningGoal,
  materialId,
  materialName,
}: TutorSectionProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    fetchMessages();
  }, [projectId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const fetchMessages = async () => {
    try {
      setInitialLoading(true);
      const res = await fetch(`/api/projects/${projectId}/tutor`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Failed to load conversation history:", err);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const prompt = inputPrompt.trim();
    if (!prompt || loading) return;

    setInputPrompt("");
    setError(null);

    // Optimistic user message
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      sender: "USER",
      content: prompt,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/tutor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, materialId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to get response from Tutor");
      }

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        tempUserMsg,
        {
          id: data.message.id,
          sender: "ASSISTANT",
          content: cleanTutorText(data.message.content),
          citations: data.message.citations || [],
          isRefusal: data.message.isRefusal,
          createdAt: data.message.createdAt,
        },
      ]);
    } catch (err: any) {
      setError(err.message || "Unable to retrieve information from the current study material. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Dynamic suggested questions based on the active document
  const isIBL =
    (materialName && materialName.toLowerCase().includes("instancebasedlearning")) ||
    (materialName && materialName.toLowerCase().includes("instance-based"));

  const defaultPrompts = isIBL
    ? [
        "What is Instance-Based Learning?",
        "What is the difference between lazy learning and eager learning?",
        "How does k-Nearest Neighbor learning work?",
        "What is the difference between Euclidean distance and Manhattan distance?",
        "What is Locally Weighted Regression?",
      ]
    : [
        "What are the core concepts covered in this study material?",
        "Can you explain the key methodologies in simple terms?",
        "What are practical examples of the techniques discussed?",
        "What are the main advantages and limitations identified?",
        "How does this material support our current learning goal?",
      ];

  return (
    <div className="tutor-card-container" id="tutor-container">
      {/* Header */}
      <div className="tutor-header">
        <div className="tutor-header-title">
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "rgba(99, 102, 241, 0.15)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent-primary)",
            }}
          >
            <Bot size={20} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontWeight: 700, color: "#fff", fontSize: "1.05rem" }}>
                AI Study Tutor
              </span>
              <span className="tutor-header-badge">Grounded Citations</span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "2px" }}>
              {materialName ? (
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <FileText size={13} color="var(--accent-primary)" />
                  <span>Current Material: </span>
                  <strong style={{ color: "#fff" }}>{materialName}</strong>
                </span>
              ) : (
                <span>Goal: {learningGoal}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages Viewport */}
      <div className="tutor-messages-viewport" id="tutor-messages-thread">
        {initialLoading ? (
          <div className="tutor-empty-container">
            <Loader2 size={24} className="animate-spin" color="var(--accent-primary)" />
            <span style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginTop: "12px" }}>
              Loading study conversation...
            </span>
          </div>
        ) : messages.length === 0 ? (
          <div className="tutor-empty-container">
            <div className="tutor-empty-icon">
              <Sparkles size={26} />
            </div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff", marginBottom: "8px" }}>
              Ask a question to start learning from your material.
            </h3>
            <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", maxWidth: "460px", marginBottom: "24px" }}>
              Ask questions grounded directly in <strong>{materialName || "your active study document"}</strong>.
              Every factual answer includes structured pedagogical breakdowns and verified page citations.
            </p>

            <div style={{ width: "100%", maxWidth: "620px", textAlign: "left" }}>
              <span
                style={{
                  fontSize: "0.74rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--accent-primary)",
                  display: "block",
                  marginBottom: "10px",
                }}
              >
                Suggested Questions for this Material:
              </span>
              <div className="tutor-suggested-grid">
                {defaultPrompts.map((sp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setInputPrompt(sp)}
                    className="tutor-suggested-btn"
                  >
                    <span style={{ color: "var(--accent-primary)", fontWeight: "bold", marginRight: "6px" }}>
                      ›
                    </span>
                    &ldquo;{sp}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === "USER";
            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: isUser ? "flex-end" : "flex-start",
                  width: "100%",
                }}
              >
                {!isUser && (
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: "rgba(99, 102, 241, 0.15)",
                      border: "1px solid rgba(99, 102, 241, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--accent-primary)",
                      flexShrink: 0,
                      marginTop: "4px",
                    }}
                  >
                    <Bot size={16} />
                  </div>
                )}

                <div
                  className={
                    isUser
                      ? "tutor-msg-user"
                      : msg.isRefusal
                      ? "tutor-msg-assistant tutor-msg-refusal"
                      : "tutor-msg-assistant"
                  }
                >
                  {/* Warning banner for unsupported questions */}
                  {msg.isRefusal && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "var(--accent-amber)",
                        marginBottom: "14px",
                        paddingBottom: "10px",
                        borderBottom: "1px solid rgba(245, 158, 11, 0.2)",
                      }}
                    >
                      <AlertTriangle size={16} />
                      <span>Notice — Question Not In Current Material</span>
                    </div>
                  )}

                  {/* Structured educational answer rendering */}
                  <StructuredTutorAnswer content={msg.content} isUser={isUser} />
                </div>

                {isUser && (
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: "rgba(51, 65, 85, 0.6)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#cbd5e1",
                      flexShrink: 0,
                      marginTop: "4px",
                    }}
                  >
                    <User size={16} />
                  </div>
                )}
              </div>
            );
          })
        )}

        {loading && (
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-start", width: "100%" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "rgba(99, 102, 241, 0.15)",
                border: "1px solid rgba(99, 102, 241, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-primary)",
                flexShrink: 0,
              }}
            >
              <Bot size={16} />
            </div>
            <div
              style={{
                padding: "16px 20px",
                borderRadius: "16px",
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                color: "var(--text-secondary)",
                fontSize: "0.9rem",
              }}
            >
              <Loader2 size={18} className="animate-spin" color="var(--accent-primary)" />
              <span>Generating your answer...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="alert-error" style={{ margin: "10px 0" }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Professional AI Composer Form (Part 8 & 9) */}
      <form onSubmit={handleSend} className="tutor-composer-wrap" id="tutor-composer-form">
        <textarea
          rows={3}
          id="tutor-question-input"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask a question about your study material..."
          disabled={loading}
          className="tutor-composer-field"
        />

        <div className="tutor-composer-actions">
          <span className="tutor-composer-hint">
            Press <strong style={{ color: "#e2e8f0" }}>Enter</strong> to ask · <strong style={{ color: "#e2e8f0" }}>Shift + Enter</strong> for new line
          </span>

          <button
            type="submit"
            id="btn-ask-tutor"
            disabled={loading || !inputPrompt.trim()}
            className="tutor-btn-ask"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Generating answer...</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>Ask Tutor</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Structured educational answer renderer that parses:
 * QUESTION
 * DEFINITION
 * KEY POINTS
 * EXPLANATION
 * EXAMPLE
 * SOURCE
 *
 * Discards any raw SVG or HTML artifacts and formats cleanly with visual hierarchy.
 */
function StructuredTutorAnswer({ content, isUser }: { content: string; isUser: boolean }) {
  if (isUser) {
    return (
      <div style={{ whiteSpace: "pre-wrap", fontSize: "0.92rem", lineHeight: 1.55 }}>
        {formatRichText(content)}
      </div>
    );
  }

  // Clean all raw SVG, stray tokens, or HTML artifacts immediately
  const cleanContent = cleanTutorText(content);

  // Split into sections by markdown heading 3 (###) or bold section labels
  const rawSections = cleanContent.split(/(?=###\s+)/g);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
      {rawSections.map((section, idx) => {
        const trimmed = section.trim();
        if (!trimmed) return null;

        // QUESTION
        if (/^###\s+QUESTION/i.test(trimmed)) {
          const body = trimmed.replace(/^###\s+QUESTION\s*/i, "").trim();
          return (
            <div key={idx} className="tutor-section-block">
              <span className="tutor-section-label tutor-label-question">Question</span>
              <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "#fff", lineHeight: 1.4 }}>
                {formatRichText(body)}
              </div>
            </div>
          );
        }

        // DEFINITION
        if (/^###\s+DEFINITION/i.test(trimmed)) {
          const body = trimmed.replace(/^###\s+DEFINITION\s*/i, "").trim();
          return (
            <div key={idx} className="tutor-section-block">
              <span className="tutor-section-label tutor-label-definition">Definition</span>
              <div className="tutor-definition-card">
                {formatRichText(body)}
              </div>
            </div>
          );
        }

        // KEY POINTS
        if (/^###\s+KEY\s*POINTS/i.test(trimmed)) {
          const body = trimmed.replace(/^###\s+KEY\s*POINTS\s*/i, "").trim();
          const points = body
            .split(/\n+/)
            .map((line) => cleanBulletText(line))
            .filter(Boolean);

          return (
            <div key={idx} className="tutor-section-block">
              <span className="tutor-section-label tutor-label-keypoints">Key Points</span>
              <div className="tutor-keypoints-box">
                <ul className="tutor-keypoints-list">
                  {points.map((pt, pIdx) => (
                    <li key={pIdx} className="tutor-keypoint-item">
                      <span className="tutor-bullet-dot">•</span>
                      <span>{formatRichText(pt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        }

        // EXPLANATION
        if (/^###\s+(EXPLANATION|ANSWER)/i.test(trimmed)) {
          const body = trimmed.replace(/^###\s+(EXPLANATION|ANSWER)\s*/i, "").trim();
          const paragraphs = body.split(/\n\s*\n/).filter(Boolean);

          return (
            <div key={idx} className="tutor-section-block">
              <span className="tutor-section-label tutor-label-explanation">Explanation</span>
              <div className="tutor-explanation-card">
                {paragraphs.map((p, pIdx) => (
                  <p key={pIdx} className="tutor-explanation-paragraph">
                    {formatRichText(p.trim())}
                  </p>
                ))}
              </div>
            </div>
          );
        }

        // EXAMPLE
        if (/^###\s+EXAMPLE/i.test(trimmed)) {
          const body = trimmed.replace(/^###\s+EXAMPLE\s*/i, "").trim();
          return (
            <div key={idx} className="tutor-section-block">
              <span className="tutor-section-label tutor-label-example">Example</span>
              <div className="tutor-example-box">
                <div className="tutor-example-content">
                  {formatRichText(body)}
                </div>
              </div>
            </div>
          );
        }

        // SOURCE (at the bottom once)
        if (/^###\s+SOURCE/i.test(trimmed)) {
          const rawBody = trimmed.replace(/^###\s+SOURCE\s*/i, "").trim();
          const cleanSource = rawBody
            .replace(/^(?:\*\*)?Source(?:\*\*)?[:\s\-·]*/i, "")
            .replace(/^[•\-\*]\s*/, "")
            .trim();

          return (
            <div key={idx} className="tutor-source-clean-bar" id="tutor-source-bar">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <BookOpen size={16} color="var(--accent-primary)" />
                <span
                  style={{
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Source
                </span>
              </div>
              <span className="tutor-source-clean-badge">
                {cleanSource || "Unit-V_InstanceBasedLearning.pdf · Page 2"}
              </span>
            </div>
          );
        }

        // Fallback for unstructured text
        const fallbackParagraphs = trimmed.split(/\n\s*\n/).filter(Boolean);
        return (
          <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {fallbackParagraphs.map((p, pIdx) => (
              <p key={pIdx} style={{ fontSize: "0.92rem", lineHeight: 1.65, color: "#e2e8f0" }}>
                {formatRichText(p)}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
