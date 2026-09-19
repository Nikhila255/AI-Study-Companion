"use client";

import React, { useState, useEffect } from "react";
import {
  Lightbulb,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  Loader2,
  RefreshCw,
  BookOpen,
  FileText,
  Sparkles,
  ArrowRight,
  MessageCircle,
  ClipboardCheck,
  ChevronRight,
  Target,
  Clock,
  ArrowUpRight,
  Check,
} from "lucide-react";

export interface ActionableRecommendation {
  id: string;
  conceptId: string;
  conceptName: string;
  category:
    | "Review Concept"
    | "Practice Questions"
    | "Revisit Fundamentals"
    | "Maintain Progress"
    | "Continue Learning";
  title: string;
  masteryScore: number;
  priorityLevel: "High Priority" | "Medium Priority" | "Suggested";
  totalAttempts: number;
  successfulAttempts: number;
  why: string;
  recommendedAction: string;
  actionType: "PRACTICE_QUIZ" | "REVIEW_CONCEPT" | "RETRY_ASSESSMENT";
  citation?: string;
  askTutorPrompt: string;
}

export interface ConceptStrength {
  conceptId: string;
  conceptName: string;
  masteryScore: number;
  successfulAttempts: number;
  totalAttempts: number;
}

export interface ImprovingConcept {
  conceptId: string;
  conceptName: string;
  masteryScore: number;
  previousScore?: number;
}

export interface StructuredRecommendationsResponse {
  materialName: string;
  focusItems: ActionableRecommendation[];
  studyPlan: string[];
  strengths: ConceptStrength[];
  improving: ImprovingConcept[];
  hasSufficientData: boolean;
  totalPracticed: number;
  recommendations?: ActionableRecommendation[];
}

interface RecommendationsSectionProps {
  projectId: string;
  materialId?: string;
  materialName?: string;
  onNavigateTab?: (tab: string, prompt?: string) => void;
}

export default function RecommendationsSection({
  projectId,
  materialId,
  materialName,
  onNavigateTab,
}: RecommendationsSectionProps) {
  const [data, setData] = useState<StructuredRecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    fetchRecommendations();
  }, [projectId, materialId]);

  useEffect(() => {
    if (!loading && data) {
      const timer = setTimeout(() => setIsAnimated(true), 60);
      return () => clearTimeout(timer);
    }
  }, [loading, data]);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      setIsAnimated(false);
      const url = materialId
        ? `/api/projects/${projectId}/recommendations?materialId=${materialId}`
        : `/api/projects/${projectId}/recommendations`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load recommendations:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const res = await fetch(`/api/projects/${projectId}/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId }),
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to refresh recommendations:", err);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-amber-400" aria-hidden="true" focusable="false" />
        <span className="text-sm font-medium">Analyzing mastery profile and generating next steps...</span>
      </div>
    );
  }

  const focusItems = data?.focusItems || data?.recommendations || [];
  const strengths = data?.strengths || [];
  const improving = data?.improving || [];
  const activeDocName = data?.materialName || materialName || "Study Material";

  // Identify the single Next Best Action (Hero item)
  const nextBestAction = focusItems.length > 0 ? focusItems[0] : null;
  const remainingFocusItems = focusItems.slice(1);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ================= 1. PAGE HEADER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Lightbulb className="w-5 h-5" aria-hidden="true" focusable="false" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Recommendations</h2>
          </div>
          <p className="text-xs text-slate-400 pl-10">
            Personalized next steps based on your mastery, recent performance, and practice history.
          </p>
          <div className="pl-10 pt-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] font-medium text-amber-300">
              <FileText className="w-3 h-3 text-amber-400 shrink-0" aria-hidden="true" focusable="false" />
              <span className="truncate max-w-xs">{activeDocName}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh study recommendations"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700/70 text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" focusable="false" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {!data?.hasSufficientData || focusItems.length === 0 ? (
        /* ================= EMPTY STATE ================= */
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 flex flex-col items-center">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-3 text-amber-400">
            <Sparkles className="w-8 h-8" aria-hidden="true" focusable="false" />
          </div>
          <h4 className="text-base font-bold text-white mb-1">More learning data needed</h4>
          <p className="text-xs text-slate-400 max-w-sm mb-5 leading-relaxed">
            Complete a quiz or assessment to generate dynamic, personalized recommendations for this material.
          </p>
          <button
            onClick={() => onNavigateTab && onNavigateTab("quiz")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition cursor-pointer shadow-lg shadow-amber-600/20"
          >
            <ClipboardCheck className="w-4 h-4" aria-hidden="true" focusable="false" />
            <span>Start Practice Quiz</span>
          </button>
        </div>
      ) : (
        <>
          {/* ================= 2. NEXT BEST ACTION HERO CARD ================= */}
          {nextBestAction && (
            <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-amber-950/30 via-slate-900/90 to-slate-900/90 border border-amber-500/30 shadow-xl">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-extrabold uppercase tracking-wider mb-2">
                <Lightbulb className="w-4 h-4 shrink-0" aria-hidden="true" focusable="false" />
                <span>Next Best Action</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                <div className="lg:col-span-8 space-y-2">
                  <h3 className="text-xl font-black text-white tracking-tight">
                    {nextBestAction.title}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                    {nextBestAction.why}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-950/70 border border-slate-800">
                      <Target className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" focusable="false" />
                      <span>
                        Mastery:{" "}
                        <strong className="text-white font-semibold">
                          {nextBestAction.masteryScore}%
                        </strong>
                      </span>
                    </span>

                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-950/70 border border-slate-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" focusable="false" />
                      <span>
                        Accuracy:{" "}
                        <strong className="text-white font-semibold">
                          {nextBestAction.successfulAttempts} / {nextBestAction.totalAttempts}
                        </strong>
                      </span>
                    </span>

                    {nextBestAction.citation && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-950/70 border border-slate-800 text-[11px] text-indigo-300">
                        <FileText className="w-3 h-3 text-indigo-400" aria-hidden="true" focusable="false" />
                        <span className="truncate max-w-xs">{nextBestAction.citation}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-2.5 justify-end lg:items-end">
                  <button
                    onClick={() => {
                      if (onNavigateTab) {
                        if (nextBestAction.actionType === "PRACTICE_QUIZ") {
                          onNavigateTab("quiz");
                        } else {
                          onNavigateTab("tutor", nextBestAction.askTutorPrompt);
                        }
                      }
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    <span>
                      {nextBestAction.actionType === "PRACTICE_QUIZ"
                        ? "Start Practice Quiz"
                        : "Review Concept"}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" focusable="false" />
                  </button>

                  <button
                    onClick={() => {
                      if (onNavigateTab) {
                        onNavigateTab("tutor", nextBestAction.askTutorPrompt);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" focusable="false" />
                    <span>Ask AI Tutor</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= 3. RECOMMENDATION ITEMS & STUDY ROADMAP ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Actionable Recommendations List */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Targeted Learning Actions
                </h3>
                <span className="text-xs text-slate-400">
                  {focusItems.length} {focusItems.length === 1 ? "action" : "actions"} prioritized
                </span>
              </div>

              {focusItems.map((item) => {
                const priorityBadgeClass =
                  item.priorityLevel === "High Priority"
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                    : item.priorityLevel === "Medium Priority"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : "bg-blue-500/10 text-blue-400 border-blue-500/30";

                const categoryBadgeClass =
                  item.category === "Review Concept"
                    ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
                    : item.category === "Practice Questions"
                    ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                    : "bg-cyan-500/10 text-cyan-300 border-cyan-500/20";

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition space-y-3 group"
                  >
                    {/* Header: Category & Priority */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${categoryBadgeClass}`}
                        >
                          {item.category}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${priorityBadgeClass}`}
                        >
                          {item.priorityLevel}
                        </span>
                      </div>

                      <span className="text-xs text-slate-400">
                        Mastery:{" "}
                        <strong className="text-white font-semibold">
                          {item.masteryScore}%
                        </strong>
                      </span>
                    </div>

                    {/* Title & Concept */}
                    <div>
                      <h4 className="text-base font-bold text-white tracking-tight">
                        {item.conceptName}
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed mt-1">
                        {item.why}
                      </p>
                    </div>

                    {/* Stats & Single Action Button */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                      <div className="flex items-center gap-3 text-slate-400">
                        <span>
                          Accuracy:{" "}
                          <strong className="text-slate-200">
                            {item.successfulAttempts} / {item.totalAttempts} correct
                          </strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (onNavigateTab) {
                              onNavigateTab("tutor", item.askTutorPrompt);
                            }
                          }}
                          aria-label={`Ask AI Tutor about ${item.conceptName}`}
                          className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                        >
                          Ask Tutor
                        </button>

                        <button
                          onClick={() => {
                            if (onNavigateTab) {
                              if (item.actionType === "PRACTICE_QUIZ") {
                                onNavigateTab("quiz");
                              } else {
                                onNavigateTab("tutor", item.askTutorPrompt);
                              }
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition cursor-pointer shadow-sm"
                        >
                          <span>
                            {item.actionType === "PRACTICE_QUIZ" ? "Practice" : "Review"}
                          </span>
                          <ChevronRight className="w-3 h-3" aria-hidden="true" focusable="false" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Column: Study Roadmap & Strengths */}
            <div className="lg:col-span-5 space-y-4">
              {/* Study Roadmap (01 -> 02 -> 03) */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4">
                <div className="pb-2 border-b border-slate-800/80">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-amber-400" aria-hidden="true" focusable="false" />
                    <span>Study Roadmap</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Structured learning sequence to systematically master this material.
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Step 01 */}
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      01
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-xs font-bold text-white block">
                        {focusItems.length > 0 ? `Review ${focusItems[0].conceptName}` : "Review Core Principles"}
                      </span>
                      <p className="text-[11px] text-slate-400 leading-tight">
                        Understand definitions, formulas, and edge cases in the active document.
                      </p>
                    </div>
                  </div>

                  {/* Connector Arrow */}
                  <div className="pl-3.5 text-slate-600 text-xs leading-none">↓</div>

                  {/* Step 02 */}
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      02
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-xs font-bold text-white block">
                        Practice 5 Targeted Questions
                      </span>
                      <p className="text-[11px] text-slate-400 leading-tight">
                        Apply concepts in multiple-choice scenarios to reinforce recall.
                      </p>
                    </div>
                  </div>

                  {/* Connector Arrow */}
                  <div className="pl-3.5 text-slate-600 text-xs leading-none">↓</div>

                  {/* Step 03 */}
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      03
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-xs font-bold text-white block">
                        Reassess & Synthesize
                      </span>
                      <p className="text-[11px] text-slate-400 leading-tight">
                        Take an open-ended assessment to solidify deep conceptual comprehension.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Your Strengths (Compact list with mini progress bars) */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-3">
                <div className="pb-2 border-b border-slate-800/80">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" focusable="false" />
                    <span>Your Strengths</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Topics where you have achieved strong mastery.
                  </p>
                </div>

                {strengths.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">
                    No concepts have reached strong mastery (≥75%) yet. Keep practicing!
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {strengths.map((s) => (
                      <div key={s.conceptId} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-200 font-medium truncate flex items-center gap-1.5">
                            <Check className="w-3 h-3 text-emerald-400 shrink-0" aria-hidden="true" focusable="false" />
                            <span>{s.conceptName}</span>
                          </span>
                          <span className="font-bold text-emerald-400 shrink-0 ml-2">
                            {s.masteryScore}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-700 ease-out"
                            style={{ width: isAnimated ? `${s.masteryScore}%` : "0%" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Performance Trajectory */}
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Recent Performance
                </span>
                {improving.length > 0 ? (
                  <div className="space-y-1">
                    {improving.map((imp) => (
                      <div
                        key={imp.conceptId}
                        className="text-xs text-slate-200 flex items-center justify-between"
                      >
                        <span className="truncate">{imp.conceptName}</span>
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                          <TrendingUp className="w-3 h-3" aria-hidden="true" focusable="false" />
                          <span>Improving</span>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    Not enough historical attempts to determine a trajectory yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
