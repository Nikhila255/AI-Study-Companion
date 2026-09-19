"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import MaterialsSection from "@/components/MaterialsSection";
import TutorSection from "@/components/TutorSection";
import QuizSection from "@/components/QuizSection";
import AssessmentSection from "@/components/AssessmentSection";
import MasterySection from "@/components/MasterySection";
import RecommendationsSection from "@/components/RecommendationsSection";
import AnalyticsSection from "@/components/AnalyticsSection";
import {
  Target,
  ArrowLeft,
  FileText,
  MessageSquare,
  Award,
  TrendingUp,
  BarChart3,
  Sparkles,
  Upload,
  Play,
  CheckCircle2,
  Clock,
  Brain,
  ShieldCheck,
  Lightbulb,
} from "lucide-react";

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  learningGoal: string;
  space: {
    id: string;
    name: string;
    iconColor: string;
  };
  counts: {
    materials: number;
    concepts: number;
    recommendations: number;
  };
  averageMastery: number;
  materials: Array<any>;
  concepts: Array<any>;
  masteryRecords: Array<any>;
  recommendations: Array<any>;
  recentEvents: Array<{
    id: string;
    eventType: string;
    payload: any;
    createdAt: string;
  }>;
}

type TabType =
  | "overview"
  | "materials"
  | "tutor"
  | "quiz"
  | "assessment"
  | "growth"
  | "recommendations"
  | "analytics";

export default function ProjectDashboardPage({
  params,
}: {
  params: { spaceId: string; projectId: string };
}) {
  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | undefined>(undefined);

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`/api/projects/${params.projectId}/dashboard`);
      if (!res.ok) {
        if (res.status === 404 || res.status === 401) {
          setError("Project not found or unauthorized. Project-level isolation is enforced.");
        } else {
          setError("Failed to load project dashboard.");
        }
        return;
      }
      const json = await res.json();
      const proj = json.project;
      setData(proj);

      // Auto-select active study document based on user selection or current ready materials
      if (proj.materials && proj.materials.length > 0) {
        const readyMats = proj.materials.filter((m: any) => m.status === "READY");
        if (readyMats.length > 0) {
          setSelectedMaterialId((prev) => {
            if (prev && readyMats.some((m: any) => m.id === prev)) {
              return prev;
            }
            return readyMats[0].id;
          });
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [params.projectId]);

  if (loading) {
    return (
      <div className="container page-wrapper" style={{ textAlign: "center", padding: "64px" }}>
        Loading Project Workspace...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container page-wrapper">
        <div className="alert-error" id="project-error-alert">
          {error || "Project not found"}
        </div>
        <Link href={`/spaces/${params.spaceId}`} className="btn btn-secondary">
          <ArrowLeft size={16} />
          <span>Back to Space</span>
        </Link>
      </div>
    );
  }

  const readyMaterials = data.materials ? data.materials.filter((m: any) => m.status === "READY") : [];
  const selectedMaterial =
    readyMaterials.find((m: any) => m.id === selectedMaterialId) ||
    readyMaterials[0];

  return (
    <div className="container page-wrapper">
      {/* Navigation Breadcrumb */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "20px",
          fontSize: "0.88rem",
          color: "var(--text-muted)",
        }}
      >
        <Link href="/dashboard" style={{ color: "var(--text-secondary)" }}>
          Spaces
        </Link>
        <span>/</span>
        <Link href={`/spaces/${data.space.id}`} style={{ color: "var(--text-secondary)" }}>
          {data.space.name}
        </Link>
        <span>/</span>
        <span style={{ color: "#fff", fontWeight: 500 }}>{data.name}</span>
      </div>

      {/* Hero Workspace Header */}
      <div
        className="glass-card"
        style={{
          marginBottom: "20px",
          borderLeft: `4px solid ${data.space.iconColor || "#6366F1"}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <h1 className="page-title" id="project-dashboard-title" style={{ fontSize: "1.85rem" }}>
                {data.name}
              </h1>
              <span className="badge badge-emerald">Active Learning</span>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(99, 102, 241, 0.12)",
                border: "1px solid rgba(99, 102, 241, 0.25)",
                padding: "6px 12px",
                borderRadius: "var(--radius-sm)",
                marginTop: "4px",
              }}
            >
              <Target size={16} color="#818cf8" />
              <span style={{ fontSize: "0.88rem", color: "#e0e7ff", fontWeight: 500 }}>
                Goal: {data.learningGoal}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <span className="badge badge-indigo" style={{ padding: "8px 14px", fontSize: "0.85rem" }}>
              <ShieldCheck size={15} />
              <span>Project Isolated</span>
            </span>
          </div>
        </div>
      </div>

      {/* Active Study Document Indicator & Selector */}
      {selectedMaterial && (
        <div
          className="glass-card"
          style={{
            padding: "12px 20px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            background: "rgba(15, 23, 42, 0.7)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <FileText size={18} color="#818cf8" />
            <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Active Study Document:
            </span>
            <span style={{ fontSize: "0.92rem", fontWeight: 700, color: "#fff" }}>
              {selectedMaterial.fileName}
            </span>
            <span className="badge badge-emerald" style={{ fontSize: "0.72rem", padding: "2px 8px" }}>
              {selectedMaterial.totalPages} Pages · Ready
            </span>
          </div>

          {readyMaterials.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Switch Document:</span>
              <select
                value={selectedMaterial.id}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
                style={{
                  fontSize: "0.82rem",
                  padding: "6px 12px",
                  background: "rgba(30, 41, 59, 0.9)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "6px",
                  color: "#fff",
                  outline: "none",
                }}
              >
                {readyMaterials.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.fileName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Tabs Navigation */}
      <nav className="tabs-nav" id="project-tabs-navigation" aria-label="Project Workspace Navigation">
        <button
          onClick={() => setActiveTab("overview")}
          className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
          id="tab-btn-overview"
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("materials")}
          className={`tab-btn ${activeTab === "materials" ? "active" : ""}`}
          id="tab-btn-materials"
        >
          Materials ({data.counts.materials})
        </button>
        <button
          onClick={() => setActiveTab("tutor")}
          className={`tab-btn ${activeTab === "tutor" ? "active" : ""}`}
          id="tab-btn-tutor"
        >
          AI Tutor
        </button>
        <button
          onClick={() => setActiveTab("quiz")}
          className={`tab-btn ${activeTab === "quiz" ? "active" : ""}`}
          id="tab-btn-quiz"
        >
          Adaptive Quiz
        </button>
        <button
          onClick={() => setActiveTab("assessment")}
          className={`tab-btn ${activeTab === "assessment" ? "active" : ""}`}
          id="tab-btn-assessment"
        >
          Open-Ended Assessment
        </button>
        <button
          onClick={() => setActiveTab("growth")}
          className={`tab-btn ${activeTab === "growth" ? "active" : ""}`}
          id="tab-btn-growth"
        >
          Mastery & Growth
        </button>
        <button
          onClick={() => setActiveTab("recommendations")}
          className={`tab-btn ${activeTab === "recommendations" ? "active" : ""}`}
          id="tab-btn-recommendations"
        >
          Recommendations
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`tab-btn ${activeTab === "analytics" ? "active" : ""}`}
          id="tab-btn-analytics"
        >
          Analytics
        </button>
      </nav>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div id="tab-content-overview">
          {/* Top Stat Row */}
          <div className="grid-stats">
            <div className="stat-card" id="card-avg-mastery">
              <div className="stat-label">Estimated Mastery</div>
              <div
                className="stat-value"
                style={{
                  color: data.averageMastery > 0 ? "var(--accent-emerald)" : "var(--text-muted)",
                }}
              >
                {data.averageMastery}%
              </div>
            </div>

            <div className="stat-card" id="card-learning-materials">
              <div className="stat-label">Learning Materials</div>
              <div className="stat-value">{data.counts.materials}</div>
            </div>

            <div className="stat-card" id="card-key-concepts">
              <div className="stat-label">Mapped Concepts</div>
              <div className="stat-value">{data.counts.concepts}</div>
            </div>

            <div className="stat-card" id="card-next-actions">
              <div className="stat-label">Next Action</div>
              <div
                className="stat-value"
                style={{
                  fontSize: "1rem",
                  color: "var(--accent-cyan)",
                  fontWeight: 600,
                  marginTop: "10px",
                }}
              >
                {data.counts.materials === 0 ? "Upload Learning PDF" : "Start Session with Tutor"}
              </div>
            </div>
          </div>

          {/* Core Learning Loop Quick Actions */}
          <div className="section-header" style={{ marginTop: "32px" }}>
            <h2 className="section-title">Primary Learning Loop</h2>
          </div>

          <div className="grid-cards" style={{ marginBottom: "36px" }}>
            <div
              className="glass-card glass-card-interactive"
              onClick={() => setActiveTab("materials")}
              id="action-upload-material"
            >
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: "rgba(99, 102, 241, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent-primary)",
                  marginBottom: "14px",
                }}
              >
                <Upload size={20} />
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#fff", marginBottom: "6px" }}>
                1. Add Learning Material
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
                Upload PDFs to extract knowledge, chunk concepts, and create vector embeddings.
              </p>
            </div>

            <div
              className="glass-card glass-card-interactive"
              onClick={() => setActiveTab("tutor")}
              id="action-launch-tutor"
            >
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: "rgba(6, 182, 212, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent-cyan)",
                  marginBottom: "14px",
                }}
              >
                <MessageSquare size={20} />
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#fff", marginBottom: "6px" }}>
                2. Learn with AI Tutor
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
                Ask questions grounded strictly in project materials with page-level citations.
              </p>
            </div>

            <div
              className="glass-card glass-card-interactive"
              onClick={() => setActiveTab("quiz")}
              id="action-take-quiz"
            >
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: "rgba(16, 185, 129, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent-emerald)",
                  marginBottom: "14px",
                }}
              >
                <Play size={20} />
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#fff", marginBottom: "6px" }}>
                3. Adaptive Quiz
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
                Practice with targeted MCQs that adapt to your mastery and update concept graphs.
              </p>
            </div>

            <div
              className="glass-card glass-card-interactive"
              onClick={() => setActiveTab("assessment")}
              id="action-take-assessment"
            >
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: "rgba(168, 85, 247, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#c084fc",
                  marginBottom: "14px",
                }}
              >
                <Brain size={20} />
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#fff", marginBottom: "6px" }}>
                4. Open-Ended Assessment
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
                Explain concepts in your own words and receive rich pedagogical rubric feedback.
              </p>
            </div>
          </div>

          {/* Recent Events / Activity */}
          <div className="section-header">
            <h2 className="section-title">Recent Project Activity</h2>
          </div>

          {data.recentEvents.length === 0 ? (
            <div
              className="glass-card"
              style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary)" }}
            >
              No recent activity recorded yet. Upload a PDF or interact with the AI Tutor to generate learning events.
            </div>
          ) : (
            <div className="glass-card" style={{ padding: "16px 24px" }}>
              {data.recentEvents.map((evt) => (
                <div
                  key={evt.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 0",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <CheckCircle2 size={16} color="var(--accent-emerald)" />
                    <span style={{ fontWeight: 600, color: "#f8fafc", fontSize: "0.9rem" }}>
                      {evt.eventType.replace(/_/g, " ")}
                    </span>
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {new Date(evt.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Materials */}
      {activeTab === "materials" && (
        <div id="tab-content-materials">
          <div className="section-header" style={{ marginBottom: "20px" }}>
            <div>
              <h2 className="section-title">Project Materials & Knowledge Base</h2>
              <p className="page-subtitle">
                Upload PDFs to build the grounded evidence base for your AI Tutor with page-level citations.
              </p>
            </div>
          </div>
          <MaterialsSection projectId={params.projectId} />
        </div>
      )}

      {/* Tab: Tutor */}
      {activeTab === "tutor" && (
        <div id="tab-content-tutor">
          <div className="section-header" style={{ marginBottom: "20px" }}>
            <div>
              <h2 className="section-title">Context-Aware AI Tutor</h2>
              <p className="page-subtitle">
                Grounded educational tutor with verifiable page citations from your active study material.
              </p>
            </div>
          </div>
          <TutorSection
            projectId={params.projectId}
            learningGoal={data.learningGoal}
            materialId={selectedMaterial?.id}
            materialName={selectedMaterial?.fileName}
          />
        </div>
      )}

      {/* Tab: Quiz */}
      {activeTab === "quiz" && (
        <div id="tab-content-quiz">
          <div className="section-header" style={{ marginBottom: "20px" }}>
            <div>
              <h2 className="section-title">Adaptive Quiz Practice</h2>
              <p className="page-subtitle">
                Practice concepts dynamically extracted from your current study material.
              </p>
            </div>
          </div>
          <QuizSection
            projectId={params.projectId}
            materialId={selectedMaterial?.id}
            materialName={selectedMaterial?.fileName}
            onMasteryUpdated={fetchDashboard}
          />
        </div>
      )}

      {/* Tab: Open-Ended Assessment */}
      {activeTab === "assessment" && (
        <div id="tab-content-assessment">
          <div className="section-header" style={{ marginBottom: "20px" }}>
            <div>
              <h2 className="section-title">Open-Ended Conceptual Assessment</h2>
              <p className="page-subtitle">
                Demonstrate conceptual mastery in your own words with structured AI rubric feedback.
              </p>
            </div>
          </div>
          <AssessmentSection
            projectId={params.projectId}
            materialId={selectedMaterial?.id}
            materialName={selectedMaterial?.fileName}
            onMasteryUpdated={fetchDashboard}
          />
        </div>
      )}

      {/* Tab: Growth */}
      {activeTab === "growth" && (
        <div id="tab-content-growth">
          <MasterySection
            projectId={params.projectId}
            materialId={selectedMaterial?.id}
            materialName={selectedMaterial?.fileName}
            onNavigateTab={(tab) => setActiveTab(tab as TabType)}
          />
        </div>
      )}

      {/* Tab: Recommendations */}
      {activeTab === "recommendations" && (
        <div id="tab-content-recommendations">
          <RecommendationsSection
            projectId={params.projectId}
            materialId={selectedMaterial?.id}
            materialName={selectedMaterial?.fileName}
            onNavigateTab={(tab) => setActiveTab(tab as TabType)}
          />
        </div>
      )}

      {/* Tab: Analytics */}
      {activeTab === "analytics" && (
        <div id="tab-content-analytics">
          <AnalyticsSection
            projectId={params.projectId}
            materialId={selectedMaterial?.id}
            materialName={selectedMaterial?.fileName}
            onNavigateTab={(tab) => setActiveTab(tab as TabType)}
          />
        </div>
      )}
    </div>
  );
}
