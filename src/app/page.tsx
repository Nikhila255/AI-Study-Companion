import Link from "next/link";
import { Sparkles, ArrowRight, ShieldCheck, Brain, Target, Award } from "lucide-react";
import { getSessionFromCookies } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getSessionFromCookies();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="navbar">
        <div className="container navbar-inner">
          <div className="brand">
            <Sparkles size={22} color="#6366F1" />
            <span>AI Study Companion</span>
          </div>
          <div className="nav-links">
            <Link href="/login" className="btn btn-secondary btn-sm" id="home-login-btn">
              Sign In
            </Link>
            <Link href="/register" className="btn btn-primary btn-sm" id="home-register-btn">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="container page-wrapper" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "80px 24px" }}>
        <span className="badge badge-indigo" style={{ marginBottom: "20px" }}>
          Next-Gen AI Learning Workspace
        </span>

        <h1 style={{ fontSize: "3.2rem", fontWeight: 800, maxWidth: "840px", lineHeight: 1.15, letterSpacing: "-0.03em", marginBottom: "20px" }}>
          Persistent, contextual, and measurable AI study partner.
        </h1>

        <p style={{ fontSize: "1.2rem", color: "var(--text-secondary)", maxWidth: "660px", marginBottom: "36px", lineHeight: 1.6 }}>
          Move beyond isolated chatbots. Connect your study materials, converse with a grounded AI Tutor with exact citations, master concepts with adaptive quizzes, and track continuous growth.
        </p>

        <div style={{ display: "flex", gap: "16px", marginBottom: "64px" }}>
          <Link href="/register" className="btn btn-primary" id="hero-get-started-btn" style={{ padding: "14px 28px", fontSize: "1rem" }}>
            <span>Create Your Learning Space</span>
            <ArrowRight size={18} />
          </Link>
          <Link href="/login" className="btn btn-secondary" id="hero-sign-in-btn" style={{ padding: "14px 24px", fontSize: "1rem" }}>
            Existing Learner
          </Link>
        </div>

        <div className="grid-cards" style={{ width: "100%", maxWidth: "1040px", textAlign: "left" }}>
          <div className="glass-card">
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(99, 102, 241, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px", color: "var(--accent-primary)" }}>
              <ShieldCheck size={22} />
            </div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#fff", marginBottom: "8px" }}>Zero Hallucination Citations</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
              Every Tutor answer cites exact page numbers from your uploaded project materials. When evidence is insufficient, it explicitly communicates uncertainty.
            </p>
          </div>

          <div className="glass-card">
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(6, 182, 212, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px", color: "var(--accent-cyan)" }}>
              <Brain size={22} />
            </div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#fff", marginBottom: "8px" }}>Adaptive Concept Mastery</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
              Quizzes adapt dynamically to your weak areas with MCQ and open-ended semantic grading, continuously estimating concept mastery percentages.
            </p>
          </div>

          <div className="glass-card">
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px", color: "var(--accent-emerald)" }}>
              <Target size={22} />
            </div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#fff", marginBottom: "8px" }}>Strict Data Isolation</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
              Spaces and Projects isolate documents, conversation memories, and mastery records so knowledge never leaks across learners or projects.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
