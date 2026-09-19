"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, UserPlus, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      // Automatically logged in and cookie set
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to register");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div className="glass-card" style={{ width: "100%", maxWidth: "440px", padding: "36px" }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <Sparkles size={24} color="#6366F1" />
            <span style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff" }}>AI Study Companion</span>
          </div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f8fafc", marginTop: "6px" }}>Create Your Account</h2>
          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            Start your personalized, persistent learning workspace
          </p>
        </div>

        {error && <div className="alert-error" id="register-error-alert">{error}</div>}

        <form onSubmit={handleSubmit} id="register-form">
          <div className="form-group">
            <label className="form-label" htmlFor="name-input">Full Name *</label>
            <input
              id="name-input"
              type="text"
              className="form-input"
              placeholder="e.g. Nikhila Rao"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email-input">Email Address *</label>
            <input
              id="email-input"
              type="email"
              className="form-input"
              placeholder="learner@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password-input">Password (min 6 characters) *</label>
            <input
              id="password-input"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            id="register-submit-btn"
            style={{ width: "100%", marginTop: "12px", padding: "12px" }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Creating Workspace...</span>
              </>
            ) : (
              <>
                <UserPlus size={16} />
                <span>Get Started Now</span>
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border-subtle)", fontSize: "0.88rem", color: "var(--text-secondary)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--accent-primary)", fontWeight: 600 }} id="link-to-login">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
