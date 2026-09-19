"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Brain,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Loader2,
  FileText,
  ChevronRight,
  ArrowUpDown,
  X,
  MessageCircle,
  ClipboardCheck,
  Minus,
  Check,
} from "lucide-react";

export interface RecentAttemptSummary {
  id: string;
  isCorrect: boolean;
  semanticScore?: number | null;
  attemptedAt: string;
  questionText: string;
  questionType: string;
}

export interface ConceptSummary {
  conceptId: string;
  conceptName: string;
  masteryScore: number;
  trajectory: "IMPROVING" | "STABLE" | "REQUIRING_ATTENTION";
  totalAttempts: number;
  successfulAttempts: number;
  status: "Strong" | "Developing" | "Needs Practice" | "Not Practiced Yet";
  previousScore?: number;
  lastEvaluatedAt: string;
  recentAttempts?: RecentAttemptSummary[];
}

export interface GrowthAnalysis {
  improving: ConceptSummary[];
  stable: ConceptSummary[];
  requiringAttention: ConceptSummary[];
  notPracticedYet: ConceptSummary[];
  practiced: ConceptSummary[];
  overallMastery: number;
  summaryText: string;
  strongCount: number;
  developingCount: number;
  needsPracticeCount: number;
  totalPracticed: number;
}

interface MasterySectionProps {
  projectId: string;
  materialId?: string;
  materialName?: string;
  onNavigateTab?: (tab: string, prompt?: string) => void;
}

type StatusFilter = "ALL" | "Strong" | "Developing" | "Needs Practice";
type SortOption = "MASTERY_DESC" | "MASTERY_ASC" | "RECENT" | "NAME";

export default function MasterySection({
  projectId,
  materialId,
  materialName,
  onNavigateTab,
}: MasterySectionProps) {
  const [data, setData] = useState<GrowthAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("MASTERY_DESC");
  const [selectedConcept, setSelectedConcept] = useState<ConceptSummary | null>(null);
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    fetchMastery();
  }, [projectId, materialId]);

  useEffect(() => {
    if (!loading && data) {
      const timer = setTimeout(() => setIsAnimated(true), 60);
      return () => clearTimeout(timer);
    }
  }, [loading, data]);

  const fetchMastery = async () => {
    try {
      setLoading(true);
      setIsAnimated(false);
      const url = materialId
        ? `/api/projects/${projectId}/mastery?materialId=${materialId}`
        : `/api/projects/${projectId}/mastery`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load mastery data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    try {
      setRefreshing(true);
      const res = await fetch(`/api/projects/${projectId}/mastery`, { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Recalculation error:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const practiced = data?.practiced || [];

  // Filtered & Sorted Concept List
  const displayConcepts = useMemo(() => {
    let list = [...practiced];

    // Status filter
    if (activeFilter !== "ALL") {
      list = list.filter((c) => c.status === activeFilter);
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === "MASTERY_DESC") return b.masteryScore - a.masteryScore;
      if (sortBy === "MASTERY_ASC") return a.masteryScore - b.masteryScore;
      if (sortBy === "NAME") return a.conceptName.localeCompare(b.conceptName);
      if (sortBy === "RECENT") {
        return new Date(b.lastEvaluatedAt).getTime() - new Date(a.lastEvaluatedAt).getTime();
      }
      return 0;
    });

    return list;
  }, [practiced, activeFilter, sortBy]);

  if (loading) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" aria-hidden="true" focusable="false" />
        <span className="text-sm font-medium">Loading concept mastery & learning progress...</span>
      </div>
    );
  }

  const strongCount = data?.strongCount ?? practiced.filter((c) => c.status === "Strong").length;
  const developingCount =
    data?.developingCount ?? practiced.filter((c) => c.status === "Developing").length;
  const needsPracticeCount =
    data?.needsPracticeCount ?? practiced.filter((c) => c.status === "Needs Practice").length;

  const overallMasteryScore = data?.overallMastery ?? 0;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ================= 1. PAGE HEADER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Brain className="w-5 h-5" aria-hidden="true" focusable="false" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Mastery & Growth</h2>
          </div>
          <p className="text-xs text-slate-400 pl-10">
            Track how your understanding changes across concepts in this study project.
          </p>
          {materialName && (
            <div className="pl-10 pt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] font-medium text-indigo-300">
                <FileText className="w-3 h-3 text-indigo-400 shrink-0" aria-hidden="true" focusable="false" />
                <span className="truncate max-w-xs">{materialName}</span>
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={handleRecalculate}
            disabled={refreshing}
            aria-label="Recalculate and refresh mastery scores"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700/70 text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" focusable="false" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {practiced.length === 0 ? (
        /* ================= EMPTY STATE ================= */
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 flex flex-col items-center">
          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-3 text-indigo-400">
            <Brain className="w-8 h-8" aria-hidden="true" focusable="false" />
          </div>
          <h4 className="text-base font-bold text-white mb-1">No mastery data yet</h4>
          <p className="text-xs text-slate-400 max-w-sm mb-5 leading-relaxed">
            Practice a quiz or assessment to evaluate your knowledge and build your mastery profile.
          </p>
          <button
            onClick={() => onNavigateTab && onNavigateTab("quiz")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition cursor-pointer shadow-lg shadow-indigo-600/20"
          >
            <ClipboardCheck className="w-4 h-4" aria-hidden="true" focusable="false" />
            <span>Start Practice Quiz</span>
          </button>
        </div>
      ) : (
        <>
          {/* ================= 2. OVERALL MASTERY & 3. STATUS SNAPSHOT ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Overall Mastery Hero Card */}
            <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Overall Mastery
                  </span>
                  <span className="text-[11px] text-indigo-400 font-semibold">
                    {practiced.length} {practiced.length === 1 ? "concept" : "concepts"} practiced
                  </span>
                </div>

                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-4xl font-extrabold text-white tracking-tight">
                    {overallMasteryScore}%
                  </span>
                  <span className="text-xs text-slate-400">Average understanding</span>
                </div>

                {/* Linear Animated Progress Bar */}
                <div className="w-full bg-slate-800/90 h-3 rounded-full overflow-hidden mb-2">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: isAnimated
                        ? `${Math.min(100, Math.max(0, overallMasteryScore))}%`
                        : "0%",
                    }}
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed mt-2 pt-2 border-t border-slate-800/60">
                Computed from your multiple-choice and open-ended performance across this material.
              </p>
            </div>

            {/* Mastery Snapshot: 3 Status Summary Cards */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Strong */}
              <div
                onClick={() => setActiveFilter(activeFilter === "Strong" ? "ALL" : "Strong")}
                className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                  activeFilter === "Strong"
                    ? "bg-emerald-950/30 border-emerald-500/50 ring-1 ring-emerald-500/40"
                    : "bg-slate-900/70 border-slate-800/80 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" focusable="false" />
                    <span className="text-xs font-bold uppercase tracking-wider">Strong</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold">≥75%</span>
                </div>
                <div className="text-2xl font-black text-white">{strongCount}</div>
                <span className="text-[11px] text-slate-400 mt-1">
                  {strongCount === 1 ? "1 concept solid" : `${strongCount} concepts solid`}
                </span>
              </div>

              {/* Developing */}
              <div
                onClick={() =>
                  setActiveFilter(activeFilter === "Developing" ? "ALL" : "Developing")
                }
                className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                  activeFilter === "Developing"
                    ? "bg-amber-950/30 border-amber-500/50 ring-1 ring-amber-500/40"
                    : "bg-slate-900/70 border-slate-800/80 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-amber-400">
                    <TrendingUp className="w-4 h-4" aria-hidden="true" focusable="false" />
                    <span className="text-xs font-bold uppercase tracking-wider">Developing</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold">50–74%</span>
                </div>
                <div className="text-2xl font-black text-white">{developingCount}</div>
                <span className="text-[11px] text-slate-400 mt-1">
                  {developingCount === 1 ? "1 in progress" : `${developingCount} in progress`}
                </span>
              </div>

              {/* Needs Practice */}
              <div
                onClick={() =>
                  setActiveFilter(activeFilter === "Needs Practice" ? "ALL" : "Needs Practice")
                }
                className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                  activeFilter === "Needs Practice"
                    ? "bg-rose-950/30 border-rose-500/50 ring-1 ring-rose-500/40"
                    : "bg-slate-900/70 border-slate-800/80 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-rose-400">
                    <AlertCircle className="w-4 h-4" aria-hidden="true" focusable="false" />
                    <span className="text-xs font-bold uppercase tracking-wider">Needs Practice</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold">&lt;50%</span>
                </div>
                <div className="text-2xl font-black text-white">{needsPracticeCount}</div>
                <span className="text-[11px] text-slate-400 mt-1">
                  {needsPracticeCount === 1 ? "1 requires review" : `${needsPracticeCount} require review`}
                </span>
              </div>
            </div>
          </div>

          {/* ================= 4. CONCEPT PERFORMANCE LIST ================= */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4">
            {/* Header with Segmented Filters and Sort */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Concept Performance
                </h3>
                <p className="text-xs text-slate-400">
                  Individual concept mastery, accuracy, and trajectory.
                </p>
              </div>

              <div className="flex items-center flex-wrap gap-2">
                {/* Segmented Filter Pills */}
                <div className="inline-flex p-1 rounded-lg bg-slate-950/80 border border-slate-800 text-xs">
                  <button
                    onClick={() => setActiveFilter("ALL")}
                    className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      activeFilter === "ALL"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    All ({practiced.length})
                  </button>
                  <button
                    onClick={() => setActiveFilter("Strong")}
                    className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      activeFilter === "Strong"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Strong ({strongCount})
                  </button>
                  <button
                    onClick={() => setActiveFilter("Developing")}
                    className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      activeFilter === "Developing"
                        ? "bg-amber-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Developing ({developingCount})
                  </button>
                  <button
                    onClick={() => setActiveFilter("Needs Practice")}
                    className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      activeFilter === "Needs Practice"
                        ? "bg-rose-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Needs Practice ({needsPracticeCount})
                  </button>
                </div>

                {/* Sort Dropdown */}
                <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" focusable="false" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    aria-label="Sort concept list"
                    className="bg-transparent text-slate-200 border-none outline-none text-xs cursor-pointer font-medium"
                  >
                    <option value="MASTERY_DESC" className="bg-slate-900 text-slate-200">
                      Mastery: High → Low
                    </option>
                    <option value="MASTERY_ASC" className="bg-slate-900 text-slate-200">
                      Mastery: Low → High
                    </option>
                    <option value="RECENT" className="bg-slate-900 text-slate-200">
                      Recently Practiced
                    </option>
                    <option value="NAME" className="bg-slate-900 text-slate-200">
                      Concept Name
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* Concept Rows (Compact, elevated, non-concatenated layout) */}
            {displayConcepts.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs italic">
                No concepts found in this filter category.
              </div>
            ) : (
              <div className="space-y-2.5">
                {displayConcepts.map((c) => {
                  const isStrong = c.status === "Strong";
                  const isDev = c.status === "Developing";
                  const pct = Math.min(100, Math.max(0, Math.round(c.masteryScore)));

                  const statusBadgeColor = isStrong
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : isDev
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/30";

                  const barFillColor = isStrong
                    ? "bg-emerald-500"
                    : isDev
                    ? "bg-amber-500"
                    : "bg-rose-500";

                  const trajectoryLabel =
                    c.trajectory === "IMPROVING"
                      ? "Improving"
                      : c.trajectory === "REQUIRING_ATTENTION"
                      ? "Needs Attention"
                      : "Stable";

                  const trajectoryBadge =
                    c.trajectory === "IMPROVING"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : c.trajectory === "REQUIRING_ATTENTION"
                      ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      : "bg-blue-500/10 text-blue-400 border-blue-500/20";

                  return (
                    <div
                      key={c.conceptId}
                      onClick={() => setSelectedConcept(c)}
                      className="p-3.5 rounded-xl bg-slate-950/50 hover:bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition cursor-pointer group"
                      title="Click to view detailed learning history"
                    >
                      {/* Line 1: Concept Name & Status Badge */}
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isStrong ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" focusable="false" />
                          ) : isDev ? (
                            <TrendingUp className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" focusable="false" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" focusable="false" />
                          )}
                          <span className="font-semibold text-white text-sm truncate">
                            {c.conceptName}
                          </span>
                        </div>

                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded border ${statusBadgeColor} shrink-0`}
                        >
                          {c.status}
                        </span>
                      </div>

                      {/* Line 2: Mastery Label & Accurate Progress Bar */}
                      <div className="space-y-1 mb-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-medium">Mastery</span>
                          <span className="font-bold text-slate-200">{pct}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${barFillColor} rounded-full transition-all duration-700 ease-out`}
                            style={{ width: isAnimated ? `${pct}%` : "0%" }}
                          />
                        </div>
                      </div>

                      {/* Line 3: Accuracy, Trajectory Badge, and View Details link */}
                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800/60">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">
                            Accuracy:{" "}
                            <strong className="text-slate-200 font-semibold">
                              {c.successfulAttempts} / {c.totalAttempts}
                            </strong>
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${trajectoryBadge}`}
                          >
                            {trajectoryLabel}
                          </span>
                        </div>

                        <div className="inline-flex items-center gap-1 text-indigo-400 group-hover:text-indigo-300 font-semibold text-xs">
                          <span>View Details</span>
                          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" focusable="false" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ================= 5. GROWTH SECTION ================= */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4">
            <div className="pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2 text-indigo-400">
                <TrendingUp className="w-4 h-4" aria-hidden="true" focusable="false" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Growth</h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Understanding your recent concept trajectory based on validated practice history.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Improving Track */}
              <div className="p-3.5 rounded-xl bg-slate-950/40 border border-emerald-500/20">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                  <TrendingUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" focusable="false" />
                  <span>Improving</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2.5">
                  Concepts demonstrating positive score gains.
                </p>

                {data?.improving && data.improving.length > 0 ? (
                  <ul className="space-y-1.5">
                    {data.improving.map((c) => (
                      <li
                        key={c.conceptId}
                        onClick={() => setSelectedConcept(c)}
                        className="text-xs text-slate-200 flex items-center justify-between p-2 rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 cursor-pointer transition"
                      >
                        <span className="truncate font-medium">{c.conceptName}</span>
                        <span className="font-bold text-emerald-400 shrink-0 ml-2">
                          {c.masteryScore}%
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 italic py-1">
                    No historical trend available yet.
                  </p>
                )}
              </div>

              {/* Stable Track */}
              <div className="p-3.5 rounded-xl bg-slate-950/40 border border-blue-500/20">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">
                  <Minus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" focusable="false" />
                  <span>Stable</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2.5">
                  Concepts with consistent evaluation results.
                </p>

                {data?.stable && data.stable.length > 0 ? (
                  <ul className="space-y-1.5">
                    {data.stable.map((c) => (
                      <li
                        key={c.conceptId}
                        onClick={() => setSelectedConcept(c)}
                        className="text-xs text-slate-200 flex items-center justify-between p-2 rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 cursor-pointer transition"
                      >
                        <span className="truncate font-medium">{c.conceptName}</span>
                        <span className="font-bold text-blue-400 shrink-0 ml-2">
                          {c.masteryScore}%
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 italic py-1">
                    No stable concepts recorded yet.
                  </p>
                )}
              </div>

              {/* Needs Practice Track */}
              <div className="p-3.5 rounded-xl bg-slate-950/40 border border-rose-500/20">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400 uppercase tracking-wider mb-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" focusable="false" />
                  <span>Needs Practice</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2.5">
                  Concepts requiring focused review to advance.
                </p>

                {data?.requiringAttention && data.requiringAttention.length > 0 ? (
                  <ul className="space-y-1.5">
                    {data.requiringAttention.map((c) => (
                      <li
                        key={c.conceptId}
                        onClick={() => setSelectedConcept(c)}
                        className="text-xs text-slate-200 flex items-center justify-between p-2 rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 cursor-pointer transition"
                      >
                        <span className="truncate font-medium">{c.conceptName}</span>
                        <span className="font-bold text-rose-400 shrink-0 ml-2">
                          {c.masteryScore}%
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 italic py-1">
                    None requiring attention right now.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ================= CONCEPT DETAIL DRILL-DOWN MODAL ================= */}
      {selectedConcept && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5 animate-fadeIn">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-indigo-400 shrink-0" aria-hidden="true" focusable="false" />
                  <h3 className="text-lg font-bold text-white">{selectedConcept.conceptName}</h3>
                </div>
                <span
                  className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded border ${
                    selectedConcept.status === "Strong"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : selectedConcept.status === "Developing"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  }`}
                >
                  {selectedConcept.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedConcept(null)}
                aria-label="Close concept drill-down modal"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" focusable="false" />
              </button>
            </div>

            {/* Metrics Strip */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  Current Mastery
                </span>
                <span className="text-xl font-black text-indigo-400 block mt-0.5">
                  {Math.round(selectedConcept.masteryScore)}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  Accuracy
                </span>
                <span className="text-xl font-black text-white block mt-0.5">
                  {selectedConcept.successfulAttempts} / {selectedConcept.totalAttempts}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  Trajectory
                </span>
                <span className="text-xs font-bold text-slate-200 block mt-1.5 uppercase">
                  {selectedConcept.trajectory === "IMPROVING"
                    ? "Improving"
                    : selectedConcept.trajectory === "REQUIRING_ATTENTION"
                    ? "Attention"
                    : "Stable"}
                </span>
              </div>
            </div>

            {/* Recommended Action */}
            <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-1">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                Recommended Action
              </span>
              <p className="text-xs text-indigo-200 leading-relaxed">
                {selectedConcept.masteryScore >= 75
                  ? "You have demonstrated solid mastery. Maintain your progress with occasional review."
                  : selectedConcept.masteryScore >= 50
                  ? "You are building good understanding. Practice questions to solidify key nuances."
                  : "Focused review is recommended. Revisit core definitions and consult the AI Tutor."}
              </p>
            </div>

            {/* Recent Attempt Inspection */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Recent Attempt
              </span>

              {selectedConcept.recentAttempts && selectedConcept.recentAttempts.length > 0 ? (
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">
                      {selectedConcept.recentAttempts[0].questionType} ·{" "}
                      {new Date(selectedConcept.recentAttempts[0].attemptedAt).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric" }
                      )}
                    </span>
                    <span
                      className={`font-semibold inline-flex items-center gap-1 ${
                        selectedConcept.recentAttempts[0].isCorrect
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {selectedConcept.recentAttempts[0].isCorrect ? (
                        <>
                          <Check className="w-3 h-3" aria-hidden="true" focusable="false" />
                          <span>Correct</span>
                        </>
                      ) : (
                        <>
                          <X className="w-3 h-3" aria-hidden="true" focusable="false" />
                          <span>Incorrect</span>
                        </>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed line-clamp-2">
                    {selectedConcept.recentAttempts[0].questionText}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic py-1">
                  No individual question attempts recorded for this concept yet.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  setSelectedConcept(null);
                  if (onNavigateTab) {
                    onNavigateTab(
                      "tutor",
                      `Explain ${selectedConcept.conceptName} in detail with key examples.`
                    );
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition cursor-pointer border border-slate-700"
              >
                <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" focusable="false" />
                <span>Ask AI Tutor</span>
              </button>

              <button
                onClick={() => {
                  setSelectedConcept(null);
                  if (onNavigateTab) {
                    onNavigateTab("quiz");
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer shadow-md shadow-indigo-600/30"
              >
                <ClipboardCheck className="w-3.5 h-3.5" aria-hidden="true" focusable="false" />
                <span>Practice Quiz</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
