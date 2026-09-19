"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Target, Plus, ArrowLeft, ArrowRight, Layers, FileText, Brain, CheckCircle2 } from "lucide-react";
import CreateProjectModal from "@/components/CreateProjectModal";

interface ProjectItem {
  id: string;
  name: string;
  description: string | null;
  learningGoal: string;
  updatedAt: string;
  _count: {
    materials: number;
    concepts: number;
    assessments: number;
  };
}

interface SpaceData {
  id: string;
  name: string;
  description: string | null;
  iconColor: string;
  projects: ProjectItem[];
}

export default function SpaceDetailPage({ params }: { params: { spaceId: string } }) {
  const router = useRouter();
  const [space, setSpace] = useState<SpaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchSpace = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/spaces/${params.spaceId}`);
      if (!res.ok) {
        if (res.status === 404 || res.status === 401) {
          setError("Space not found or access denied.");
        } else {
          setError("Failed to load space details.");
        }
        return;
      }
      const data = await res.json();
      setSpace(data.space);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpace();
  }, [params.spaceId]);

  if (loading) {
    return (
      <div className="container page-wrapper" style={{ textAlign: "center", padding: "64px" }}>
        Loading Space workspace...
      </div>
    );
  }

  if (error || !space) {
    return (
      <div className="container page-wrapper">
        <div className="alert-error" id="space-error-alert">{error || "Space not found"}</div>
        <Link href="/dashboard" className="btn btn-secondary">
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="container page-wrapper">
      {/* Breadcrumbs */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px", fontSize: "0.88rem", color: "var(--text-muted)" }}>
        <Link href="/dashboard" style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
          <ArrowLeft size={14} />
          <span>Spaces</span>
        </Link>
        <span>/</span>
        <span style={{ color: "#fff", fontWeight: 500 }}>{space.name}</span>
      </div>

      {/* Header Banner */}
      <div className="glass-card" style={{ marginBottom: "32px", position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "6px",
            height: "100%",
            backgroundColor: space.iconColor || "#6366F1",
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <h1 className="page-title" id="space-detail-title" style={{ fontSize: "1.8rem" }}>
                {space.name}
              </h1>
              <span className="badge badge-indigo">Space</span>
            </div>
            <p style={{ color: "var(--text-secondary)", maxWidth: "700px", fontSize: "0.95rem" }}>
              {space.description || "No description provided for this space."}
            </p>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn btn-primary"
            id="btn-open-create-project"
          >
            <Plus size={18} />
            <span>Create Project</span>
          </button>
        </div>
      </div>

      {/* Projects Section */}
      <div className="section-header">
        <h2 className="section-title">
          Projects in this Space ({space.projects?.length || 0})
        </h2>
      </div>

      {(!space.projects || space.projects.length === 0) ? (
        <div className="empty-state" id="empty-projects-state">
          <Target className="empty-state-icon" />
          <h3 className="empty-state-title">No Projects in this Space</h3>
          <p className="empty-state-desc">
            A Project represents a focused learning journey with materials, an AI Tutor, quizzes, and mastery tracking.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn btn-primary"
            id="empty-create-project-btn"
          >
            <Plus size={16} />
            <span>Create Your First Project</span>
          </button>
        </div>
      ) : (
        <div className="grid-cards" id="projects-grid">
          {space.projects.map((proj) => (
            <div
              key={proj.id}
              className="glass-card"
              id={`project-card-${proj.id}`}
              style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff" }}>
                    {proj.name}
                  </h3>
                  <span className="badge badge-cyan">Active</span>
                </div>

                <div style={{ background: "rgba(99, 102, 241, 0.08)", border: "1px solid rgba(99, 102, 241, 0.2)", borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: "14px" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#a5b4fc", textTransform: "uppercase", marginBottom: "4px" }}>
                    Learning Goal
                  </div>
                  <div style={{ fontSize: "0.88rem", color: "#f1f5f9" }}>
                    {proj.learningGoal}
                  </div>
                </div>

                {proj.description && (
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginBottom: "16px" }}>
                    {proj.description}
                  </p>
                )}
              </div>

              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "14px", marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
                <Link
                  href={`/spaces/${space.id}/projects/${proj.id}`}
                  className="btn btn-primary btn-sm"
                  id={`open-project-btn-${proj.id}`}
                >
                  <span>Open Project Dashboard</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        spaceId={space.id}
        onSuccess={(newProjectId) => {
          fetchSpace();
          router.push(`/spaces/${space.id}/projects/${newProjectId}`);
        }}
      />
    </div>
  );
}
