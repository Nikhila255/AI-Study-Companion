"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Shield,
  Users,
  Folder,
  FileText,
  Activity,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Server,
  Loader2,
  ArrowLeft,
  RotateCcw,
} from "lucide-react";

interface AdminOverviewData {
  summary: {
    totalUsers: number;
    totalProjects: number;
    totalMaterials: number;
    totalConcepts: number;
    totalAIRequests: number;
    totalTokens: number;
    totalCostUsd: number;
    avgLatencyMs: number;
    aiSuccessRate: number;
  };
  users: Array<{
    id: string;
    email: string;
    fullName: string;
    role: string;
    createdAt: string;
    _count: {
      spaces: number;
      projects: number;
      attempts: number;
    };
  }>;
  projects: Array<{
    id: string;
    name: string;
    learningGoal: string;
    createdAt: string;
    user: { email: string; fullName: string };
    _count: {
      materials: number;
      concepts: number;
      assessments: number;
    };
  }>;
  materialStatusCounts: {
    QUEUED: number;
    PROCESSING: number;
    READY: number;
    FAILED: number;
  };
  aiLogs: Array<{
    id: string;
    featureArea: string;
    modelName: string;
    totalTokens: number;
    latencyMs: number;
    isSuccess: boolean;
    estimatedCostUsd: number;
    errorMessage?: string;
    createdAt: string;
    userEmail: string;
    projectName: string;
  }>;
  recentEvents: Array<{
    id: string;
    eventType: string;
    userEmail: string;
    projectName: string;
    createdAt: string;
  }>;
  systemHealth: {
    database: string;
    databaseType: string;
    uptimeSeconds: number;
    memoryUsageMb: number;
    nodeVersion: string;
    timestamp: string;
  };
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/overview");

      if (res.status === 403 || res.status === 401) {
        setError("Access denied: You do not have ADMIN privileges. Admin authorization is strictly enforced.");
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to load admin overview metrics.");
      }

      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container page-wrapper flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-sm font-medium">Verifying admin credentials and loading telemetry...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container page-wrapper py-12 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
          <Shield className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white">Administrator Access Restricted</h2>
        <p className="text-sm text-slate-400 leading-relaxed">{error}</p>
        <div className="pt-4">
          <Link href="/dashboard" className="btn btn-secondary inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Learner Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  const { summary, systemHealth } = data;

  return (
    <div className="container page-wrapper space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-white">Platform Administration</h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Admin Role Verified
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Global observability: inspect users, projects, material processing, AI latency, costs, and system health.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAdminData}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Refresh Telemetry</span>
          </button>
          <Link href="/dashboard" className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition">
            Learner Workspace
          </Link>
        </div>
      </div>

      {/* Summary KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Total Users</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">{summary.totalUsers}</div>
          <span className="text-[11px] text-slate-500 block">{summary.totalProjects} active projects</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Materials</span>
            <FileText className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">{summary.totalMaterials}</div>
          <span className="text-[11px] text-slate-500 block">{data.materialStatusCounts.READY} ready, {data.materialStatusCounts.FAILED} failed</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>AI Operations</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">{summary.totalAIRequests}</div>
          <span className="text-[11px] text-emerald-400 font-medium block">
            {summary.aiSuccessRate}% success rate ({summary.avgLatencyMs}ms avg)
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Est. AI Cost</span>
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">${summary.totalCostUsd.toFixed(4)}</div>
          <span className="text-[11px] text-slate-500 block">{summary.totalTokens.toLocaleString()} tokens logged</span>
        </div>
      </div>

      {/* System Health Status Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Server className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">System Infrastructure & Runtime Health</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block">Database Status</span>
            <span className="font-semibold text-emerald-400 flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {systemHealth.database} ({systemHealth.databaseType})
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Node Runtime</span>
            <span className="font-semibold text-white mt-0.5 block">{systemHealth.nodeVersion}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Process Memory</span>
            <span className="font-semibold text-white mt-0.5 block">{systemHealth.memoryUsageMb} MB Heap</span>
          </div>
          <div>
            <span className="text-slate-500 block">Server Uptime</span>
            <span className="font-semibold text-white mt-0.5 block">{Math.floor(systemHealth.uptimeSeconds / 60)} min</span>
          </div>
        </div>
      </div>

      {/* Tables Section: Users & Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span>Registered Users ({data.users.length})</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800">
                  <th className="pb-2 font-medium">User</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium">Projects</th>
                  <th className="pb-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.users.map((u) => (
                  <tr key={u.id} className="text-slate-300">
                    <td className="py-2.5 pr-2">
                      <div className="font-semibold text-white truncate max-w-[140px]">{u.fullName}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[140px]">{u.email}</div>
                    </td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded font-mono text-[10px] ${u.role === "ADMIN" ? "bg-amber-500/20 text-amber-300 font-bold" : "bg-slate-800 text-slate-400"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-300">{u._count.projects}</td>
                    <td className="py-2.5 text-slate-500 text-[11px]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Observability Logs */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Recent AI Operations & Latency</span>
            </h3>
            <span className="text-xs text-slate-500">Live Telemetry</span>
          </div>
          <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800 sticky top-0 bg-slate-900">
                  <th className="pb-2 font-medium">Feature</th>
                  <th className="pb-2 font-medium">Model</th>
                  <th className="pb-2 font-medium">Latency</th>
                  <th className="pb-2 font-medium">Tokens</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.aiLogs.slice(0, 15).map((log) => (
                  <tr key={log.id} className="text-slate-300">
                    <td className="py-2 pr-2 font-mono text-[11px] text-indigo-300">
                      {log.featureArea}
                    </td>
                    <td className="py-2 text-[11px] text-slate-400">{log.modelName}</td>
                    <td className="py-2 text-[11px] font-semibold text-white">{log.latencyMs}ms</td>
                    <td className="py-2 text-[11px] text-slate-400">{log.totalTokens}</td>
                    <td className="py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${log.isSuccess ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                        {log.isSuccess ? "OK" : "ERR"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
