"use client";

import React, { useState } from "react";
import Modal from "./ui/Modal";
import { FolderPlus, Loader2 } from "lucide-react";

interface CreateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const COLOR_OPTIONS = [
  "#6366F1", // Indigo
  "#06B6D4", // Cyan
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#8B5CF6", // Purple
];

export default function CreateSpaceModal({ isOpen, onClose, onSuccess }: CreateSpaceModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [iconColor, setIconColor] = useState(COLOR_OPTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Space name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, iconColor }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create space");
      }

      setName("");
      setDescription("");
      setIconColor(COLOR_OPTIONS[0]);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Learning Space" id="create-space-modal">
      <form onSubmit={handleSubmit} id="create-space-form">
        {error && <div className="alert-error" id="create-space-error">{error}</div>}

        <div className="form-group">
          <label className="form-label" htmlFor="space-name-input">
            Space Name *
          </label>
          <input
            id="space-name-input"
            type="text"
            className="form-input"
            placeholder="e.g. Distributed Systems & AI"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="space-desc-input">
            Description
          </label>
          <textarea
            id="space-desc-input"
            className="form-textarea"
            placeholder="What broad domain or certification does this space cover?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Theme Accent</label>
          <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setIconColor(c)}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: c,
                  border: iconColor === c ? "3px solid #fff" : "2px solid transparent",
                  cursor: "pointer",
                  boxShadow: iconColor === c ? `0 0 12px ${c}` : "none",
                  transition: "var(--transition)",
                }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
          <button type="button" onClick={onClose} className="btn btn-secondary" id="cancel-create-space-btn">
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            id="submit-create-space-btn"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <FolderPlus size={16} />
                <span>Create Space</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
