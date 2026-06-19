import React, { useState } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  Chip, Select, MenuItem, FormControl,
  Divider,
} from '@mui/material';
import {
  Delete, Add, Visibility, ChevronRight,
  LockOutlined, RepeatOutlined, EmojiEvents, SchoolOutlined,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { createExam, addQuestion } from '../services/examService';
import { validateExamForm, validateQuestion } from '../utils/examUtils';
import useAuth from '../hooks/useAuth';
import { trackExamCreated } from '../services/analyticsService';
import { logAuditEvent }    from '../services/auditService';
import { AUDIT_ACTIONS }    from '../utils/auditActions';

/* ─── Constants ──────────────────────────────────────────────────────────── */
const EMPTY_QUESTION = {
  question: '',
  optionA: '', optionB: '', optionC: '', optionD: '',
  correctAnswer: '', marks: '',
};

const MAX_ATTEMPTS_OPTIONS = [
  { value: 2,    label: '2 attempts' },
  { value: 3,    label: '3 attempts' },
  { value: 5,    label: '5 attempts' },
  { value: null, label: 'Unlimited'  },
];

/* ─── Sub-components ─────────────────────────────────────────────────────── */
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
    sx={{ display: 'block', fontWeight: 600, color: '#64748B', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.05em' }}
  >
    {text}{required && <Box component="span" sx={{ color: '#EF4444', ml: 0.5 }}>*</Box>}
  </Typography>
);

/* ─── Policy option card (radio-style) ──────────────────────────────────── */
const PolicyCard = ({ value, selected, onChange, icon, title, description, accentColor }) => (
  <Box
    onClick={() => onChange(value)}
    sx={{
      p: 2.5,
      borderRadius: '12px',
      border: '2px solid',
      borderColor: selected ? accentColor : '#E5E7EB',
      backgroundColor: selected ? `${accentColor}0D` : '#FFFFFF',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      '&:hover': { borderColor: accentColor, backgroundColor: `${accentColor}08` },
      display: 'flex',
      alignItems: 'flex-start',
      gap: 1.5,
    }}
  >
    <Box
      sx={{
        width: 36, height: 36, borderRadius: '10px',
        backgroundColor: selected ? accentColor : '#F1F5F9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: selected ? '#fff' : '#64748B', flexShrink: 0,
        transition: 'all 0.15s ease',
      }}
    >
      {icon}
    </Box>
    <Box sx={{ flex: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontWeight: 700, color: '#0F172A', fontSize: '0.9375rem' }}>
          {title}
        </Typography>
        {selected && (
          <Chip
            label="Selected"
            size="small"
            sx={{ height: 18, fontSize: '0.625rem', fontWeight: 700, backgroundColor: accentColor, color: '#fff' }}
          />
        )}
      </Box>
      <Typography sx={{ color: '#64748B', fontSize: '0.8125rem', mt: 0.25 }}>
        {description}
      </Typography>
    </Box>
  </Box>
);

/* ─── Main page ──────────────────────────────────────────────────────────── */
const CreateExamPage = () => {
  const navigate = useNavigate();
  const { currentUser, role } = useAuth();

  /* ── Exam metadata ── */
  const [examData, setExamData] = useState({
    title: '', subject: '', duration: '', startTime: '', endTime: '',
  });

  /* ── Attempt policy ── */
  const [attemptPolicy, setAttemptPolicy] = useState('single');   // 'single' | 'multiple'
  const [maxAttempts,   setMaxAttempts]   = useState(1);           // number | null
  const [resultPolicy,  setResultPolicy]  = useState('best');      // 'best' | 'latest'

  /* ── Questions ── */
  const [questionData, setQuestionData] = useState({ ...EMPTY_QUESTION });
  const [questions,    setQuestions]    = useState([]);

  /* ── UI state ── */
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  /* ── Handlers ── */
  const handleExamChange = (e) =>
    setExamData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleAttemptPolicyChange = (value) => {
    setAttemptPolicy(value);
    if (value === 'single') {
      setMaxAttempts(1);
      setResultPolicy('best');
    } else {
      setMaxAttempts(3);   // sensible default for multiple
    }
  };

  const handleQuestionChange = (e) =>
    setQuestionData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleAddQuestion = () => {
    const validationError = validateQuestion(questionData);
    if (validationError) { setError(validationError); return; }
    setQuestions((prev) => [
      ...prev,
      { ...questionData, correctAnswer: questionData.correctAnswer.toUpperCase() },
    ]);
    setQuestionData({ ...EMPTY_QUESTION });
    setError('');
  };

  const handleDeleteQuestion = (index) =>
    setQuestions((prev) => prev.filter((_, i) => i !== index));

  /* ── Submit — business logic preserved, attempt fields added ── */
  const handleSubmit = async () => {
    const examError = validateExamForm(examData);
    if (examError) { setError(examError); return; }
    if (questions.length === 0) { setError('Please add at least one question'); return; }

    setLoading(true);
    setError('');

    try {
      const newExam = await createExam(
        {
          title:         examData.title,
          subject:       examData.subject,
          duration:      parseInt(examData.duration, 10),
          startTime:     examData.startTime,
          endTime:       examData.endTime,
          attemptPolicy,
          maxAttempts:   attemptPolicy === 'single' ? 1 : maxAttempts,
          resultPolicy:  attemptPolicy === 'single' ? 'best' : resultPolicy,
        },
        currentUser?.uid
      );

      for (const q of questions) {
        await addQuestion(newExam.id, q);
      }

      trackExamCreated(newExam.id);

      logAuditEvent({
        action:     AUDIT_ACTIONS.EXAM_CREATED,
        userId:     currentUser?.uid ?? 'anonymous',
        userRole:   role ?? 'faculty',
        targetId:   newExam.id,
        targetType: 'exam',
        metadata: {
          examTitle:     examData.title,
          subject:       examData.subject,
          duration:      parseInt(examData.duration, 10),
          questionCount: questions.length,
          attemptPolicy,
          maxAttempts:   attemptPolicy === 'single' ? 1 : maxAttempts,
          resultPolicy,
        },
      });

      navigate('/faculty/manage-exams');
    } catch (err) {
      setError(err.message || 'Failed to create exam');
    } finally {
      setLoading(false);
    }
  };

  /* ── Render ── */
  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, color: '#0F172A', mb: 0.5 }}>
          Create Exam
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {['Exam Details', 'Attempt Settings', 'Add Questions', 'Review & Publish'].map((s, i, arr) => (
            <React.Fragment key={s}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 500 }}>{s}</Typography>
              {i < arr.length - 1 && <ChevronRight sx={{ color: '#CBD5E1', fontSize: 16 }} />}
            </React.Fragment>
          ))}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* ── Section 1: Exam Details ──────────────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <SectionHeader step="1" title="Exam Details" subtitle="Basic information about the exam" />
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <FieldLabel text="Exam Title" required />
            <TextField
              fullWidth size="small" name="title" placeholder="e.g. Data Structures Mid-Term"
              value={examData.title} onChange={handleExamChange}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FieldLabel text="Subject" required />
            <TextField
              fullWidth size="small" name="subject" placeholder="e.g. Computer Science"
              value={examData.subject} onChange={handleExamChange}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FieldLabel text="Duration (minutes)" required />
            <TextField
              fullWidth size="small" name="duration" type="number" placeholder="60"
              value={examData.duration} onChange={handleExamChange}
              inputProps={{ min: 1 }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FieldLabel text="Start Time" required />
            <TextField
              fullWidth size="small" name="startTime" type="datetime-local"
              InputLabelProps={{ shrink: true }}
              value={examData.startTime} onChange={handleExamChange}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FieldLabel text="End Time" required />
            <TextField
              fullWidth size="small" name="endTime" type="datetime-local"
              InputLabelProps={{ shrink: true }}
              value={examData.endTime} onChange={handleExamChange}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* ── Section 2: Attempt Settings ────────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <SectionHeader
          step="2"
          title="Attempt Settings"
          subtitle="Control how many times students can take this exam and how scores are calculated."
        />

        {/* Attempt policy selection */}
        <FieldLabel text="Attempt Policy" required />
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6}>
            <PolicyCard
              value="single"
              selected={attemptPolicy === 'single'}
              onChange={handleAttemptPolicyChange}
              icon={<LockOutlined fontSize="small" />}
              title="Single Attempt Only"
              description="Students can submit once. Best for formal exams and assessments."
              accentColor="#4F46E5"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <PolicyCard
              value="multiple"
              selected={attemptPolicy === 'multiple'}
              onChange={handleAttemptPolicyChange}
              icon={<RepeatOutlined fontSize="small" />}
              title="Multiple Attempts Allowed"
              description="Students can retake. Best for practice tests and self-assessment."
              accentColor="#10B981"
            />
          </Grid>
        </Grid>

        {/* Multiple attempt options (shown only when multiple selected) */}
        {attemptPolicy === 'multiple' && (
          <>
            <Divider sx={{ mb: 3 }} />
            <Grid container spacing={3}>
              {/* Max attempts */}
              <Grid item xs={12} sm={6}>
                <FieldLabel text="Maximum Attempts" />
                <FormControl fullWidth size="small">
                  <Select
                    value={maxAttempts === null ? 'null' : maxAttempts}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMaxAttempts(v === 'null' ? null : Number(v));
                    }}
                  >
                    {MAX_ATTEMPTS_OPTIONS.map((opt) => (
                      <MenuItem key={String(opt.value)} value={opt.value === null ? 'null' : opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="caption" sx={{ color: '#94A3B8', mt: 0.5, display: 'block' }}>
                  {maxAttempts === null
                    ? 'Students may attempt unlimited times within the exam window.'
                    : `Students may attempt up to ${maxAttempts} times.`}
                </Typography>
              </Grid>

              {/* Result policy */}
              <Grid item xs={12} sm={6}>
                <FieldLabel text="Result Calculation" />
                <Grid container spacing={1.5}>
                  <Grid item xs={12}>
                    <PolicyCard
                      value="best"
                      selected={resultPolicy === 'best'}
                      onChange={setResultPolicy}
                      icon={<EmojiEvents fontSize="small" />}
                      title="Best Score"
                      description="Use the highest score across all attempts."
                      accentColor="#F59E0B"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <PolicyCard
                      value="latest"
                      selected={resultPolicy === 'latest'}
                      onChange={setResultPolicy}
                      icon={<SchoolOutlined fontSize="small" />}
                      title="Latest Score"
                      description="Use the most recent submission score."
                      accentColor="#6366F1"
                    />
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </>
        )}

        {/* Summary badge */}
        <Box
          sx={{
            mt: 3,
            p: 2,
            borderRadius: '10px',
            backgroundColor: '#F8FAFC',
            border: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>Policy summary:</Typography>
          <Chip
            label={attemptPolicy === 'single' ? 'One-Time Exam' : 'Practice Test'}
            size="small"
            sx={{
              height: 22, fontSize: '0.6875rem', fontWeight: 700,
              backgroundColor: attemptPolicy === 'single' ? '#EEF2FF' : '#ECFDF5',
              color: attemptPolicy === 'single' ? '#4F46E5' : '#059669',
            }}
          />
          <Chip
            label={
              attemptPolicy === 'single'
                ? '1 attempt'
                : maxAttempts === null
                  ? 'Unlimited attempts'
                  : `Max ${maxAttempts} attempts`
            }
            size="small"
            sx={{ height: 22, fontSize: '0.6875rem', fontWeight: 600, backgroundColor: '#F1F5F9', color: '#475569' }}
          />
          {attemptPolicy === 'multiple' && (
            <Chip
              label={resultPolicy === 'best' ? 'Best score counts' : 'Latest score counts'}
              size="small"
              sx={{ height: 22, fontSize: '0.6875rem', fontWeight: 600, backgroundColor: '#FFFBEB', color: '#92400E' }}
            />
          )}
        </Box>
      </Paper>

      {/* ── Section 3: Add Question ──────────────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <SectionHeader
          step="3"
          title="Add Question"
          subtitle="Add questions one at a time. Each question needs 4 options and a correct answer."
        />
        <Grid container spacing={2.5}>
          <Grid item xs={12}>
            <FieldLabel text="Question Text" required />
            <TextField
              fullWidth size="small" name="question" multiline rows={2}
              placeholder="Enter your question here…"
              value={questionData.question} onChange={handleQuestionChange}
            />
          </Grid>
          {['A', 'B', 'C', 'D'].map((letter) => (
            <Grid item xs={12} sm={6} key={letter}>
              <FieldLabel text={`Option ${letter}`} required />
              <TextField
                fullWidth size="small" name={`option${letter}`}
                placeholder={`Option ${letter}`}
                value={questionData[`option${letter}`]} onChange={handleQuestionChange}
              />
            </Grid>
          ))}
          <Grid item xs={12} sm={6}>
            <FieldLabel text="Correct Answer" required />
            <TextField
              fullWidth size="small" name="correctAnswer"
              placeholder="A, B, C, or D"
              value={questionData.correctAnswer} onChange={handleQuestionChange}
              inputProps={{ maxLength: 1, style: { textTransform: 'uppercase' } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FieldLabel text="Marks" required />
            <TextField
              fullWidth size="small" name="marks" type="number"
              placeholder="e.g. 2"
              value={questionData.marks} onChange={handleQuestionChange}
              inputProps={{ min: 0 }}
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={handleAddQuestion}
              sx={{ fontWeight: 600 }}
            >
              Add Question
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* ── Section 4: Questions Preview ────────────────────────────────── */}
      {questions.length > 0 && (
        <Paper sx={{ p: 3, mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <SectionHeader step="4" title="Questions Preview" subtitle={null} />
              <Chip
                label={`${questions.length} question${questions.length !== 1 ? 's' : ''}`}
                size="small"
                sx={{ height: 22, fontSize: '0.6875rem', fontWeight: 600, backgroundColor: '#EEF2FF', color: '#4F46E5', mb: 3 }}
              />
            </Box>
            <Button
              variant="outlined"
              startIcon={<Visibility />}
              size="small"
              onClick={() => setShowPreview(true)}
              sx={{ mb: 3 }}
            >
              Preview All
            </Button>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Question</TableCell>
                  <TableCell>Answer</TableCell>
                  <TableCell>Marks</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {questions.map((q, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{index + 1}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {q.question.length > 60 ? q.question.substring(0, 60) + '…' : q.question}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={q.correctAnswer}
                        size="small"
                        sx={{ height: 20, fontSize: '0.6875rem', fontWeight: 700, backgroundColor: '#DCFCE7', color: '#15803D' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{q.marks}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteQuestion(index)}
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
        </Paper>
      )}

      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button variant="outlined" onClick={() => navigate('/faculty')} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          sx={{
            fontWeight: 600,
            minWidth: 160,
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            '&:hover': { background: 'linear-gradient(135deg, #4338CA, #6D28D9)' },
          }}
        >
          {loading ? 'Creating…' : `Publish Exam (${questions.length} Q)`}
        </Button>
      </Box>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onClose={() => setShowPreview(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Questions Preview ({questions.length})
        </DialogTitle>
        <DialogContent dividers>
          {questions.map((q, index) => (
            <Box
              key={index}
              sx={{
                mb: 3,
                p: 2.5,
                border: '1px solid #E5E7EB',
                borderRadius: '12px',
                backgroundColor: '#F8FAFC',
              }}
            >
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5, color: '#0F172A' }}>
                Q{index + 1}: {q.question}
              </Typography>
              <Grid container spacing={1} sx={{ mb: 1.5 }}>
                {['A', 'B', 'C', 'D'].map((letter) => (
                  <Grid item xs={12} sm={6} key={letter}>
                    <Box
                      sx={{
                        px: 1.5, py: 1,
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: q.correctAnswer === letter ? '#10B981' : '#E5E7EB',
                        backgroundColor: q.correctAnswer === letter ? '#ECFDF5' : '#ffffff',
                      }}
                    >
                      <Typography variant="caption" fontWeight={600} sx={{ color: q.correctAnswer === letter ? '#10B981' : '#64748B' }}>
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

export default CreateExamPage;
