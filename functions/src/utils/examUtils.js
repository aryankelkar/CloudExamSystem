/**
 * examUtils.js — Cloud Functions edition
 *
 * Server-side evaluation logic.
 * correctAnswer values are processed ONLY here — never returned to the client.
 */

const { PASS_THRESHOLD } = require('./constants');

/**
 * Evaluate a student's answers against the exam's questions.
 *
 * @param {Object} answers     - { [questionId]: 'A' | 'B' | 'C' | 'D' }
 * @param {Object[]} questions - Question documents from Firestore sub-collection
 *                               Each document: { id, correctAnswer, marks, ... }
 * @returns {{
 *   obtainedMarks: number,
 *   totalMarks: number,
 *   correctAnswers: number,
 *   wrongAnswers: number,
 *   unanswered: number,
 *   percentage: number,
 *   status: 'pass' | 'fail'
 * }}
 */
const evaluateAnswers = (answers = {}, questions = []) => {
  let obtainedMarks = 0;
  let totalMarks = 0;
  let correctAnswers = 0;
  let wrongAnswers = 0;
  let unanswered = 0;

  for (const question of questions) {
    const marks = Number(question.marks) || 0;
    totalMarks += marks;

    const studentAnswer = answers[question.id]?.toUpperCase?.() ?? null;
    // correctAnswer lives ONLY in the Cloud Function — never sent to client
    const correctAnswer = question.correctAnswer?.toUpperCase?.() ?? null;

    if (!studentAnswer) {
      unanswered += 1;
    } else if (studentAnswer === correctAnswer) {
      obtainedMarks += marks;
      correctAnswers += 1;
    } else {
      wrongAnswers += 1;
    }
  }

  const percentage =
    totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 100) : 0;

  const status = percentage >= PASS_THRESHOLD ? 'pass' : 'fail';

  return {
    obtainedMarks,
    totalMarks,
    correctAnswers,
    wrongAnswers,
    unanswered,
    percentage,
    status,
  };
};

module.exports = { evaluateAnswers };
