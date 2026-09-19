"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, LogOut, Compass, Sparkles } from "lucide-react";

interface NavbarProps {
  user?: {
    fullName: string;
    email: string;
    role: string;
  } | null;
}

export default function Navbar({ user }: NavbarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  return (
    <header className="navbar" id="app-navbar">
      <div className="container navbar-inner">
        <Link href="/dashboard" className="brand" id="nav-brand-link">
          <Sparkles size={22} color="#6366F1" />
          <span>AI Study Companion</span>
        </Link>

        {user ? (
          <nav className="nav-links" id="nav-user-menu">
            <Link href="/dashboard" className="nav-link" id="nav-dashboard-link">
              Spaces & Projects
            </Link>

            {user.role === "ADMIN" && (
              <Link href="/admin" className="nav-link" id="nav-admin-link" style={{ color: "#fbbf24", fontWeight: 600 }}>
                Admin Dashboard
              </Link>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginLeft: "12px" }}>
              <span className="badge badge-indigo" id="nav-user-badge">
                {user.fullName}
              </span>

              <button
                onClick={handleLogout}
                className="btn btn-secondary btn-sm"
                id="btn-logout"
                title="Log out of session"
              >
                <LogOut size={15} />
                <span>Logout</span>
              </button>
            </div>
          </nav>
        ) : (
          <div className="nav-links">
            <Link href="/login" className="btn btn-secondary btn-sm" id="nav-login-btn">
              Sign In
            </Link>
            <Link href="/register" className="btn btn-primary btn-sm" id="nav-register-btn">
              Get Started
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
