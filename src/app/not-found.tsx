import Link from "next/link";
import { ArrowLeft, HelpCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        className="glass-card"
        style={{
          maxWidth: "480px",
          width: "100%",
          textAlign: "center",
          padding: "48px 32px",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "16px",
            background: "rgba(99, 102, 241, 0.15)",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--accent-primary)",
            margin: "0 auto 20px",
          }}
        >
          <HelpCircle size={28} />
        </div>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            color: "#fff",
            marginBottom: "8px",
          }}
        >
          404 - Page Not Found
        </h1>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "0.95rem",
            lineHeight: 1.6,
            marginBottom: "28px",
          }}
        >
          The page or resource you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="btn btn-primary"
          style={{ display: "inline-flex", margin: "0 auto" }}
        >
          <ArrowLeft size={16} />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
