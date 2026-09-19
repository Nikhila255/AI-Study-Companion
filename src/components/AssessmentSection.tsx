"use client";

import React, { useState, useEffect } from "react";
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
  Check,
  BarChart3,
  HelpCircle,
  CheckSquare,
  Square,
} from "lucide-react";
import { AssessmentQuestionType, ReviewedAssessmentQuestion, AssessmentBatchResult } from "@/lib/assessment-service";

interface AssessmentQuestion {
  id: string;
  conceptId?: string;
  conceptName?: string;
  questionType: AssessmentQuestionType;
  questionText: string;
  options?: string[] | null;
  difficultyLevel: "EASY" | "MEDIUM" | "HARD";
  orderIndex: number;
  sourceCitation: string;
}

interface QuestionAnswerState {
  selectedOptionIndex?: number | null;
  answerText?: string;
}

interface AssessmentSectionProps {
  projectId: string;
  materialId?: string;
  materialName?: string;
  onMasteryUpdated?: () => void;
}

export default function AssessmentSection({
  projectId,
  materialId,
  materialName,
  onMasteryUpdated,
}: AssessmentSectionProps) {
  // Assessment Configuration State
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [selectedTypes, setSelectedTypes] = useState<AssessmentQuestionType[]>([
    "MCQ",
    "FILL_BLANK",
    "SHORT_ANSWER",
    "CONCEPTUAL",
  ]);
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD" | "MIXED">("MIXED");

  // Assessment Execution State
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // User answers keyed by question ID
  const [userAnswers, setUserAnswers] = useState<Record<string, QuestionAnswerState>>({});

  // Confirmation Modal & Results
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [results, setResults] = useState<AssessmentBatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeDocName = materialName || "Unit-V_InstanceBasedLearning.pdf";

  // Toggle a question type (prevent unchecking all)
  const toggleQuestionType = (type: AssessmentQuestionType) => {
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev; // Keep at least one type
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  // Start Assessment
  const handleStartAssessment = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    setUserAnswers({});
    setCurrentIndex(0);

    try {
      const res = await fetch(`/api/projects/${projectId}/assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "GENERATE",
          questionCount,
          questionTypes: selectedTypes,
          difficulty,
          materialId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start assessment.");

      setAssessmentId(data.assessmentId);
      setQuestions(data.questions || []);
    } catch (err: any) {
      setError(err.message || "Failed to start assessment.");
    } finally {
      setLoading(false);
    }
  };

  const currentQ = questions[currentIndex];
  const currentAnswer = currentQ ? userAnswers[currentQ.id] : undefined;

  // Handle MCQ selection
  const handleSelectOption = (optIdx: number) => {
    if (!currentQ) return;
    setUserAnswers((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        selectedOptionIndex: optIdx,
      },
    }));
  };

  // Handle text input (Fill blank, short answer, conceptual)
  const handleTextChange = (text: string) => {
    if (!currentQ) return;
    setUserAnswers((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        answerText: text,
      },
    }));
  };

  // Check if a question is answered
  const isQuestionAnswered = (q: AssessmentQuestion) => {
    const ans = userAnswers[q.id];
    if (!ans) return false;
    if (q.questionType === "MCQ") {
      return typeof ans.selectedOptionIndex === "number" && ans.selectedOptionIndex >= 0;
    }
    return typeof ans.answerText === "string" && ans.answerText.trim().length > 0;
  };

  const answeredCount = questions.filter(isQuestionAnswered).length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);

  // Submit complete assessment
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
          selectedOptionIndex: ans?.selectedOptionIndex ?? null,
          answerText: ans?.answerText ?? null,
        };
      });

      const res = await fetch(`/api/projects/${projectId}/assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SUBMIT_ASSESSMENT",
          assessmentId,
          answers: answersPayload,
        }),
      });

      const data: AssessmentBatchResult = await res.json();
      if (!res.ok) throw new Error((data as any).error || "Failed to evaluate assessment.");

      setResults(data);
      if (onMasteryUpdated) onMasteryUpdated();
    } catch (err: any) {
      setError(err.message || "Failed to evaluate assessment submission.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetToSetup = () => {
    setQuestions([]);
    setAssessmentId(null);
    setResults(null);
    setUserAnswers({});
    setCurrentIndex(0);
    setError(null);
  };

  return (
    <div className="assessment-container">
      {questions.length === 0 ? (
        /* ================= 1. ASSESSMENT SETUP SCREEN ================= */
        <div className="assessment-setup-wrapper">
          <div className="assessment-setup-header">
            <div className="assessment-icon-badge">
              <Award className="w-8 h-8" />
            </div>
            <h3 className="assessment-title">AI-Powered Assessment</h3>
            <p className="assessment-subtitle">
              Test your understanding with document-grounded questions and intelligent feedback.
            </p>
          </div>

          {/* STUDY MATERIAL CARD */}
          <div className="assessment-card-section">
            <div className="assessment-section-header">
              <label className="assessment-section-label">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Study Material</span>
              </label>
            </div>
            <div className="assessment-material-box">
              <div className="assessment-material-icon-wrap">
                <FileText className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="assessment-material-info">
                <span className="assessment-material-name">{activeDocName}</span>
                <span className="assessment-material-desc">
                  Questions will be generated from this study material.
                </span>
              </div>
            </div>
          </div>

          {/* CONFIGURATION: NUMBER OF QUESTIONS */}
          <div className="assessment-card-section">
            <div className="assessment-section-header">
              <label className="assessment-section-label">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span>Number of Questions</span>
              </label>
            </div>
            <div className="assessment-count-grid">
              {[5, 10, 15, 20].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setQuestionCount(num)}
                  className={`assessment-count-btn ${questionCount === num ? "active" : ""}`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* CONFIGURATION: QUESTION TYPES */}
          <div className="assessment-card-section">
            <div className="assessment-section-header">
              <label className="assessment-section-label">
                <CheckSquare className="w-4 h-4 text-indigo-400" />
                <span>Question Types</span>
              </label>
            </div>
            <div className="assessment-types-grid">
              {[
                { type: "MCQ" as AssessmentQuestionType, label: "Multiple Choice", desc: "Selectable options" },
                { type: "FILL_BLANK" as AssessmentQuestionType, label: "Fill in the Blank", desc: "Missing key terms & numbers" },
                { type: "SHORT_ANSWER" as AssessmentQuestionType, label: "Short Answer", desc: "Concise definitions & facts" },
                { type: "CONCEPTUAL" as AssessmentQuestionType, label: "Conceptual Answer", desc: "In-depth reasoning & rubrics" },
              ].map((item) => {
                const isChecked = selectedTypes.includes(item.type);
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => toggleQuestionType(item.type)}
                    className={`assessment-type-card ${isChecked ? "active" : ""}`}
                  >
                    <div className="assessment-type-card-top">
                      <div className={`assessment-checkbox ${isChecked ? "checked" : ""}`}>
                        {isChecked && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <span className="assessment-type-title">{item.label}</span>
                    </div>
                    <span className="assessment-type-desc">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CONFIGURATION: DIFFICULTY */}
          <div className="assessment-card-section">
            <div className="assessment-section-header">
              <label className="assessment-section-label">
                <Target className="w-4 h-4 text-indigo-400" />
                <span>Difficulty</span>
              </label>
            </div>
            <div className="assessment-diff-grid">
              {[
                { id: "EASY", label: "Easy" },
                { id: "MEDIUM", label: "Medium" },
                { id: "HARD", label: "Hard" },
                { id: "MIXED", label: "Mixed" },
              ].map((lvl) => {
                const isSelected = difficulty === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setDifficulty(lvl.id as any)}
                    className={`assessment-diff-radio-btn ${isSelected ? "active" : ""}`}
                  >
                    <div className="assessment-radio-circle">
                      {isSelected && <div className="assessment-radio-dot" />}
                    </div>
                    <span className="assessment-diff-label">{lvl.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* START BUTTON */}
          <button
            onClick={handleStartAssessment}
            disabled={loading || selectedTypes.length === 0}
            className="assessment-btn-start"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            <span>Start Assessment</span>
          </button>
          {error && <p className="text-rose-400 text-xs text-center mt-3">{error}</p>}
        </div>
      ) : results ? (
        /* ================= 2. RESULTS & RUBRIC REVIEW ================= */
        <div className="assessment-results-wrapper">
          <div className="assessment-results-hero">
            <div
              className={`assessment-hero-icon-circle ${
                results.accuracy >= 75 ? "pass" : "review"
              }`}
            >
              {results.accuracy >= 75 ? (
                <CheckCircle2 className="w-10 h-10" />
              ) : (
                <AlertCircle className="w-10 h-10" />
              )}
            </div>
            <h3 className="assessment-title">Assessment Complete</h3>
            <p className="text-sm text-slate-400">
              {results.accuracy >= 75
                ? "Excellent job! You have demonstrated strong understanding across these concepts."
                : "Assessment evaluated! Review the detailed rubric feedback below to reinforce your knowledge."}
            </p>
          </div>

          {/* STAT CARDS */}
          <div className="assessment-stat-cards-grid">
            <div className="assessment-stat-card">
              <div className="assessment-stat-card-title">Overall Score</div>
              <div className="assessment-stat-card-value text-indigo-400">
                {results.overallScore} / 100
              </div>
            </div>
            <div className="assessment-stat-card">
              <div className="assessment-stat-card-title">Accuracy</div>
              <div
                className={`assessment-stat-card-value ${
                  results.accuracy >= 75
                    ? "text-emerald-400"
                    : results.accuracy >= 50
                    ? "text-amber-400"
                    : "text-rose-400"
                }`}
              >
                {results.accuracy}%
              </div>
            </div>
            <div className="assessment-stat-card">
              <div className="assessment-stat-card-title">Questions</div>
              <div className="assessment-stat-card-value text-slate-200">
                {results.totalCount}
              </div>
            </div>
            <div className="assessment-stat-card">
              <div className="assessment-stat-card-title">Answered</div>
              <div className="assessment-stat-card-value text-emerald-400">
                {results.answeredCount}
              </div>
            </div>
            <div className="assessment-stat-card">
              <div className="assessment-stat-card-title">Unanswered</div>
              <div className="assessment-stat-card-value text-slate-400">
                {results.unansweredCount}
              </div>
            </div>
          </div>

          {/* QUESTION PERFORMANCE STRIP */}
          <div className="assessment-card-section">
            <h4 className="assessment-section-label mb-3">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              <span>Question Performance</span>
            </h4>
            <div className="assessment-performance-strip">
              {results.reviewedQuestions.map((rq, idx) => (
                <div
                  key={rq.questionId}
                  className={`assessment-perf-item ${
                    rq.isCorrect ? "correct" : "review"
                  }`}
                >
                  <span className="assessment-perf-num">Q{idx + 1}</span>
                  <span className="assessment-perf-status">
                    {rq.isCorrect ? "✓ Correct" : "Needs Improvement"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CONCEPTUAL PERFORMANCE BREAKDOWN */}
          <div className="assessment-card-section">
            <h4 className="assessment-section-label mb-4">
              <Target className="w-4 h-4 text-indigo-400" />
              <span>Conceptual Understanding</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="assessment-concept-box strong">
                <span className="assessment-concept-box-title text-emerald-400">
                  Strong Areas
                </span>
                {results.strongAreas.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {results.strongAreas.map((area, i) => (
                      <span key={i} className="assessment-concept-pill strong">
                        ✓ {area}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mt-2">Keep practicing to build strong mastery areas.</p>
                )}
              </div>

              <div className="assessment-concept-box needs-work">
                <span className="assessment-concept-box-title text-amber-400">
                  Needs Improvement
                </span>
                {results.needsImprovement.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {results.needsImprovement.map((area, i) => (
                      <span key={i} className="assessment-concept-pill needs-work">
                        • {area}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mt-2">No critical weaknesses identified!</p>
                )}
              </div>
            </div>
          </div>

          {/* DETAILED QUESTION REVIEW */}
          <div className="assessment-card-section">
            <h4 className="assessment-section-label mb-4">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <span>Question Review</span>
            </h4>

            <div className="space-y-6">
              {results.reviewedQuestions.map((rq, idx) => (
                <div
                  key={rq.questionId}
                  className={`assessment-review-item ${rq.isCorrect ? "correct" : "review"}`}
                >
                  <div className="assessment-review-header">
                    <span className="text-xs text-slate-400 font-semibold">
                      Question {idx + 1} of {results.reviewedQuestions.length} ·{" "}
                      <strong className="text-slate-300">{rq.conceptName}</strong>
                    </span>
                    <span className={`assessment-review-badge ${rq.isCorrect ? "correct" : "review"}`}>
                      {rq.isCorrect ? "✓ Correct" : "Needs Improvement"}
                    </span>
                  </div>

                  <h5 className="assessment-review-prompt">{rq.questionText}</h5>

                  {/* USER ANSWER & CORRECT ANSWER DISPLAY */}
                  <div className="assessment-review-answers-grid">
                    <div className="assessment-review-cell">
                      <span className="assessment-review-cell-label">Your Answer</span>
                      <div className="assessment-review-cell-value">{rq.userAnswer}</div>
                    </div>

                    {rq.correctAnswer && (
                      <div className="assessment-review-cell">
                        <span className="assessment-review-cell-label">Correct Answer</span>
                        <div className="assessment-review-cell-value text-emerald-400">
                          {rq.correctAnswer}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AI EVALUATION RUBRIC FOR WRITTEN QUESTIONS */}
                  {rq.aiEvaluation && (
                    <div className="assessment-rubric-box">
                      <div className="assessment-rubric-grid">
                        <div className="assessment-rubric-dim">
                          <span className="assessment-rubric-dim-label">Understanding</span>
                          <span
                            className={`assessment-rubric-dim-value ${
                              rq.aiEvaluation.understanding === "Strong"
                                ? "text-emerald-400"
                                : rq.aiEvaluation.understanding === "Good"
                                ? "text-indigo-400"
                                : "text-amber-400"
                            }`}
                          >
                            {rq.aiEvaluation.understanding}
                          </span>
                        </div>
                        <div className="assessment-rubric-dim">
                          <span className="assessment-rubric-dim-label">Accuracy</span>
                          <span
                            className={`assessment-rubric-dim-value ${
                              rq.aiEvaluation.accuracy === "Strong"
                                ? "text-emerald-400"
                                : rq.aiEvaluation.accuracy === "Good"
                                ? "text-indigo-400"
                                : "text-amber-400"
                            }`}
                          >
                            {rq.aiEvaluation.accuracy}
                          </span>
                        </div>
                        <div className="assessment-rubric-dim">
                          <span className="assessment-rubric-dim-label">Completeness</span>
                          <span
                            className={`assessment-rubric-dim-value ${
                              rq.aiEvaluation.completeness === "Strong"
                                ? "text-emerald-400"
                                : rq.aiEvaluation.completeness === "Good"
                                ? "text-indigo-400"
                                : "text-amber-400"
                            }`}
                          >
                            {rq.aiEvaluation.completeness}
                          </span>
                        </div>
                        <div className="assessment-rubric-dim">
                          <span className="assessment-rubric-dim-label">Key Points Covered</span>
                          <span className="assessment-rubric-dim-value text-slate-200">
                            {rq.aiEvaluation.keyPointsCovered}
                          </span>
                        </div>
                      </div>

                      {rq.aiEvaluation.missingPoints && (
                        <div className="assessment-missing-box">
                          <span className="assessment-missing-label">Missing Point</span>
                          <p className="assessment-missing-text">{rq.aiEvaluation.missingPoints}</p>
                        </div>
                      )}

                      <div className="assessment-feedback-box">
                        <span className="assessment-feedback-label">Feedback</span>
                        <p className="assessment-feedback-text">{rq.aiEvaluation.feedback}</p>
                      </div>
                    </div>
                  )}

                  {/* EXPLANATION */}
                  <div className="assessment-review-explanation-box">
                    <span className="text-xs font-bold text-indigo-300 block mb-1">
                      Explanation:
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed">{rq.explanation}</p>
                  </div>

                  {/* SOURCE */}
                  <div className="assessment-review-source-tag">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Source:</span>
                    <strong>{rq.sourceCitation}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ACTION BUTTON */}
          <div className="flex justify-center pt-4 mb-6">
            <button
              onClick={resetToSetup}
              className="assessment-btn-start max-w-xs"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Start Another Assessment</span>
            </button>
          </div>
        </div>
      ) : (
        /* ================= 3. ACTIVE QUESTION SCREEN ================= */
        <div className="assessment-active-wrapper">
          {/* HEADER BAR */}
          <div className="assessment-active-header">
            <div className="assessment-header-left">
              <span className="assessment-header-title">AI-Powered Assessment</span>
              <div className="assessment-material-tag">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>{activeDocName}</span>
              </div>
            </div>

            <div className="assessment-header-right">
              <span className="assessment-progress-badge">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span className="assessment-type-pill">
                {currentQ.questionType === "MCQ"
                  ? "Multiple Choice"
                  : currentQ.questionType === "FILL_BLANK"
                  ? "Fill in the Blank"
                  : currentQ.questionType === "SHORT_ANSWER"
                  ? "Short Answer"
                  : "Conceptual Answer"}
              </span>
            </div>
          </div>

          {/* PROGRESS BAR */}
          <div className="assessment-progress-track">
            <div
              className="assessment-progress-fill"
              style={{
                width: `${((currentIndex + 1) / questions.length) * 100}%`,
              }}
            />
          </div>

          {/* QUESTION BOX */}
          <div className="assessment-question-box">
            <div className="assessment-question-prompt-type">
              Question Type:{" "}
              <strong>
                {currentQ.questionType === "MCQ"
                  ? "Multiple Choice"
                  : currentQ.questionType === "FILL_BLANK"
                  ? "Fill in the Blank"
                  : currentQ.questionType === "SHORT_ANSWER"
                  ? "Short Answer"
                  : "Conceptual Answer"}
              </strong>
            </div>
            <h4 className="assessment-question-prompt-text">{currentQ.questionText}</h4>

            {/* 1. TYPE 1: MCQ OPTIONS */}
            {currentQ.questionType === "MCQ" && currentQ.options && (
              <div className="assessment-options-list">
                {currentQ.options.map((opt, optIdx) => {
                  const isSelected = currentAnswer?.selectedOptionIndex === optIdx;
                  const letter = String.fromCharCode(65 + optIdx);
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelectOption(optIdx)}
                      className={`assessment-option-row ${isSelected ? "selected" : ""}`}
                    >
                      <div className="assessment-option-radio">
                        {isSelected && <div className="assessment-option-radio-dot" />}
                      </div>
                      <span className="assessment-option-letter">{letter}.</span>
                      <span className="assessment-option-text">{opt}</span>
                      {isSelected && (
                        <span className="assessment-option-selected-label">
                          ✓ Selected
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 2. TYPE 2: FILL IN THE BLANK */}
            {currentQ.questionType === "FILL_BLANK" && (
              <div className="assessment-input-box">
                <input
                  type="text"
                  value={currentAnswer?.answerText || ""}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder="Type your answer here..."
                  className="assessment-text-input"
                />
              </div>
            )}

            {/* 3. TYPE 3: SHORT ANSWER */}
            {currentQ.questionType === "SHORT_ANSWER" && (
              <div className="assessment-input-box">
                <textarea
                  value={currentAnswer?.answerText || ""}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder="Type your answer in your own words..."
                  className="assessment-text-input assessment-textarea-medium"
                />
                <div className="assessment-char-count">
                  Character count: {(currentAnswer?.answerText || "").length}
                </div>
              </div>
            )}

            {/* 4. TYPE 4: CONCEPTUAL ANSWER */}
            {currentQ.questionType === "CONCEPTUAL" && (
              <div className="assessment-input-box">
                <textarea
                  value={currentAnswer?.answerText || ""}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder="Explain the concept in your own words..."
                  className="assessment-text-input assessment-textarea-large"
                />
                <div className="assessment-textarea-footer">
                  <span className="assessment-guide-hint">
                    Use information from the study material to support your answer.
                  </span>
                  <span className="assessment-char-count">
                    Character count: {(currentAnswer?.answerText || "").length}
                  </span>
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-rose-400 text-xs">{error}</p>}

          {/* NAVIGATION BAR */}
          <div className="assessment-nav-bar">
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="assessment-btn-nav assessment-btn-secondary"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <div className="assessment-nav-right">
              {currentIndex + 1 < questions.length ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  className="assessment-btn-nav assessment-btn-accent"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(true)}
                  className="assessment-btn-nav assessment-btn-submit"
                >
                  <span>Submit Assessment</span>
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= 4. CONFIRMATION MODAL ================= */}
      {showSubmitModal && (
        <div className="assessment-modal-backdrop">
          <div className="assessment-modal-card">
            <h4 className="assessment-modal-title">Submit Assessment?</h4>
            <p className="assessment-modal-subtitle">
              You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
              {unansweredCount > 0 && (
                <span className="block mt-1 text-amber-300">
                  {unansweredCount} question{unansweredCount > 1 ? "s are" : " is"} unanswered.
                </span>
              )}
              <span className="block mt-2">Are you sure you want to submit?</span>
            </p>

            <div className="assessment-modal-actions">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="assessment-btn-nav assessment-btn-secondary"
              >
                Continue Assessment
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={submitting}
                className="assessment-btn-nav assessment-btn-submit"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Submit</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
