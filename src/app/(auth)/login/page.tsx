"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, LogIn, Loader2, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div className="glass-card" style={{ width: "100%", maxWidth: "420px", padding: "36px" }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <Sparkles size={24} color="#6366F1" />
            <span style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff" }}>AI Study Companion</span>
          </div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f8fafc", marginTop: "6px" }}>Welcome Back</h2>
          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            Continue your persistent learning journey
          </p>
        </div>

        {error && <div className="alert-error" id="login-error-alert">{error}</div>}

        <form onSubmit={handleSubmit} id="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="email-input">Email Address</label>
            <div style={{ position: "relative" }}>
              <input
                id="email-input"
                type="email"
                className="form-input"
                placeholder="learner@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password-input">Password</label>
            <div style={{ position: "relative" }}>
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
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            id="login-submit-btn"
            style={{ width: "100%", marginTop: "12px", padding: "12px" }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <LogIn size={16} />
                <span>Sign In to Workspace</span>
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border-subtle)", fontSize: "0.88rem", color: "var(--text-secondary)" }}>
          Don't have an account?{" "}
          <Link href="/register" style={{ color: "var(--accent-primary)", fontWeight: 600 }} id="link-to-register">
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
}
