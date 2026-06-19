import { PASS_THRESHOLD, RESULT_STATUS } from './constants';

/**
 * Calculate exam score from student answers and question definitions.
 *
 * @param {Object} answers        - { [questionId]: 'A' | 'B' | 'C' | 'D' }
 * @param {Array}  questions      - Firestore question documents
 * @returns {{ score, totalMarks, percentage, status }}
 */
export const calculateResult = (answers, questions) => {
  let score = 0;
  let totalMarks = 0;

  questions.forEach((question) => {
    const questionMarks = Number(question.marks) || 0;
    totalMarks += questionMarks;

    const studentAnswer = answers[question.id]?.toUpperCase();
    const correct = question.correctAnswer?.toUpperCase();

    if (studentAnswer && studentAnswer === correct) {
      score += questionMarks;
    }
  });

  const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  const status = percentage >= PASS_THRESHOLD ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL;

  return { score, totalMarks, percentage, status };
};

/**
 * Generate a plain-text result report string for download.
 *
 * Strict separation: marks fields and question count fields are never mixed.
 */
export const generateReportText = (result) => {
  // ── MARKS ──────────────────────────────────────────────────────────────
  const obtainedMarks = result?.obtainedMarks ?? result?.score ?? 0;
  const totalMarks    = result?.totalMarks ?? 0;

  // ── QUESTION COUNTS ────────────────────────────────────────────────────
  const correctAnswers = result?.correctAnswers ?? 0;
  const wrongAnswers   = result?.wrongAnswers   ?? 0;
  const unanswered     = result?.unanswered     ?? 0;
  const totalQuestions = correctAnswers + wrongAnswers + unanswered;

  return `
EXAM RESULT REPORT
==================
Exam            : ${result?.examTitle   ?? 'N/A'}
Subject         : ${result?.subject     ?? 'N/A'}
Student         : ${result?.studentName ?? 'N/A'}

MARKS
-----
Marks Obtained  : ${obtainedMarks} / ${totalMarks}
Percentage      : ${result?.percentage ?? 0}%
Passing Marks   : ${Math.ceil(totalMarks * 0.5)} / ${totalMarks}
Status          : ${result?.status?.toUpperCase() ?? 'N/A'}

QUESTIONS
---------
Total Questions : ${totalQuestions}
Correct Answers : ${correctAnswers}
Wrong Answers   : ${wrongAnswers}
Unanswered      : ${unanswered}

Submitted       : ${result?.submittedAt ? new Date(result.submittedAt).toLocaleString() : 'N/A'}
  `.trim();
};

/**
 * Compute aggregate statistics from an array of result objects.
 */
export const computeStudentStats = (results = []) => {
  if (results.length === 0) {
    return { totalExams: 0, passed: 0, failed: 0, averageScore: 0 };
  }

  const passed = results.filter((r) => r.status === RESULT_STATUS.PASS).length;
  const failed = results.length - passed;
  const averageScore = Math.round(
    results.reduce((sum, r) => sum + (r.percentage || 0), 0) / results.length
  );

  return { totalExams: results.length, passed, failed, averageScore };
};
