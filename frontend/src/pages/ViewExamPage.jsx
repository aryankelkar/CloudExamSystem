/**
 * ViewExamPage.jsx  —  /faculty/view-exam/:examId
 *
 * Read-only exam preview for faculty.
 * Shows all exam metadata + every question with options and correct answers.
 * No editing allowed — purely informational.
 *
 * Firebase calls: getExamById() — unchanged, existing service function.
 */

import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, Alert, Button, Divider,
} from '@mui/material';
import {
  ArrowBack, AccessTime, QuestionAnswer, CalendarToday,
  CheckCircle, Subject, Edit,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { getExamById } from '../services/examService';
import { formatExamDate } from '../utils/examUtils';
import LoadingSpinner from '../components/LoadingSpinner';

/* ─── Status badge colours ─────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  active:    { label: 'Active',    bg: '#DCFCE7', color: '#15803D' },
  upcoming:  { label: 'Upcoming',  bg: '#DBEAFE', color: '#1D4ED8' },
  completed: { label: 'Completed', bg: '#F1F5F9', color: '#475569' },
};

/* ─── Info row helper ──────────────────────────────────────────────────────── */
const InfoRow = ({ icon, label, value }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, borderBottom: '1px solid #F1F5F9' }}>
    <Box sx={{ color: '#6366F1', display: 'flex', alignItems: 'center' }}>{icon}</Box>
    <Typography variant="body2" sx={{ color: '#64748B', minWidth: 120 }}>{label}</Typography>
    <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A' }}>{value}</Typography>
  </Box>
);

/* ─── Component ────────────────────────────────────────────────────────────── */

const ViewExamPage = () => {
  const { examId } = useParams();
  const navigate   = useNavigate();

  const [exam,    setExam]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        if (!examId) throw new Error('No exam ID provided.');
        const data = await getExamById(examId);
        setExam(data);
      } catch (err) {
        setError(err.message || 'Failed to load exam. It may have been deleted.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [examId]);

  if (loading) return <LoadingSpinner message="Loading exam preview…" />;

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
        <Button
          variant="outlined" startIcon={<ArrowBack />}
          onClick={() => navigate('/faculty/manage-exams')}
        >
          Back to Manage Exams
        </Button>
      </Box>
    );
  }

  if (!exam) return null;

  const sc         = STATUS_CONFIG[exam.status] || STATUS_CONFIG.completed;
  const questions  = exam.questions ?? [];
  const totalMarks = questions.reduce((sum, q) => sum + Number(q.marks ?? 0), 0);

  return (
    <Box>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <Box sx={{ mb: 4 }}>
        <Button
          variant="text" startIcon={<ArrowBack fontSize="small" />}
          onClick={() => navigate('/faculty/manage-exams')}
          sx={{ color: '#64748B', mb: 1.5, pl: 0, '&:hover': { color: '#4F46E5' } }}
        >
          Back to Manage Exams
        </Button>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
              <Typography variant="h3" sx={{ fontWeight: 700, color: '#0F172A' }}>
                {exam.title}
              </Typography>
              <Chip
                label={sc.label} size="small"
                sx={{ height: 24, fontSize: '0.75rem', fontWeight: 700, backgroundColor: sc.bg, color: sc.color }}
              />
            </Box>
            <Typography variant="body2" sx={{ color: '#64748B' }}>
              Read-only preview · {questions.length} question{questions.length !== 1 ? 's' : ''} · {totalMarks} total marks
            </Typography>
          </Box>

          <Button
            variant="outlined" startIcon={<Edit fontSize="small" />}
            onClick={() => navigate(`/faculty/edit-exam/${examId}`)}
            sx={{ fontWeight: 600, flexShrink: 0 }}
          >
            Edit Exam
          </Button>
        </Box>
      </Box>

      {/* ── Exam metadata card ───────────────────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography sx={{ fontWeight: 700, color: '#0F172A', fontSize: '1rem', mb: 2 }}>
          Exam Information
        </Typography>

        <Grid container spacing={0}>
          <Grid item xs={12} md={6}>
            <InfoRow icon={<Subject fontSize="small" />}     label="Subject"    value={exam.subject ?? '—'} />
            <InfoRow icon={<AccessTime fontSize="small" />}  label="Duration"   value={`${exam.duration ?? '—'} minutes`} />
            <InfoRow icon={<QuestionAnswer fontSize="small" />} label="Questions" value={questions.length} />
            <InfoRow icon={<CheckCircle fontSize="small" />} label="Total Marks" value={totalMarks} />
          </Grid>
          <Grid item xs={12} md={6}>
            <InfoRow icon={<CalendarToday fontSize="small" />} label="Start Time" value={formatExamDate(exam.startTime)} />
            <InfoRow icon={<CalendarToday fontSize="small" />} label="End Time"   value={formatExamDate(exam.endTime)} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, borderBottom: '1px solid #F1F5F9' }}>
              <Box sx={{ color: '#6366F1', display: 'flex', alignItems: 'center' }}>
                <CheckCircle fontSize="small" />
              </Box>
              <Typography variant="body2" sx={{ color: '#64748B', minWidth: 120 }}>Status</Typography>
              <Chip
                label={sc.label} size="small"
                sx={{ height: 22, fontSize: '0.6875rem', fontWeight: 700, backgroundColor: sc.bg, color: sc.color }}
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* ── Questions ────────────────────────────────────────────────────── */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Typography sx={{ fontWeight: 700, color: '#0F172A', fontSize: '1rem' }}>
            Questions
          </Typography>
          <Chip
            label={`${questions.length}`} size="small"
            sx={{ height: 22, fontSize: '0.6875rem', fontWeight: 700, backgroundColor: '#EEF2FF', color: '#4F46E5' }}
          />
        </Box>

        {questions.length === 0 ? (
          <Alert severity="info">No questions have been added to this exam yet.</Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {questions.map((q, idx) => (
              <Box
                key={q.id ?? idx}
                sx={{
                  p: 2.5,
                  border: '1px solid #E5E7EB',
                  borderRadius: '12px',
                  backgroundColor: '#FAFAFA',
                }}
              >
                {/* Question header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1.5, flex: 1 }}>
                    <Box
                      sx={{
                        width: 28, height: 28, borderRadius: '8px',
                        background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0, mt: 0.25,
                      }}
                    >
                      {idx + 1}
                    </Box>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#0F172A', lineHeight: 1.5, flex: 1 }}>
                      {q.question}
                    </Typography>
                  </Box>
                  <Chip
                    label={`${q.marks ?? 0} mark${Number(q.marks) !== 1 ? 's' : ''}`}
                    size="small"
                    sx={{ height: 22, fontSize: '0.6875rem', fontWeight: 600, backgroundColor: '#F1F5F9', color: '#475569', flexShrink: 0, ml: 2 }}
                  />
                </Box>

                {/* Options grid */}
                <Grid container spacing={1} sx={{ mb: 1.5 }}>
                  {(q.options ?? []).map((opt, oi) => {
                    const letter = ['A', 'B', 'C', 'D'][oi];
                    const isCorrect = q.correctAnswer === letter;
                    return (
                      <Grid item xs={12} sm={6} key={letter}>
                        <Box
                          sx={{
                            px: 2, py: 1, borderRadius: '8px',
                            border: '1px solid',
                            borderColor: isCorrect ? '#10B981' : '#E5E7EB',
                            backgroundColor: isCorrect ? '#ECFDF5' : '#FFFFFF',
                            display: 'flex', alignItems: 'center', gap: 1,
                          }}
                        >
                          <Box
                            sx={{
                              width: 20, height: 20, borderRadius: '50%',
                              backgroundColor: isCorrect ? '#10B981' : '#E5E7EB',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: isCorrect ? '#fff' : '#6B7280' }}>
                              {letter}
                            </Typography>
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{ color: isCorrect ? '#065F46' : '#374151', fontWeight: isCorrect ? 600 : 400 }}
                          >
                            {opt}
                          </Typography>
                          {isCorrect && (
                            <CheckCircle sx={{ fontSize: 14, color: '#10B981', ml: 'auto' }} />
                          )}
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>

                {/* Correct answer badge */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>Correct answer:</Typography>
                  <Chip
                    label={q.correctAnswer} size="small"
                    sx={{ height: 20, fontSize: '0.6875rem', fontWeight: 700, backgroundColor: '#DCFCE7', color: '#15803D' }}
                  />
                </Box>
              </Box>
            ))}
          </Box>
        )}

        {/* Summary footer */}
        {questions.length > 0 && (
          <>
            <Divider sx={{ my: 3 }} />
            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>Total Questions</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A' }}>{questions.length}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>Total Marks</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A' }}>{totalMarks}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>Avg Marks/Q</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A' }}>
                  {questions.length > 0 ? (totalMarks / questions.length).toFixed(1) : 0}
                </Typography>
              </Box>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default ViewExamPage;
