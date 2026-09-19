"use client";

import React, { useState } from "react";
import Modal from "./ui/Modal";
import { Sparkles, Loader2, Target } from "lucide-react";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  onSuccess: (projectId: string) => void;
}

export default function CreateProjectModal({
  isOpen,
  onClose,
  spaceId,
  onSuccess,
}: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [learningGoal, setLearningGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }
    if (!learningGoal.trim()) {
      setError("Learning goal is required (answers 'What am I learning?')");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/spaces/${spaceId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, learningGoal }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create project");
      }

      setName("");
      setDescription("");
      setLearningGoal("");
      onSuccess(data.project.id);
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Learning Project" id="create-project-modal">
      <form onSubmit={handleSubmit} id="create-project-form">
        {error && <div className="alert-error" id="create-project-error">{error}</div>}

        <div className="form-group">
          <label className="form-label" htmlFor="project-name-input">
            Project Name *
          </label>
          <input
            id="project-name-input"
            type="text"
            className="form-input"
            placeholder="e.g. Raft Consensus & State Machines"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="project-goal-input">
            Learning Goal (What will you master?) *
          </label>
          <textarea
            id="project-goal-input"
            className="form-textarea"
            placeholder="e.g. Master leader election, log replication edge cases, and network partition recovery."
            value={learningGoal}
            onChange={(e) => setLearningGoal(e.target.value)}
            rows={3}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="project-desc-input">
            Description (Optional)
          </label>
          <input
            id="project-desc-input"
            type="text"
            className="form-input"
            placeholder="Brief context or scope"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
          <button type="button" onClick={onClose} className="btn btn-secondary" id="cancel-create-project-btn">
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            id="submit-create-project-btn"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Initializing...</span>
              </>
            ) : (
              <>
                <Target size={16} />
                <span>Create Project</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
