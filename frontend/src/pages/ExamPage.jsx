/**
 * ExamPage.jsx
 *
 * ─── CLOUD ARCHITECTURE ───────────────────────────────────────────────────────
 * Submission goes through the evaluateExam Cloud Function:
 *   Student answers → results_pending → Cloud Function evaluates → results → navigate
 *
 * ─── BUG-04 FIX (useCallback) ────────────────────────────────────────────────
 * All callbacks passed to child components are wrapped in useCallback.
 *
 * ─── SUBMIT-ONCE GUARD ───────────────────────────────────────────────────────
 * submittingRef prevents double-submission from simultaneous timer expiry
 * and manual submit button click.
 */

import React, {
  useState, useEffect, useCallback, useRef,
} from 'react';
import {
  Box, Typography, Grid, Paper, Button, Radio, RadioGroup,
  FormControlLabel, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Chip, LinearProgress,
} from '@mui/material';
import { CloudDone, ArrowBack, ArrowForward, BlockOutlined } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import Timer from '../components/Timer';
import QuestionPalette from '../components/QuestionPalette';
import LoadingSpinner from '../components/LoadingSpinner';
import { getExamById, normaliseAttemptPolicy } from '../services/examService';
import { submitPendingResult, getResultsByStudent } from '../services/resultService';
import { formatOptions } from '../utils/examUtils';
import useAuth from '../hooks/useAuth';
import { trackExamStarted, trackExamSubmitted } from '../services/analyticsService';
import { logAuditEvent } from '../services/auditService';
import { AUDIT_ACTIONS } from '../utils/auditActions';

const EVAL_MESSAGES = {
  submitting: 'Submitting your answers…',
  evaluating: 'Evaluating exam securely on the cloud…',
  fetching:   'Fetching your result…',
};

const ExamPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile, role } = useAuth();

  const [exam,             setExam]             = useState(null);
  const [currentQuestion,  setCurrentQuestion]  = useState(0);
  const [answers,          setAnswers]          = useState({});
  const [loading,          setLoading]          = useState(true);
  const [submitting,       setSubmitting]       = useState(false);
  const [evalStatus,       setEvalStatus]       = useState(null);
  const [error,            setError]            = useState('');
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  // Attempt tracking
  const [usedAttempts,     setUsedAttempts]     = useState(0);
  const [attemptBlocked,   setAttemptBlocked]   = useState(false);
  const [blockReason,      setBlockReason]      = useState('');

  const submittingRef = useRef(false);
  const syncSubmittingRef = (value) => {
    submittingRef.current = value;
    setSubmitting(value);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const examData = await getExamById(id);
        setExam(examData);

        /* ── Attempt policy check ── */
        if (currentUser) {
          const pastResults = await getResultsByStudent(currentUser.uid);
          const examResults = pastResults.filter((r) => r.examId === id);
          const count       = examResults.length;
          setUsedAttempts(count);

          const { attemptPolicy, maxAttempts } = normaliseAttemptPolicy(examData);

          if (attemptPolicy === 'single' && count >= 1) {
            setAttemptBlocked(true);
            setBlockReason('You have already completed this exam. Single-attempt exams cannot be retaken.');
            setLoading(false);
            return;
          }

          if (attemptPolicy === 'multiple' && maxAttempts !== null && count >= maxAttempts) {
            setAttemptBlocked(true);
            setBlockReason(
              `You have used all ${maxAttempts} allowed attempt${maxAttempts !== 1 ? 's' : ''} for this exam.`
            );
            setLoading(false);
            return;
          }
        }

        trackExamStarted(examData.id, examData.title);

        logAuditEvent({
          action:     AUDIT_ACTIONS.EXAM_STARTED,
          userId:     currentUser?.uid ?? 'anonymous',
          userRole:   role ?? 'student',
          targetId:   examData.id,
          targetType: 'exam',
          metadata:   { examTitle: examData.title, subject: examData.subject },
        });
      } catch (err) {
        setError('Failed to load exam. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const confirmSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    syncSubmittingRef(true);
    setShowSubmitDialog(false);

    try {
      const { resultId } = await submitPendingResult(
        {
          examId:        exam.id,
          studentId:     currentUser.uid,
          studentName:   userProfile?.name || currentUser.displayName || 'Student',
          examTitle:     exam.title,
          subject:       exam.subject,
          answers,
          attemptNumber: usedAttempts + 1,  // 1-based attempt number
        },
        { onStatusChange: (status) => setEvalStatus(status) }
      );

      trackExamSubmitted(exam.id, 0);

      logAuditEvent({
        action:     AUDIT_ACTIONS.EXAM_SUBMITTED,
        userId:     currentUser?.uid ?? 'anonymous',
        userRole:   role ?? 'student',
        targetId:   exam.id,
        targetType: 'exam',
        metadata: {
          examTitle:      exam.title,
          subject:        exam.subject,
          resultId,
          answeredCount:  Object.keys(answers).length,
          totalQuestions: exam.questions?.length ?? 0,
        },
      });

      navigate(`/result/${resultId}`);

    } catch (err) {
      setError(err.message || 'Submission failed. Please try again.');
      setEvalStatus(null);
      syncSubmittingRef(false);
    }
  }, [answers, exam, currentUser, role, userProfile, navigate, usedAttempts]);

  const handleTimeUp = useCallback(() => { confirmSubmit(); }, [confirmSubmit]);

  const handleAnswerChange = useCallback((questionId, answer) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }, []);

  const handleQuestionClick = useCallback((index) => {
    setCurrentQuestion(index);
  }, []);

  const handlePrevious = useCallback(() => {
    setCurrentQuestion((q) => Math.max(q - 1, 0));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentQuestion((q) => Math.min(q + 1, (exam?.questions?.length ?? 1) - 1));
  }, [exam]);

  if (loading) return <LoadingSpinner message="Loading exam…" />;
  if (error)   return <Alert severity="error" sx={{ m: 3 }}>{error}</Alert>;

  /* ── Attempt blocked screen ── */
  if (attemptBlocked) {
    const { attemptPolicy } = normaliseAttemptPolicy(exam ?? {});
    return (
      <Box sx={{ maxWidth: 560, mx: 'auto', mt: 6, textAlign: 'center' }}>
        <Box
          sx={{
            width: 72, height: 72, borderRadius: '50%',
            backgroundColor: '#FEF2F2', display: 'flex',
            alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3,
          }}
        >
          <BlockOutlined sx={{ fontSize: 36, color: '#EF4444' }} />
        </Box>
        <Typography sx={{ fontWeight: 700, fontSize: '1.375rem', color: '#0F172A', mb: 1 }}>
          {attemptPolicy === 'single' ? 'Exam Already Completed' : 'Maximum Attempts Reached'}
        </Typography>
        <Typography sx={{ color: '#64748B', mb: 3, lineHeight: 1.6 }}>
          {blockReason}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={() => navigate('/student/results')} sx={{ fontWeight: 600 }}>
            View My Results
          </Button>
          <Button
            variant="contained"
            onClick={() => navigate('/student/exams')}
            sx={{ fontWeight: 600, background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}
          >
            Browse Other Exams
          </Button>
        </Box>
      </Box>
    );
  }

  if (!exam) return <Alert severity="error" sx={{ m: 3 }}>Exam not found</Alert>;

  const currentQuestionData = exam.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / exam.questions.length) * 100;
  const answeredCount = Object.keys(answers).length;

  const displayOptions = currentQuestionData.options?.length
    ? currentQuestionData.options[0].includes(')')
      ? currentQuestionData.options
      : formatOptions(currentQuestionData.options)
    : [];

  return (
    <Box>
      {/* ── Cloud evaluation overlay ── */}
      {submitting && (
        <Box
          sx={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(255,255,255,0.96)',
            zIndex: 9999,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 3,
          }}
        >
          <CircularProgress size={60} thickness={3} sx={{ color: '#4F46E5' }} />
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A', mb: 0.75 }}>
              {evalStatus ? EVAL_MESSAGES[evalStatus] : 'Please wait…'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <CloudDone sx={{ color: '#4F46E5', fontSize: 18 }} />
              <Typography variant="body2" sx={{ color: '#64748B' }}>
                Answers are being graded securely on Google Cloud
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* ── Exam Header ── */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Grid item xs={12} md={7}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F172A', mb: 0.25 }}>
              {exam.title}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="body2" sx={{ color: '#64748B' }}>{exam.subject}</Typography>
              <Chip
                label={`${exam.questions.length} questions`}
                size="small"
                sx={{ height: 20, fontSize: '0.6875rem', fontWeight: 600, backgroundColor: '#EEF2FF', color: '#4F46E5' }}
              />
              <Chip
                label={`${answeredCount} answered`}
                size="small"
                sx={{
                  height: 20, fontSize: '0.6875rem', fontWeight: 600,
                  backgroundColor: answeredCount > 0 ? '#ECFDF5' : '#F1F5F9',
                  color: answeredCount > 0 ? '#15803D' : '#64748B',
                }}
              />
              {/* Attempt number chip for multiple-attempt exams */}
              {(exam.attemptPolicy ?? 'single') === 'multiple' && (
                <Chip
                  label={`Attempt ${usedAttempts + 1}${exam.maxAttempts ? ` / ${exam.maxAttempts}` : ''}`}
                  size="small"
                  sx={{ height: 20, fontSize: '0.6875rem', fontWeight: 700, backgroundColor: '#FFFBEB', color: '#92400E' }}
                />
              )}
            </Box>
          </Grid>
          <Grid item xs={12} md={5} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
            <Timer duration={exam.duration} onTimeUp={handleTimeUp} />
          </Grid>
        </Grid>

        {/* Progress */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 500 }}>
              Question {currentQuestion + 1} of {exam.questions.length}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 500 }}>
              {Math.round(progress)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 5,
              '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #4F46E5, #7C3AED)' },
            }}
          />
        </Box>
      </Paper>

      <Grid container spacing={3}>
        {/* ── Question Card ── */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, minHeight: 400 }}>
            <Typography variant="overline" sx={{ color: '#4F46E5', fontWeight: 600, letterSpacing: '0.08em' }}>
              Question {currentQuestion + 1}
            </Typography>
            <Typography
              variant="h6"
              sx={{ fontWeight: 600, color: '#0F172A', mb: 3, mt: 0.5, lineHeight: 1.5 }}
            >
              {currentQuestionData.question}
            </Typography>

            <RadioGroup
              value={answers[currentQuestionData.id] || ''}
              onChange={(e) => handleAnswerChange(currentQuestionData.id, e.target.value)}
            >
              {displayOptions.map((option, index) => {
                const optionValue = option.charAt(0);
                const isSelected = answers[currentQuestionData.id] === optionValue;
                return (
                  <FormControlLabel
                    key={index}
                    value={optionValue}
                    control={<Radio sx={{ color: '#CBD5E1', '&.Mui-checked': { color: '#4F46E5' } }} />}
                    label={
                      <Typography variant="body2" sx={{ fontWeight: isSelected ? 600 : 400, color: isSelected ? '#4F46E5' : '#334155' }}>
                        {option}
                      </Typography>
                    }
                    sx={{
                      mb: 1.5,
                      p: 1.5,
                      borderRadius: '10px',
                      border: '1px solid',
                      borderColor: isSelected ? '#C7D2FE' : '#E5E7EB',
                      backgroundColor: isSelected ? '#EEF2FF' : '#ffffff',
                      width: '100%',
                      mx: 0,
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        borderColor: '#A5B4FC',
                        backgroundColor: '#F5F3FF',
                      },
                    }}
                  />
                );
              })}
            </RadioGroup>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button
                variant="outlined"
                startIcon={<ArrowBack />}
                onClick={handlePrevious}
                disabled={currentQuestion === 0 || submitting}
                sx={{ fontWeight: 600 }}
              >
                Previous
              </Button>
              <Box sx={{ display: 'flex', gap: 2 }}>
                {currentQuestion === exam.questions.length - 1 ? (
                  <Button
                    variant="contained"
                    onClick={() => setShowSubmitDialog(true)}
                    disabled={submitting}
                    sx={{
                      fontWeight: 600,
                      background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                      '&:hover': { background: 'linear-gradient(135deg, #4338CA, #6D28D9)' },
                    }}
                  >
                    Submit Exam
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    endIcon={<ArrowForward />}
                    onClick={handleNext}
                    disabled={submitting}
                    sx={{
                      fontWeight: 600,
                      background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                      '&:hover': { background: 'linear-gradient(135deg, #4338CA, #6D28D9)' },
                    }}
                  >
                    Next
                  </Button>
                )}
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* ── Question Palette ── */}
        <Grid item xs={12} md={4}>
          <QuestionPalette
            questions={exam.questions}
            currentQuestion={currentQuestionData.id}
            answers={answers}
            onQuestionClick={handleQuestionClick}
          />
        </Grid>
      </Grid>

      {/* ── Submit Dialog ── */}
      <Dialog
        open={showSubmitDialog}
        onClose={() => !submitting && setShowSubmitDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Submit Exam?</DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 1 }}>
            <Typography variant="body1" gutterBottom>
              You have answered{' '}
              <Box component="span" sx={{ fontWeight: 700, color: '#4F46E5' }}>
                {answeredCount}
              </Box>
              {' '}out of{' '}
              <Box component="span" sx={{ fontWeight: 700 }}>
                {exam.questions.length}
              </Box>
              {' '}questions.
            </Typography>
            {answeredCount < exam.questions.length && (
              <Alert severity="warning" sx={{ mt: 2, textAlign: 'left' }}>
                {exam.questions.length - answeredCount} question{exam.questions.length - answeredCount !== 1 ? 's' : ''} left unanswered.
              </Alert>
            )}
            <Typography variant="body2" sx={{ color: '#64748B', mt: 2 }}>
              Your exam will be evaluated securely on Google Cloud. You cannot change answers after submitting.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button variant="outlined" onClick={() => setShowSubmitDialog(false)} disabled={submitting} sx={{ flex: 1 }}>
            Review
          </Button>
          <Button
            variant="contained"
            onClick={confirmSubmit}
            disabled={submitting}
            sx={{
              flex: 1,
              fontWeight: 600,
              background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
              '&:hover': { background: 'linear-gradient(135deg, #4338CA, #6D28D9)' },
            }}
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExamPage;
