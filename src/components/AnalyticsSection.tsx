"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart3,
  CheckCircle2,
  Brain,
  BookOpen,
  FileText,
  Clock,
  Loader2,
  TrendingUp,
  Target,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers,
  ClipboardCheck,
  Award,
  ExternalLink,
  HelpCircle,
} from "lucide-react";

export interface AnalyticsData {
  yourProgress: {
    overallMastery: number;
    quizAccuracy: string;
    assessmentAverage: string;
    conceptsPracticed: number;
    totalConcepts?: number;
  };
  conceptPerformance: Array<{
    conceptId: string;
    conceptName: string;
    masteryScore: number | null;
    quizAccuracy: string;
    trend: string;
  }>;
  practicedConcepts?: Array<{
    conceptId: string;
    conceptName: string;
    masteryScore: number | null;
    quizAccuracy: string;
    trend: string;
  }>;
  unpracticedConcepts?: Array<{
    conceptId: string;
    conceptName: string;
    masteryScore: number | null;
    quizAccuracy: string;
    trend: string;
  }>;
  quizPerformance: {
    questionsAttempted: number;
    correct: number;
    accuracy: number;
    difficultyPerformance: {
      easy: number | null;
      medium: number | null;
      hard: number | null;
    };
  };
  assessmentPerformance: {
    completed: number;
    averageScore: number | null;
    rubrics: {
      understanding: number | null;
      relevance: number | null;
      completeness: number | null;
    };
  };
  recentLearning: Array<{
    id: string;
    text: string;
    date: string;
  }>;
  studyMaterials: {
    fileName: string;
    pages: number;
    status: string;
    conceptsDetected: number;
    topicsPracticed: number;
  };
}

interface AnalyticsSectionProps {
  projectId: string;
  materialId?: string;
  materialName?: string;
  onNavigateTab?: (tab: string) => void;
}

export default function AnalyticsSection({
  projectId,
  materialId,
  materialName,
  onNavigateTab,
}: AnalyticsSectionProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUnpracticed, setShowUnpracticed] = useState(false);
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [projectId, materialId]);

  useEffect(() => {
    if (!loading && data) {
      const timer = setTimeout(() => setIsAnimated(true), 60);
      return () => clearTimeout(timer);
    }
  }, [loading, data]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setIsAnimated(false);
      const url = materialId
        ? `/api/projects/${projectId}/analytics?materialId=${materialId}`
        : `/api/projects/${projectId}/analytics`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400" aria-hidden="true" focusable="false" />
        <span className="text-sm font-medium">Gathering learning metrics, activity logs, and coverage...</span>
      </div>
    );
  }

  if (!data) return null;

  const practicedConcepts =
    data.practicedConcepts || data.conceptPerformance.filter((c) => c.masteryScore !== null);
  const unpracticedConcepts =
    data.unpracticedConcepts || data.conceptPerformance.filter((c) => c.masteryScore === null);

  const totalTopics = data.yourProgress.totalConcepts || data.conceptPerformance.length || 1;
  const practicedCount = data.yourProgress.conceptsPracticed || practicedConcepts.length;
  const unpracticedCount = unpracticedConcepts.length;
  const coveragePercent = Math.min(100, Math.round((practicedCount / totalTopics) * 100));

  const activeDocName = materialName || data.studyMaterials.fileName || "Study Material";

  const getEventIcon = (text: string) => {
    const t = text.toLowerCase();
    if (t.includes("quiz")) return <Award className="w-4 h-4 text-indigo-400 shrink-0" aria-hidden="true" focusable="false" />;
    if (t.includes("mastery")) return <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" focusable="false" />;
    if (t.includes("tutor")) return <Brain className="w-4 h-4 text-purple-400 shrink-0" aria-hidden="true" focusable="false" />;
    if (t.includes("assessment")) return <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" focusable="false" />;
    return <Activity className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" focusable="false" />;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ================= 1. PAGE HEADER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <BarChart3 className="w-5 h-5" aria-hidden="true" focusable="false" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Learning Analytics</h2>
          </div>
          <p className="text-xs text-slate-400 pl-10">
            Understand your learning activity, accuracy, and coverage across this study material.
          </p>
          <div className="pl-10 pt-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] font-medium text-cyan-300">
              <FileText className="w-3 h-3 text-cyan-400 shrink-0" aria-hidden="true" focusable="false" />
              <span className="truncate max-w-xs">{activeDocName}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ================= 2. KEY METRICS STRIP ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Overall Mastery */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Overall Mastery
            </span>
            <div className="p-1 rounded-md bg-indigo-500/10 text-indigo-400">
              <Target className="w-3.5 h-3.5" aria-hidden="true" focusable="false" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {data.yourProgress.overallMastery}%
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: isAnimated ? `${Math.min(100, data.yourProgress.overallMastery)}%` : "0%",
              }}
            />
          </div>
        </div>

        {/* Metric 2: Quiz Accuracy */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Quiz Accuracy
            </span>
            <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-400">
              <ClipboardCheck className="w-3.5 h-3.5" aria-hidden="true" focusable="false" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400">
            {data.yourProgress.quizAccuracy}
          </div>
          <span className="text-[10px] text-slate-400 mt-2 block">
            {data.quizPerformance.correct} of {data.quizPerformance.questionsAttempted} correct
          </span>
        </div>

        {/* Metric 3: Practiced Topics */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Practiced
            </span>
            <div className="p-1 rounded-md bg-cyan-500/10 text-cyan-400">
              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" focusable="false" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-cyan-400">
            {practicedCount}
          </div>
          <span className="text-[10px] text-slate-400 mt-2 block">
            {practicedCount === 1 ? "1 concept evaluated" : `${practicedCount} concepts evaluated`}
          </span>
        </div>

        {/* Metric 4: Mapped Topics */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Mapped Topics
            </span>
            <div className="p-1 rounded-md bg-purple-500/10 text-purple-400">
              <Layers className="w-3.5 h-3.5" aria-hidden="true" focusable="false" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {totalTopics}
          </div>
          <span className="text-[10px] text-slate-400 mt-2 block">
            Extracted from active document
          </span>
        </div>
      </div>

      {/* ================= 3. LEARNING COVERAGE ================= */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Learning Coverage
            </h3>
            <p className="text-xs text-slate-400">
              Proportion of syllabus concepts actively evaluated.
            </p>
          </div>
          <span className="text-xs font-semibold text-cyan-400">
            {practicedCount} / {totalTopics} topics ({coveragePercent}%)
          </span>
        </div>

        {/* Split Bar */}
        <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden flex">
          <div
            className="bg-cyan-500 h-full rounded-l-full transition-all duration-700 ease-out"
            style={{ width: isAnimated ? `${coveragePercent}%` : "0%" }}
            title={`Practiced: ${practicedCount}`}
          />
          <div
            className="bg-slate-700/60 h-full flex-1"
            title={`Unpracticed: ${unpracticedCount}`}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
            <span>
              Practiced: <strong className="text-white">{practicedCount}</strong>
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-600 inline-block" />
            <span>
              Unpracticed: <strong className="text-slate-300">{unpracticedCount}</strong>
            </span>
          </span>
        </div>
      </div>

      {/* ================= 4. PERFORMANCE INSIGHTS (Practiced Concepts Only) ================= */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Performance Insights
            </h3>
            <p className="text-xs text-slate-400">
              Concepts with active practice attempts and validated mastery scores.
            </p>
          </div>
          <span className="text-xs text-slate-400">
            {practicedConcepts.length} {practicedConcepts.length === 1 ? "concept" : "concepts"}
          </span>
        </div>

        {practicedConcepts.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-3 text-center">
            No concepts have been practiced yet. Take a quiz or assessment to view performance insights.
          </p>
        ) : (
          <div className="space-y-2.5">
            {practicedConcepts.map((c) => {
              const score = c.masteryScore ?? 0;
              const isStrong = score >= 75;
              const isDev = score >= 50 && score < 75;

              const barBg = isStrong
                ? "bg-emerald-500"
                : isDev
                ? "bg-amber-500"
                : "bg-rose-500";

              const trendBadge =
                c.trend === "Improving"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : c.trend === "Needs Practice"
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                  : "bg-blue-500/10 text-blue-400 border-blue-500/20";

              return (
                <div
                  key={c.conceptId}
                  className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 sm:w-1/3">
                    <span className="font-semibold text-white text-sm truncate block">
                      {c.conceptName}
                    </span>
                    <span className="text-xs text-slate-400">
                      Quiz Accuracy: <strong className="text-slate-200">{c.quizAccuracy}</strong>
                    </span>
                  </div>

                  {/* Linear Progress Bar */}
                  <div className="space-y-1 sm:w-1/3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Mastery</span>
                      <span className="font-bold text-white">{score}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barBg} rounded-full transition-all duration-700 ease-out`}
                        style={{ width: isAnimated ? `${score}%` : "0%" }}
                      />
                    </div>
                  </div>

                  {/* Trend Badge */}
                  <div className="sm:w-1/4 sm:text-right">
                    <span
                      className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded border ${trendBadge}`}
                    >
                      Trend: {c.trend}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= 5. UNPRACTICED TOPICS COLLAPSIBLE ================= */}
      {unpracticedCount > 0 && (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden">
          <button
            onClick={() => setShowUnpracticed(!showUnpracticed)}
            aria-expanded={showUnpracticed}
            aria-label="Toggle unpracticed topics list"
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-900/90 transition cursor-pointer"
          >
            <div>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Unpracticed Topics ({unpracticedCount})
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {unpracticedCount} topics in this document have not yet been evaluated in quizzes or assessments.
              </p>
            </div>

            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
              <span>{showUnpracticed ? "Hide Topics" : "View Topics"}</span>
              {showUnpracticed ? (
                <ChevronUp className="w-4 h-4" aria-hidden="true" focusable="false" />
              ) : (
                <ChevronDown className="w-4 h-4" aria-hidden="true" focusable="false" />
              )}
            </div>
          </button>

          {showUnpracticed && (
            <div className="p-4 pt-0 border-t border-slate-800/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 animate-fadeIn">
              {unpracticedConcepts.map((u) => (
                <div
                  key={u.conceptId}
                  className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-300 flex items-center justify-between"
                >
                  <span className="truncate mr-2 font-medium">{u.conceptName}</span>
                  <span className="text-[10px] text-slate-500 shrink-0 uppercase tracking-wider">
                    Unattempted
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= 6. QUIZ & ASSESSMENT PERFORMANCE PANELS ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Quiz Performance Panel */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4">
          <div className="pb-2 border-b border-slate-800/80">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-indigo-400" aria-hidden="true" focusable="false" />
              <span>Quiz Performance</span>
            </h3>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                Questions
              </span>
              <span className="text-xl font-bold text-white block mt-0.5">
                {data.quizPerformance.questionsAttempted}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                Correct
              </span>
              <span className="text-xl font-bold text-emerald-400 block mt-0.5">
                {data.quizPerformance.correct}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                Accuracy
              </span>
              <span className="text-xl font-bold text-indigo-400 block mt-0.5">
                {data.quizPerformance.accuracy}%
              </span>
            </div>
          </div>

          {/* Difficulty Breakdown */}
          <div className="space-y-2 pt-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Difficulty Breakdown
            </span>
            <div className="space-y-2">
              {[
                {
                  label: "Easy",
                  value: data.quizPerformance.difficultyPerformance.easy,
                  color: "bg-emerald-500",
                  text: "text-emerald-400",
                },
                {
                  label: "Medium",
                  value: data.quizPerformance.difficultyPerformance.medium,
                  color: "bg-amber-500",
                  text: "text-amber-400",
                },
                {
                  label: "Hard",
                  value: data.quizPerformance.difficultyPerformance.hard,
                  color: "bg-rose-500",
                  text: "text-rose-400",
                },
              ].map(({ label, value, color, text }) => (
                <div key={label} className="flex items-center gap-3 text-xs">
                  <span className="text-slate-300 font-medium w-14 shrink-0">{label}</span>
                  {value !== null ? (
                    <>
                      <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color} rounded-full transition-all duration-700 ease-out`}
                          style={{ width: isAnimated ? `${value}%` : "0%" }}
                        />
                      </div>
                      <span className={`font-bold ${text} w-10 text-right shrink-0`}>
                        {value}%
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-600 italic">No attempts yet</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Assessment Performance Panel */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4">
          <div className="pb-2 border-b border-slate-800/80">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-400" aria-hidden="true" focusable="false" />
              <span>Assessment Performance</span>
            </h3>
          </div>

          {data.assessmentPerformance.completed === 0 ? (
            <div className="py-6 flex flex-col items-center text-center gap-3">
              <div className="p-3 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Brain className="w-6 h-6" aria-hidden="true" focusable="false" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">
                  No open-ended assessments completed yet
                </p>
                <p className="text-xs text-slate-400 mt-0.5 max-w-xs">
                  Demonstrate conceptual synthesis in your own words to unlock AI rubric evaluations.
                </p>
              </div>
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab("assessment")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-300 hover:text-purple-200 border border-purple-500/30 hover:border-purple-400/50 px-3.5 py-1.5 rounded-lg transition bg-purple-950/20 hover:bg-purple-950/40 cursor-pointer mt-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" focusable="false" />
                  <span>Start Assessment</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                    Completed
                  </span>
                  <span className="text-xl font-bold text-white block mt-0.5">
                    {data.assessmentPerformance.completed}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                    Average Score
                  </span>
                  <span className="text-xl font-bold text-purple-400 block mt-0.5">
                    {data.assessmentPerformance.averageScore}%
                  </span>
                </div>
              </div>

              {/* Rubric Breakdown */}
              <div className="space-y-1.5 pt-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Rubric Breakdown
                </span>
                {[
                  {
                    label: "Understanding",
                    value: data.assessmentPerformance.rubrics.understanding,
                  },
                  {
                    label: "Relevance",
                    value: data.assessmentPerformance.rubrics.relevance,
                  },
                  {
                    label: "Completeness",
                    value: data.assessmentPerformance.rubrics.completeness,
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between p-2 rounded bg-slate-950/40 border border-slate-800/80 text-xs"
                  >
                    <span className="text-slate-300 font-medium">{label}</span>
                    <span className="font-bold text-purple-400">
                      {value !== null && value !== undefined ? `${value}%` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================= 7. RECENT ACTIVITY TIMELINE & STUDY MATERIAL ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Recent Activity Timeline */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4">
          <div className="pb-2 border-b border-slate-800/80">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" aria-hidden="true" focusable="false" />
              <span>Recent Activity</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Chronological log of practice and tutor sessions.
            </p>
          </div>

          {data.recentLearning.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4 text-center">
              No recent learning activity recorded for this document.
            </p>
          ) : (
            <div className="space-y-3 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
              {data.recentLearning.map((item) => (
                <div key={item.id} className="relative flex items-start gap-2.5">
                  <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-slate-900 border-2 border-cyan-400 flex items-center justify-center shrink-0" />
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs text-slate-200 leading-snug">{item.text}</p>
                    <span className="text-[10px] text-slate-500 block">{item.date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Study Material Summary Card */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex flex-col justify-between space-y-4">
          <div>
            <div className="pb-2 border-b border-slate-800/80">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" aria-hidden="true" focusable="false" />
                <span>Active Study Material</span>
              </h3>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 mt-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white text-sm truncate max-w-xs">
                  {data.studyMaterials.fileName}
                </span>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                  {data.studyMaterials.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                <div>
                  Pages:{" "}
                  <strong className="text-slate-200 font-semibold">
                    {data.studyMaterials.pages}
                  </strong>
                </div>
                <div>
                  Detected Topics:{" "}
                  <strong className="text-slate-200 font-semibold">
                    {data.studyMaterials.conceptsDetected}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-500 leading-relaxed border-t border-slate-800/60">
            All analytics and metrics shown on this page are strictly bounded to this project and active study document.
          </div>
        </div>
      </div>
    </div>
  );
}
