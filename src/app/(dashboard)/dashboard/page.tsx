"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { FolderPlus, Layers, Target, BookOpen, ArrowRight, Sparkles, Plus } from "lucide-react";
import CreateSpaceModal from "@/components/CreateSpaceModal";

interface SpaceItem {
  id: string;
  name: string;
  description: string | null;
  iconColor: string;
  createdAt: string;
  _count: { projects: number };
  projects: Array<{
    id: string;
    name: string;
    learningGoal: string;
    updatedAt: string;
  }>;
}

export default function DashboardPage() {
  const [spaces, setSpaces] = useState<SpaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchSpaces = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/spaces");
      if (res.ok) {
        const data = await res.json();
        setSpaces(data.spaces || []);
      }
    } catch (err) {
      console.error("Error loading spaces:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpaces();
  }, []);

  const totalProjects = spaces.reduce((acc, s) => acc + (s._count?.projects || 0), 0);

  return (
    <div className="container page-wrapper">
      {/* Top Header */}
      <div className="section-header" style={{ marginBottom: "28px" }}>
        <div>
          <h1 className="page-title" id="dashboard-title">
            <Layers size={28} color="#6366F1" />
            <span>Learning Spaces & Projects</span>
          </h1>
          <p className="page-subtitle">
            Organize broad learning domains into targeted project workspaces.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="btn btn-primary"
          id="btn-open-create-space"
        >
          <FolderPlus size={18} />
          <span>Create Space</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid-stats">
        <div className="stat-card" id="stat-spaces-card">
          <div className="stat-label">Learning Spaces</div>
          <div className="stat-value" id="stat-spaces-count">{spaces.length}</div>
        </div>
        <div className="stat-card" id="stat-projects-card">
          <div className="stat-label">Active Projects</div>
          <div className="stat-value" id="stat-projects-count">{totalProjects}</div>
        </div>
        <div className="stat-card" id="stat-isolation-card">
          <div className="stat-label">Data Isolation</div>
          <div className="stat-value" style={{ color: "var(--accent-emerald)", fontSize: "1.3rem" }}>
            Enforced (Zero Leakage)
          </div>
        </div>
      </div>

      {/* Spaces Listing */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px", color: "var(--text-secondary)" }}>
          Loading your learning spaces...
        </div>
      ) : spaces.length === 0 ? (
        <div className="empty-state" id="empty-spaces-state">
          <Layers className="empty-state-icon" />
          <h2 className="empty-state-title">No Learning Spaces Yet</h2>
          <p className="empty-state-desc">
            A Space represents a broad discipline, certification, or domain. Start by creating your first space to organize your focused projects.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn btn-primary"
            id="empty-create-space-btn"
          >
            <FolderPlus size={16} />
            <span>Create Your First Space</span>
          </button>
        </div>
      ) : (
        <div className="grid-cards" id="spaces-grid">
          {spaces.map((space) => (
            <div
              key={space.id}
              className="glass-card"
              id={`space-card-${space.id}`}
              style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "14px",
                        height: "14px",
                        borderRadius: "4px",
                        backgroundColor: space.iconColor || "#6366F1",
                        boxShadow: `0 0 10px ${space.iconColor || "#6366F1"}`,
                      }}
                    />
                    <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff" }}>
                      {space.name}
                    </h3>
                  </div>

                  <span className="badge badge-indigo">
                    {space._count?.projects || 0} {space._count?.projects === 1 ? "Project" : "Projects"}
                  </span>
                </div>

                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "18px", minHeight: "40px" }}>
                  {space.description || "No description provided."}
                </p>

                {/* Sub-projects preview */}
                {space.projects && space.projects.length > 0 && (
                  <div style={{ marginBottom: "18px" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>
                      Recent Projects
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {space.projects.map((proj) => (
                        <Link
                          key={proj.id}
                          href={`/spaces/${space.id}/projects/${proj.id}`}
                          className="btn btn-secondary btn-sm"
                          style={{ justifyContent: "space-between", textAlign: "left", width: "100%" }}
                          id={`proj-link-${proj.id}`}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {proj.name}
                          </span>
                          <ArrowRight size={14} color="var(--text-muted)" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "14px", marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
                <Link
                  href={`/spaces/${space.id}`}
                  className="btn btn-secondary btn-sm"
                  id={`view-space-btn-${space.id}`}
                >
                  <span>Explore Space & Projects</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <CreateSpaceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchSpaces}
      />
    </div>
  );
}
