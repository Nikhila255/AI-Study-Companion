"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Award,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Sliders,
  BookOpen,
  Target,
  FileText,
  Clock,
  Bookmark,
  Check,
  HelpCircle,
  BarChart3,
  X,
  AlertTriangle,
} from "lucide-react";

interface Concept {
  id: string;
  name: string;
  description?: string;
}

export type QuestionType = "MCQ" | "FILL_BLANK" | "SHORT_ANSWER" | "NUMERICAL" | "FORMULA";

interface Question {
  id: string;
  conceptId?: string;
  conceptName?: string;
  questionType: QuestionType;
  questionText: string;
  options: string[] | null;
  difficultyLevel: "EASY" | "MEDIUM" | "HARD";
  orderIndex: number;
  sourceCitation?: string;
}

interface QuizSectionProps {
  projectId: string;
  materialId?: string;
  materialName?: string;
  onMasteryUpdated?: () => void;
}

interface QuestionAnswerState {
  userAnswerIndex?: number | null;
  userAnswerText?: string;
}

interface ReviewedQuestionItem {
  questionId: string;
  orderIndex: number;
  conceptName: string;
  questionType: QuestionType;
  questionText: string;
  options: string[] | null;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
  sourceCitation: string;
}

interface QuizBatchResult {
  assessmentId: string;
  score: number;
  totalCount: number;
  accuracy: number;
  timeSpentSeconds?: number;
  conceptBreakdown: Record<string, { total: number; correct: number; accuracy: number }>;
  weakConcepts: string[];
  reviewedQuestions: ReviewedQuestionItem[];
}

export default function QuizSection({
  projectId,
  materialId,
  materialName,
  onMasteryUpdated,
}: QuizSectionProps) {
  // Topic selection & configuration state
  const [availableConcepts, setAvailableConcepts] = useState<Concept[]>([]);
  const [selectedConceptIds, setSelectedConceptIds] = useState<string[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD" | "MIXED">("MIXED");
  const [timerMinutes, setTimerMinutes] = useState<number>(0); // 0 = No Timer, or 5, 10, 15

  // Quiz Execution State
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Store user answers keyed by question ID: { [questionId]: { userAnswerIndex, userAnswerText } }
  const [userAnswers, setUserAnswers] = useState<Record<string, QuestionAnswerState>>({});
  
  // Marked for review questions
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());

  // Timer State
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [timeSpentSeconds, setTimeSpentSeconds] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Submit Modal, Alert & Final Results
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [timeUpAlert, setTimeUpAlert] = useState(false);
  const [quizResults, setQuizResults] = useState<QuizBatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load available topics for the active material
  useEffect(() => {
    async function loadTopics() {
      try {
        setLoadingTopics(true);
        const url = materialId
          ? `/api/projects/${projectId}/quiz?materialId=${materialId}`
          : `/api/projects/${projectId}/quiz`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const list: Concept[] = data.concepts || [];
          setAvailableConcepts(list);
          setSelectedConceptIds(list.map((c) => c.id));
        }
      } catch (err) {
        console.error("Failed to load quiz topics:", err);
      } finally {
        setLoadingTopics(false);
      }
    }
    loadTopics();
  }, [projectId, materialId]);

  // Timer effect
  useEffect(() => {
    if (secondsRemaining === null || questions.length === 0 || quizResults !== null) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (secondsRemaining <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      // Auto-submit when time reaches zero (no confirmation modal)
      setTimeUpAlert(true);
      setShowSubmitModal(false);
      handleConfirmSubmit();
      return;
    }

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      setTimeSpentSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [secondsRemaining, questions.length, quizResults]);

  const toggleSelectAll = () => {
    if (selectedConceptIds.length === availableConcepts.length) {
      setSelectedConceptIds([]);
    } else {
      setSelectedConceptIds(availableConcepts.map((c) => c.id));
    }
  };

  const toggleConcept = (id: string) => {
    if (selectedConceptIds.includes(id)) {
      setSelectedConceptIds((prev) => prev.filter((cid) => cid !== id));
    } else {
      setSelectedConceptIds((prev) => [...prev, id]);
    }
  };

  const startQuiz = async () => {
    setLoading(true);
    setError(null);
    setQuizResults(null);
    setTimeUpAlert(false);
    setUserAnswers({});
    setMarkedForReview(new Set());
    setCurrentIndex(0);
    setTimeSpentSeconds(0);

    try {
      const res = await fetch(`/api/projects/${projectId}/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "GENERATE",
          questionCount,
          targetDifficulty: difficulty,
          materialId,
          selectedConceptIds:
            selectedConceptIds.length > 0 ? selectedConceptIds : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate quiz.");

      setAssessmentId(data.assessmentId);
      setQuestions(data.questions || []);

      if (timerMinutes > 0) {
        setSecondsRemaining(timerMinutes * 60);
      } else {
        setSecondsRemaining(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to start quiz.");
    } finally {
      setLoading(false);
    }
  };

  const currentQ = questions[currentIndex];
  const currentAnswer = currentQ ? userAnswers[currentQ.id] : undefined;

  // Update answer for current question
  const handleSelectOption = (optIdx: number) => {
    if (!currentQ) return;
    setUserAnswers((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        userAnswerIndex: optIdx,
      },
    }));
  };

  const handleTextChange = (text: string) => {
    if (!currentQ) return;
    setUserAnswers((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        userAnswerText: text,
      },
    }));
  };

  const handleClearAnswer = () => {
    if (!currentQ) return;
    setUserAnswers((prev) => {
      const copy = { ...prev };
      delete copy[currentQ.id];
      return copy;
    });
  };

  const handleToggleMarkForReview = () => {
    if (!currentQ) return;
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(currentQ.id)) {
        next.delete(currentQ.id);
      } else {
        next.add(currentQ.id);
      }
      return next;
    });
  };

  // Submit complete quiz
  const handleConfirmSubmit = async () => {
    if (!assessmentId || submitting) return;
    setSubmitting(true);
    setError(null);
    setShowSubmitModal(false);

    try {
      const answersPayload = questions.map((q) => {
        const ans = userAnswers[q.id];
        return {
          questionId: q.id,
          userAnswerIndex: ans?.userAnswerIndex ?? null,
          userAnswerText: ans?.userAnswerText ?? null,
        };
      });

      const res = await fetch(`/api/projects/${projectId}/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SUBMIT_QUIZ",
          assessmentId,
          answers: answersPayload,
          timeSpentSeconds,
        }),
      });

      const data: QuizBatchResult = await res.json();
      if (!res.ok) throw new Error((data as any).error || "Failed to submit quiz.");

      setQuizResults(data);
      if (onMasteryUpdated) onMasteryUpdated();
    } catch (err: any) {
      setError(err.message || "Failed to evaluate quiz submission.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetToSetup = () => {
    setQuestions([]);
    setAssessmentId(null);
    setQuizResults(null);
    setTimeUpAlert(false);
    setUserAnswers({});
    setMarkedForReview(new Set());
    setCurrentIndex(0);
    setError(null);
    setSecondsRemaining(null);
    setTimeSpentSeconds(0);
  };

  // Check if a question is answered
  const isQuestionAnswered = (q: Question) => {
    const ans = userAnswers[q.id];
    if (!ans) return false;
    if (typeof ans.userAnswerIndex === "number" && ans.userAnswerIndex >= 0) return true;
    if (typeof ans.userAnswerText === "string" && ans.userAnswerText.trim().length > 0) return true;
    return false;
  };

  // Status counts for submission control area
  const answeredCount = questions.filter(isQuestionAnswered).length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);
  const markedCount = markedForReview.size;

  // Format timer seconds into MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins}:${remSecs < 10 ? "0" : ""}${remSecs}`;
  };

  return (
    <div className="quiz-container">
      {questions.length === 0 ? (
        /* ================= 1. ADAPTIVE QUIZ SETUP SCREEN ================= */
        <div className="quiz-setup-wrapper">
          <div className="quiz-setup-header">
            <div className="quiz-icon-badge">
              <Award className="w-8 h-8" />
            </div>
            <h3 className="quiz-title">Adaptive Quiz</h3>
            <div className="quiz-material-tag">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                {materialName || "Unit-V_InstanceBasedLearning.pdf"}
              </span>
              {availableConcepts.length > 0 && (
                <span className="text-xs text-indigo-300">
                  · {availableConcepts.length} concepts available
                </span>
              )}
            </div>
          </div>

          <div className="quiz-card-section">
            {/* TOPIC SELECTION */}
            <div className="quiz-section-header">
              <div className="flex items-center gap-3">
                <label className="quiz-section-label">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  <span>TOPIC SELECTION</span>
                </label>
                <span className="quiz-topic-count-pill">
                  {selectedConceptIds.length} of {availableConcepts.length} selected
                </span>
              </div>
              {availableConcepts.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedConceptIds(availableConcepts.map((c) => c.id))}
                    className="quiz-btn-select-all"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedConceptIds([])}
                    className="quiz-btn-clear-all"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {loadingTopics ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Extracting educational concepts from current study material...</span>
              </div>
            ) : availableConcepts.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">
                No study concepts are available yet. Processing uploaded material...
              </p>
            ) : (
              <div className="quiz-topic-grid">
                {availableConcepts.map((concept) => {
                  const isChecked = selectedConceptIds.includes(concept.id);
                  return (
                    <button
                      key={concept.id}
                      type="button"
                      onClick={() => toggleConcept(concept.id)}
                      className={`quiz-topic-chip ${isChecked ? "selected" : ""}`}
                    >
                      <div className="quiz-chip-checkbox">
                        {isChecked && <Check className="w-3 h-3" />}
                      </div>
                      <span className="truncate">{concept.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="quiz-card-section">
            {/* QUESTION COUNT */}
            <div className="quiz-section-header">
              <label className="quiz-section-label">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span>Question Count</span>
              </label>
            </div>
            <div className="quiz-count-grid">
              {[5, 10, 15, 20].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setQuestionCount(num)}
                  className={`quiz-count-btn ${questionCount === num ? "active" : ""}`}
                >
                  {num} Questions
                </button>
              ))}
            </div>
          </div>

          <div className="quiz-card-section">
            {/* DIFFICULTY */}
            <div className="quiz-section-header">
              <label className="quiz-section-label">
                <Target className="w-4 h-4 text-indigo-400" />
                <span>Difficulty Level</span>
              </label>
            </div>
            <div className="quiz-diff-grid">
              {[
                {
                  id: "EASY",
                  label: "Easy",
                  desc: "Recall & basic definitions",
                  typeClass: "diff-easy",
                },
                {
                  id: "MEDIUM",
                  label: "Medium",
                  desc: "Application & comparison",
                  typeClass: "diff-medium",
                },
                {
                  id: "HARD",
                  label: "Hard",
                  desc: "Reasoning, formulas & calculations",
                  typeClass: "diff-hard",
                },
                {
                  id: "MIXED",
                  label: "Mixed",
                  desc: "Adaptive combination of levels",
                  typeClass: "diff-mixed",
                },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setDifficulty(lvl.id as any)}
                  className={`quiz-diff-card ${
                    difficulty === lvl.id ? "active" : ""
                  }`}
                >
                  <div className="quiz-diff-title">{lvl.label}</div>
                  <div className="quiz-diff-desc">{lvl.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="quiz-card-section">
            {/* OPTIONAL TIMER */}
            <div className="quiz-section-header">
              <label className="quiz-section-label">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Assessment Timer</span>
              </label>
            </div>
            <div className="quiz-timer-grid">
              {[
                { label: "No Timer", val: 0 },
                { label: "5 Minutes", val: 5 },
                { label: "10 Minutes", val: 10 },
                { label: "15 Minutes", val: 15 },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setTimerMinutes(item.val)}
                  className={`quiz-timer-btn ${timerMinutes === item.val ? "active" : ""}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={startQuiz}
            disabled={loading || selectedConceptIds.length === 0}
            className="quiz-btn-start"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            <span>Start Adaptive Quiz</span>
          </button>
          {error && <p className="text-rose-400 text-xs text-center mt-3">{error}</p>}
        </div>
      ) : quizResults ? (
        /* ================= 2. QUIZ COMPLETE RESULT DASHBOARD ================= */
        <div className="quiz-results-wrapper">
          {timeUpAlert && (
            <div className="quiz-time-up-banner">
              <Clock className="w-5 h-5 text-amber-400 shrink-0" />
              <span>Time&apos;s Up — Your quiz has been submitted automatically.</span>
            </div>
          )}

          <div className="quiz-results-hero">
            <div
              className={`quiz-hero-icon-circle ${
                quizResults.accuracy >= 75 ? "pass" : "review"
              }`}
            >
              {quizResults.accuracy >= 75 ? (
                <CheckCircle2 className="w-10 h-10" />
              ) : (
                <AlertCircle className="w-10 h-10" />
              )}
            </div>
            <h3 className="quiz-title">Quiz Completed</h3>
            <p className="text-sm text-slate-400">
              {quizResults.accuracy >= 75
                ? "Excellent performance! You have demonstrated strong mastery of these concepts."
                : "Good effort! Review the weak concepts below to reinforce your understanding."}
            </p>
          </div>

          {/* Stats Cards */}
          <div className="quiz-stat-cards-grid">
            <div className="quiz-stat-card">
              <div className="quiz-stat-card-title">Score</div>
              <div className="quiz-stat-card-value">
                {quizResults.score} / {quizResults.totalCount}
              </div>
            </div>
            <div className="quiz-stat-card">
              <div className="quiz-stat-card-title">Accuracy</div>
              <div
                className={`quiz-stat-card-value ${
                  quizResults.accuracy >= 75
                    ? "text-emerald-400"
                    : quizResults.accuracy >= 50
                    ? "text-amber-400"
                    : "text-rose-400"
                }`}
              >
                {quizResults.accuracy}%
              </div>
            </div>
            {typeof quizResults.timeSpentSeconds === "number" && (
              <div className="quiz-stat-card">
                <div className="quiz-stat-card-title">Time Spent</div>
                <div className="quiz-stat-card-value">
                  {formatTime(quizResults.timeSpentSeconds)}
                </div>
              </div>
            )}
            <div className="quiz-stat-card">
              <div className="quiz-stat-card-title">Status</div>
              <div
                className={`quiz-stat-card-value text-base mt-2 ${
                  quizResults.accuracy >= 75 ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {quizResults.accuracy >= 75 ? "Mastered" : "Needs Review"}
              </div>
            </div>
          </div>

          {/* Topic Performance Breakdown */}
          <div className="quiz-concept-card">
            <h4 className="quiz-section-label mb-4">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              <span>Concept Performance Breakdown</span>
            </h4>
            <div className="space-y-4">
              {Object.entries(quizResults.conceptBreakdown).map(([cName, stats]) => (
                <div key={cName} className="quiz-concept-item">
                  <div className="quiz-concept-item-header">
                    <span className="quiz-concept-name-label">{cName}</span>
                    <span
                      className={`quiz-concept-score-pill ${
                        stats.accuracy >= 75
                          ? "high"
                          : stats.accuracy >= 50
                          ? "mid"
                          : "low"
                      }`}
                    >
                      {stats.correct} / {stats.total} ({stats.accuracy}%)
                    </span>
                  </div>
                  <div className="quiz-concept-bar-track">
                    <div
                      className={`quiz-concept-bar-fill ${
                        stats.accuracy >= 75
                          ? "bg-emerald-500"
                          : stats.accuracy >= 50
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${stats.accuracy}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Weak Concepts Warning */}
            {quizResults.weakConcepts.length > 0 && (
              <div className="quiz-weak-box mt-6">
                <div className="quiz-weak-header">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Concepts Requiring Attention</span>
                </div>
                <p className="text-xs text-amber-200/80 leading-relaxed">
                  Based on your quiz performance, we recommend reviewing the following topics in the study material:
                </p>
                <div className="quiz-weak-list">
                  {quizResults.weakConcepts.map((wc, i) => (
                    <span key={i} className="quiz-weak-tag">
                      {wc}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Detailed Question Review */}
          <div className="quiz-review-wrapper">
            <h4 className="quiz-section-label mb-4">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <span>Detailed Question Review</span>
            </h4>
            <div className="space-y-4">
              {quizResults.reviewedQuestions.map((rq, idx) => (
                <div
                  key={rq.questionId}
                  className={`quiz-review-item ${rq.isCorrect ? "correct" : "incorrect"}`}
                >
                  <div className="quiz-review-header">
                    <span className="text-xs text-slate-400 font-semibold">
                      Question {idx + 1} of {quizResults.reviewedQuestions.length} ·{" "}
                      <strong className="text-slate-300">{rq.conceptName}</strong>
                    </span>
                    <span
                      className={`quiz-review-status-badge ${
                        rq.isCorrect ? "correct" : "incorrect"
                      }`}
                    >
                      {rq.isCorrect ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Correct</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4" />
                          <span>Incorrect</span>
                        </>
                      )}
                    </span>
                  </div>

                  <h5 className="quiz-review-question-text">{rq.questionText}</h5>

                  <div className="quiz-review-answers-grid">
                    <div className="quiz-review-answer-cell">
                      <span className="quiz-review-cell-label">Your Answer</span>
                      <div className="quiz-review-cell-value">{rq.userAnswer}</div>
                    </div>
                    <div className="quiz-review-answer-cell">
                      <span className="quiz-review-cell-label">Correct Answer</span>
                      <div className="quiz-review-cell-value text-emerald-400">
                        {rq.correctAnswer}
                      </div>
                    </div>
                  </div>

                  <div className="quiz-review-explanation-box">
                    <span className="text-xs font-bold text-indigo-300 block mb-1">
                      Explanation:
                    </span>
                    <p className="quiz-review-explanation-text">{rq.explanation}</p>
                  </div>

                  <div className="quiz-review-source-tag">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Source:</span>
                    <strong>{rq.sourceCitation}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center pt-4 mb-6">
            <button
              onClick={resetToSetup}
              className="quiz-btn-start max-w-xs"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Take Another Quiz</span>
            </button>
          </div>
        </div>
      ) : (
        /* ================= 3. ACTIVE QUESTION SCREEN ================= */
        <div className="quiz-active-wrapper">
          {/* Header Bar */}
          <div className="quiz-header-bar">
            <div className="quiz-header-left">
              <span className="quiz-progress-badge">
                Question {currentIndex + 1} of {questions.length}
              </span>
              {currentQ.conceptName && (
                <span className="quiz-concept-name-tag">
                  Concept: <strong>{currentQ.conceptName}</strong>
                </span>
              )}
              <span
                className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                  currentQ.difficultyLevel === "EASY"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : currentQ.difficultyLevel === "MEDIUM"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                }`}
              >
                {currentQ.difficultyLevel}
              </span>
            </div>

            <div className="quiz-header-right">
              {secondsRemaining !== null && (
                <div
                  className={`quiz-timer-display ${
                    secondsRemaining < 60 ? "warning" : ""
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatTime(secondsRemaining)}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleToggleMarkForReview}
                className={`quiz-mark-review-btn ${
                  markedForReview.has(currentQ.id) ? "marked" : ""
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>
                  {markedForReview.has(currentQ.id) ? "Marked for Review" : "Mark for Review"}
                </span>
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="quiz-progress-track">
            <div
              className="quiz-progress-fill"
              style={{
                width: `${((currentIndex + 1) / questions.length) * 100}%`,
              }}
            />
          </div>

          {/* Question Palette */}
          <div className="quiz-palette-bar">
            {questions.map((q, idx) => {
              const isCurrent = idx === currentIndex;
              const hasAnswer = isQuestionAnswered(q);
              const isMarked = markedForReview.has(q.id);

              let statusClass = "unanswered";
              if (isCurrent) statusClass = "current";
              else if (hasAnswer) statusClass = "answered";

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`quiz-palette-btn ${statusClass} ${
                    isMarked ? "marked" : ""
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Question Box */}
          <div className="quiz-question-box">
            <div className="quiz-question-prompt-label">
              {currentQ.questionType === "MCQ"
                ? "Multiple Choice Question"
                : currentQ.questionType === "FILL_BLANK"
                ? "Fill in the Blank"
                : currentQ.questionType === "NUMERICAL"
                ? "Numerical Calculation"
                : currentQ.questionType === "FORMULA"
                ? "Mathematical Expression / Symbol"
                : "Conceptual Short Answer"}
            </div>
            <h4 className="quiz-question-prompt-text">{currentQ.questionText}</h4>

            {/* Render Multiple Choice Options */}
            {currentQ.questionType === "MCQ" && currentQ.options && (
              <div className="quiz-options-list">
                {currentQ.options.map((opt, optIdx) => {
                  const isSelected = currentAnswer?.userAnswerIndex === optIdx;
                  const letter = String.fromCharCode(65 + optIdx);
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelectOption(optIdx)}
                      className={`quiz-option-row ${isSelected ? "selected" : ""}`}
                    >
                      <div className="quiz-option-radio">
                        {isSelected && <div className="quiz-option-radio-dot" />}
                      </div>
                      <span className="quiz-option-label-letter">{letter}.</span>
                      <span className="quiz-option-text">{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Render Fill in the Blank Input */}
            {currentQ.questionType === "FILL_BLANK" && (
              <div className="quiz-input-box">
                <input
                  type="text"
                  value={currentAnswer?.userAnswerText || ""}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder="Type the missing word or phrase..."
                  className="quiz-text-input"
                />
              </div>
            )}

            {/* Render Numerical Input */}
            {currentQ.questionType === "NUMERICAL" && (
              <div className="quiz-input-box">
                <input
                  type="text"
                  value={currentAnswer?.userAnswerText || ""}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder="Enter numeric value (e.g. 5.0 or 1)..."
                  className="quiz-text-input"
                />
              </div>
            )}

            {/* Render Formula Input or Formula Options */}
            {currentQ.questionType === "FORMULA" && (
              <div className="quiz-input-box">
                {currentQ.options ? (
                  <div className="quiz-options-list">
                    {currentQ.options.map((opt, optIdx) => {
                      const isSelected = currentAnswer?.userAnswerIndex === optIdx;
                      const letter = String.fromCharCode(65 + optIdx);
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleSelectOption(optIdx)}
                          className={`quiz-option-row ${isSelected ? "selected" : ""}`}
                        >
                          <div className="quiz-option-radio">
                            {isSelected && <div className="quiz-option-radio-dot" />}
                          </div>
                          <span className="quiz-option-label-letter">{letter}.</span>
                          <span className="quiz-option-text font-mono">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={currentAnswer?.userAnswerText || ""}
                    onChange={(e) => handleTextChange(e.target.value)}
                    placeholder="Enter symbol or parameter (e.g. σ or sigma)..."
                    className="quiz-text-input"
                  />
                )}
              </div>
            )}

            {/* Render Short Answer Area */}
            {currentQ.questionType === "SHORT_ANSWER" && (
              <div className="quiz-input-box">
                <textarea
                  value={currentAnswer?.userAnswerText || ""}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder="Explain the concept in your own words..."
                  className="quiz-text-input quiz-textarea-input"
                />
              </div>
            )}
          </div>

          {error && <p className="text-rose-400 text-xs">{error}</p>}

          {/* Navigation & Submission Control Bar */}
          <div className="quiz-nav-bar">
            <div className="quiz-nav-left">
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="quiz-btn-nav quiz-btn-secondary"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <button
                type="button"
                onClick={handleClearAnswer}
                disabled={!currentAnswer}
                className="quiz-btn-nav quiz-btn-secondary"
              >
                <span>Clear Answer</span>
              </button>
            </div>

            {/* Submission Control Area */}
            <div className="quiz-submission-controls">
              <div className="quiz-submission-counts">
                <span className="quiz-count-badge quiz-count-answered">
                  Answered: <strong>{answeredCount}</strong>
                </span>
                <span className="quiz-count-badge quiz-count-unanswered">
                  Unanswered: <strong>{unansweredCount}</strong>
                </span>
                <span className="quiz-count-badge quiz-count-marked">
                  Marked for Review: <strong>{markedCount}</strong>
                </span>
              </div>

              <div className="quiz-nav-actions">
                {currentIndex + 1 < questions.length && (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                    className="quiz-btn-nav quiz-btn-accent"
                  >
                    <span>Next Question</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowSubmitModal(true)}
                  className="quiz-btn-nav quiz-btn-submit-cta"
                >
                  <span>Submit Quiz</span>
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 4. CONFIRMATION MODAL ================= */}
      {showSubmitModal && (
        <div className="quiz-modal-backdrop">
          <div className="quiz-modal-card">
            <h4 className="quiz-modal-title">Submit Quiz?</h4>
            <p className="quiz-modal-subtitle">
              Review your progress before final evaluation:
            </p>

            <div className="quiz-modal-stat-grid">
              <div className="quiz-modal-stat-box">
                <span className="quiz-modal-stat-num text-emerald-400">
                  {answeredCount}
                </span>
                <span className="quiz-modal-stat-label">Answered</span>
              </div>
              <div className="quiz-modal-stat-box">
                <span className="quiz-modal-stat-num text-slate-400">
                  {unansweredCount}
                </span>
                <span className="quiz-modal-stat-label">Unanswered</span>
              </div>
              <div className="quiz-modal-stat-box">
                <span className="quiz-modal-stat-num text-amber-400">
                  {markedCount}
                </span>
                <span className="quiz-modal-stat-label">Marked for Review</span>
              </div>
            </div>

            {unansweredCount > 0 && (
              <p className="text-xs text-amber-300/90 mb-4">
                ⚠️ You have {unansweredCount} unanswered question{unansweredCount > 1 ? "s" : ""}. Unanswered questions will be scored as 0.
              </p>
            )}

            <div className="quiz-modal-actions">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="quiz-btn-nav quiz-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={submitting}
                className="quiz-btn-nav quiz-btn-submit-cta"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Submit Quiz</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
