/**
 * EditExamPage.jsx  —  /faculty/edit-exam/:examId
 *
 * Loads an existing exam from Firestore, pre-fills all fields,
 * and allows the faculty to update metadata and questions.
 *
 * Business logic preserved:
 *  - updateExam()      — patches exam document fields (no questionCount touch)
 *  - addQuestion()     — appends to sub-collection + atomically increments counter
 *  - deleteQuestion()  — removes from sub-collection + atomically decrements counter
 *  - validateExamForm / validateQuestion — unchanged from CreateExamPage
 *
 * What changes vs CreateExamPage:
 *  - useEffect loads exam + questions on mount via getExamById()
 *  - Existing questions come from Firestore (have real `id` fields)
 *  - New questions added in-session are pending (no `id`)
 *  - On save:
 *      1. updateExam() patches metadata
 *      2. Questions marked for deletion → deleteQuestion()
 *      3. New (pending) questions → addQuestion()
 *  - Navigates back to /faculty/manage-exams on success
 */

import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, Chip, CircularProgress,
} from '@mui/material';
import {
  Delete, Add, Visibility, ChevronRight, Save, ArrowBack,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getExamById, updateExam, addQuestion, deleteQuestion,
} from '../services/examService';
import { validateExamForm, validateQuestion } from '../utils/examUtils';
import LoadingSpinner from '../components/LoadingSpinner';

/* ─── Helpers shared with CreateExamPage ──────────────────────────────────── */

const EMPTY_QUESTION = {
  question: '', optionA: '', optionB: '', optionC: '', optionD: '',
  correctAnswer: '', marks: '',
};

const SectionHeader = ({ step, title, subtitle }) => (
  <Box sx={{ mb: 3 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
      <Box
        sx={{
          width: 28, height: 28, borderRadius: '8px',
          background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
        }}
      >
        {step}
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A' }}>{title}</Typography>
    </Box>
    {subtitle && (
      <Typography variant="body2" sx={{ color: '#64748B', ml: 5 }}>{subtitle}</Typography>
    )}
  </Box>
);

const FieldLabel = ({ text, required }) => (
  <Typography
    variant="caption"
    sx={{
      display: 'block', fontWeight: 600, color: '#64748B',
      mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.05em',
    }}
  >
    {text}
    {required && <Box component="span" sx={{ color: '#EF4444', ml: 0.5 }}>*</Box>}
  </Typography>
);

/* ─── Convert Firestore Timestamp / ISO string → datetime-local string ─────── */
const toDatetimeLocal = (value) => {
  if (!value) return '';
  try {
    const d = value?.toDate ? value.toDate() : new Date(value);
    // datetime-local needs "YYYY-MM-DDTHH:MM"
    const pad = (n) => String(n).padStart(2, '0');
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  } catch {
    return '';
  }
};

/* ─── Map a Firestore question doc → form row ─────────────────────────────── */
const firestoreQToRow = (q) => ({
  _id:           q.id,          // real Firestore doc id — used for deleteQuestion()
  question:      q.question    ?? '',
  optionA:       q.options?.[0] ?? '',
  optionB:       q.options?.[1] ?? '',
  optionC:       q.options?.[2] ?? '',
  optionD:       q.options?.[3] ?? '',
  correctAnswer: q.correctAnswer ?? '',
  marks:         String(q.marks  ?? ''),
});

/* ─── Component ────────────────────────────────────────────────────────────── */

const EditExamPage = () => {
  const { examId } = useParams();
  const navigate   = useNavigate();

  /* ── Page-level state ──────────────────────────────────────────────────── */
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError,   setPageError]   = useState('');
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  /* ── Exam metadata form ────────────────────────────────────────────────── */
  const [examData, setExamData] = useState({
    title: '', subject: '', duration: '', startTime: '', endTime: '',
  });

  /* ── Question lists ────────────────────────────────────────────────────── */
  // existingQuestions: loaded from Firestore — have _id
  // pendingQuestions:  added this session — no _id yet
  // deletedIds:        _id values marked for deletion on save
  const [existingQuestions, setExistingQuestions] = useState([]);
  const [pendingQuestions,  setPendingQuestions]  = useState([]);
  const [deletedIds,        setDeletedIds]        = useState([]);

  /* ── New question form ─────────────────────────────────────────────────── */
  const [questionData, setQuestionData] = useState({ ...EMPTY_QUESTION });
  const [questionError, setQuestionError] = useState('');

  /* ── Load exam on mount ────────────────────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      setPageLoading(true);
      setPageError('');
      try {
        if (!examId) throw new Error('No exam ID provided');
        const exam = await getExamById(examId);

        setExamData({
          title:     exam.title    ?? '',
          subject:   exam.subject  ?? '',
          duration:  String(exam.duration ?? ''),
          startTime: toDatetimeLocal(exam.startTime),
          endTime:   toDatetimeLocal(exam.endTime),
        });

        setExistingQuestions((exam.questions ?? []).map(firestoreQToRow));
      } catch (err) {
        setPageError(err.message || 'Failed to load exam. It may have been deleted.');
      } finally {
        setPageLoading(false);
      }
    };
    load();
  }, [examId]);

  /* ── Handlers ──────────────────────────────────────────────────────────── */

  const handleExamChange = (e) =>
    setExamData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleQuestionChange = (e) =>
    setQuestionData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  /* Add a new pending question to the session list */
  const handleAddQuestion = () => {
    const err = validateQuestion(questionData);
    if (err) { setQuestionError(err); return; }
    setPendingQuestions((prev) => [
      ...prev,
      { ...questionData, correctAnswer: questionData.correctAnswer.toUpperCase() },
    ]);
    setQuestionData({ ...EMPTY_QUESTION });
    setQuestionError('');
  };

  /* Mark an existing question for deletion */
  const handleDeleteExisting = (qId) => {
    setDeletedIds((prev) => [...prev, qId]);
    setExistingQuestions((prev) => prev.filter((q) => q._id !== qId));
  };

  /* Remove a pending question before saving */
  const handleDeletePending = (index) =>
    setPendingQuestions((prev) => prev.filter((_, i) => i !== index));

  /* All visible questions combined (for display / preview) */
  const allQuestions = [
    ...existingQuestions,
    ...pendingQuestions,
  ];

  /* ── Save ──────────────────────────────────────────────────────────────── */
  const handleSave = async () => {
    const formErr = validateExamForm(examData);
    if (formErr) { setSaveError(formErr); return; }
    if (allQuestions.length === 0) {
      setSaveError('The exam must have at least one question.');
      return;
    }

    setSaving(true);
    setSaveError('');
    setSaveSuccess('');

    try {
      /* Step 1: update exam metadata (no questionCount touch) */
      await updateExam(examId, {
        title:    examData.title.trim(),
        subject:  examData.subject.trim(),
        duration: parseInt(examData.duration, 10),
        startTime: examData.startTime,
        endTime:   examData.endTime,
      });

      /* Step 2: delete removed questions from Firestore sub-collection */
      for (const qId of deletedIds) {
        await deleteQuestion(examId, qId);
      }

      /* Step 3: add new pending questions to Firestore sub-collection */
      for (const q of pendingQuestions) {
        await addQuestion(examId, q);
      }

      setSaveSuccess('Exam updated successfully!');
      setDeletedIds([]);

      /* Promote pending questions to existing (now they're saved) */
      /* We refetch to get real IDs back */
      const updated = await getExamById(examId);
      setExistingQuestions((updated.questions ?? []).map(firestoreQToRow));
      setPendingQuestions([]);

      /* Navigate back after a short confirmation pause */
      setTimeout(() => navigate('/faculty/manage-exams'), 1200);

    } catch (err) {
      setSaveError(err.message || 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Render guards ─────────────────────────────────────────────────────── */
  if (pageLoading) return <LoadingSpinner message="Loading exam…" />;

  if (pageError) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>{pageError}</Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={() => navigate('/faculty/manage-exams')}
        >
          Back to Manage Exams
        </Button>
      </Box>
    );
  }

  /* ── Render ────────────────────────────────────────────────────────────── */
  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          variant="text"
          startIcon={<ArrowBack fontSize="small" />}
          onClick={() => navigate('/faculty/manage-exams')}
          sx={{ color: '#64748B', mb: 1.5, pl: 0, '&:hover': { color: '#4F46E5' } }}
        >
          Back to Manage Exams
        </Button>
        <Typography variant="h3" sx={{ fontWeight: 700, color: '#0F172A', mb: 0.5 }}>
          Edit Exam
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {['Exam Details', 'Manage Questions', 'Save Changes'].map((s, i) => (
            <React.Fragment key={s}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 500 }}>{s}</Typography>
              {i < 2 && <ChevronRight sx={{ color: '#CBD5E1', fontSize: 16 }} />}
            </React.Fragment>
          ))}
        </Box>
      </Box>

      {saveError   && <Alert severity="error"   sx={{ mb: 3 }}>{saveError}</Alert>}
      {saveSuccess && <Alert severity="success" sx={{ mb: 3 }}>{saveSuccess}</Alert>}

      {/* ── Section 1: Exam Details ─────────────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <SectionHeader step="1" title="Exam Details" subtitle="Update the basic information" />
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <FieldLabel text="Exam Title" required />
            <TextField
              fullWidth size="small" name="title"
              value={examData.title} onChange={handleExamChange}
              disabled={saving}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FieldLabel text="Subject" required />
            <TextField
              fullWidth size="small" name="subject"
              value={examData.subject} onChange={handleExamChange}
              disabled={saving}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FieldLabel text="Duration (minutes)" required />
            <TextField
              fullWidth size="small" name="duration" type="number"
              value={examData.duration} onChange={handleExamChange}
              inputProps={{ min: 1 }} disabled={saving}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FieldLabel text="Start Time" required />
            <TextField
              fullWidth size="small" name="startTime" type="datetime-local"
              InputLabelProps={{ shrink: true }}
              value={examData.startTime} onChange={handleExamChange}
              disabled={saving}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FieldLabel text="End Time" required />
            <TextField
              fullWidth size="small" name="endTime" type="datetime-local"
              InputLabelProps={{ shrink: true }}
              value={examData.endTime} onChange={handleExamChange}
              disabled={saving}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* ── Section 2: Current Questions ────────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <SectionHeader step="2" title="Current Questions" subtitle={null} />
            <Chip
              label={`${allQuestions.length} question${allQuestions.length !== 1 ? 's' : ''}`}
              size="small"
              sx={{
                height: 22, fontSize: '0.6875rem', fontWeight: 600,
                backgroundColor: '#EEF2FF', color: '#4F46E5', mb: 3,
              }}
            />
          </Box>
          {allQuestions.length > 0 && (
            <Button
              variant="outlined" size="small" startIcon={<Visibility />}
              onClick={() => setShowPreview(true)} sx={{ mb: 3 }}
            >
              Preview All
            </Button>
          )}
        </Box>

        {allQuestions.length === 0 ? (
          <Alert severity="warning">
            No questions yet. Add at least one question below before saving.
          </Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Question</TableCell>
                  <TableCell>Answer</TableCell>
                  <TableCell>Marks</TableCell>
                  <TableCell align="right">Delete</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Existing (saved) questions */}
                {existingQuestions.map((q, idx) => (
                  <TableRow key={q._id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{idx + 1}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {q.question.length > 60 ? q.question.slice(0, 60) + '…' : q.question}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={q.correctAnswer} size="small"
                        sx={{ height: 20, fontSize: '0.6875rem', fontWeight: 700, backgroundColor: '#DCFCE7', color: '#15803D' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{q.marks}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small" disabled={saving}
                        onClick={() => handleDeleteExisting(q._id)}
                        sx={{ color: '#94A3B8', '&:hover': { color: '#EF4444', backgroundColor: '#FEF2F2' } }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}

                {/* Pending (unsaved) questions */}
                {pendingQuestions.map((q, idx) => (
                  <TableRow key={`pending-${idx}`} sx={{ backgroundColor: '#F0FDF4' }}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {existingQuestions.length + idx + 1}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label="New" size="small"
                          sx={{ height: 18, fontSize: '0.625rem', fontWeight: 700, backgroundColor: '#DCFCE7', color: '#15803D' }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          {q.question.length > 50 ? q.question.slice(0, 50) + '…' : q.question}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={q.correctAnswer} size="small"
                        sx={{ height: 20, fontSize: '0.6875rem', fontWeight: 700, backgroundColor: '#DCFCE7', color: '#15803D' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{q.marks}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small" disabled={saving}
                        onClick={() => handleDeletePending(idx)}
                        sx={{ color: '#94A3B8', '&:hover': { color: '#EF4444', backgroundColor: '#FEF2F2' } }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ── Section 3: Add New Question ──────────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <SectionHeader
          step="3"
          title="Add New Question"
          subtitle="Optionally add more questions. Click 'Add Question' — they won't be saved until you click Save."
        />
        {questionError && <Alert severity="error" sx={{ mb: 2 }}>{questionError}</Alert>}
        <Grid container spacing={2.5}>
          <Grid item xs={12}>
            <FieldLabel text="Question Text" required />
            <TextField
              fullWidth size="small" name="question" multiline rows={2}
              placeholder="Enter question here…"
              value={questionData.question} onChange={handleQuestionChange}
              disabled={saving}
            />
          </Grid>
          {['A', 'B', 'C', 'D'].map((letter) => (
            <Grid item xs={12} sm={6} key={letter}>
              <FieldLabel text={`Option ${letter}`} required />
              <TextField
                fullWidth size="small" name={`option${letter}`}
                placeholder={`Option ${letter}`}
                value={questionData[`option${letter}`]} onChange={handleQuestionChange}
                disabled={saving}
              />
            </Grid>
          ))}
          <Grid item xs={12} sm={6}>
            <FieldLabel text="Correct Answer (A–D)" required />
            <TextField
              fullWidth size="small" name="correctAnswer"
              placeholder="A, B, C, or D"
              value={questionData.correctAnswer} onChange={handleQuestionChange}
              inputProps={{ maxLength: 1, style: { textTransform: 'uppercase' } }}
              disabled={saving}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FieldLabel text="Marks" required />
            <TextField
              fullWidth size="small" name="marks" type="number"
              placeholder="e.g. 2"
              value={questionData.marks} onChange={handleQuestionChange}
              inputProps={{ min: 0 }} disabled={saving}
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="outlined" startIcon={<Add />}
              onClick={handleAddQuestion} disabled={saving}
              sx={{ fontWeight: 600 }}
            >
              Add Question
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* ── Action buttons ───────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          onClick={() => navigate('/faculty/manage-exams')}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
          onClick={handleSave}
          disabled={saving}
          sx={{
            fontWeight: 600, minWidth: 160,
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            '&:hover': { background: 'linear-gradient(135deg, #4338CA, #6D28D9)' },
          }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </Box>

      {/* ── Preview Dialog ───────────────────────────────────────────────── */}
      <Dialog open={showPreview} onClose={() => setShowPreview(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Questions Preview ({allQuestions.length})
        </DialogTitle>
        <DialogContent dividers>
          {allQuestions.map((q, index) => (
            <Box
              key={q._id ?? `pending-${index}`}
              sx={{
                mb: 3, p: 2.5,
                border: '1px solid #E5E7EB', borderRadius: '12px',
                backgroundColor: q._id ? '#F8FAFC' : '#F0FDF4',
              }}
            >
              {!q._id && (
                <Chip
                  label="Unsaved" size="small" sx={{ mb: 1, height: 18, fontSize: '0.625rem', fontWeight: 700, backgroundColor: '#DCFCE7', color: '#15803D' }}
                />
              )}
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5, color: '#0F172A' }}>
                Q{index + 1}: {q.question}
              </Typography>
              <Grid container spacing={1} sx={{ mb: 1.5 }}>
                {['A', 'B', 'C', 'D'].map((letter) => (
                  <Grid item xs={12} sm={6} key={letter}>
                    <Box
                      sx={{
                        px: 1.5, py: 1, borderRadius: '8px', border: '1px solid',
                        borderColor: q.correctAnswer === letter ? '#10B981' : '#E5E7EB',
                        backgroundColor: q.correctAnswer === letter ? '#ECFDF5' : '#fff',
                      }}
                    >
                      <Typography
                        variant="caption" fontWeight={600}
                        sx={{ color: q.correctAnswer === letter ? '#10B981' : '#64748B' }}
                      >
                        {letter}) {q[`option${letter}`]}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 600 }}>
                  ✓ Correct: {q.correctAnswer}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748B' }}>
                  Marks: {q.marks}
                </Typography>
              </Box>
            </Box>
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setShowPreview(false)} variant="outlined">Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EditExamPage;
