import React from 'react';
import {
  Card, CardContent, CardActions, Typography, Button, Chip, Box,
  LinearProgress, Tooltip,
} from '@mui/material';
import {
  AccessTime, QuestionAnswer, PlayArrow, Schedule, LockClock,
  LockOutlined, RepeatOutlined, CheckCircleOutlined, BlockOutlined,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { normaliseAttemptPolicy } from '../services/examService';

/* ─── Status config ───────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  active:    { label: 'Active',    bg: '#DCFCE7', color: '#15803D' },
  upcoming:  { label: 'Upcoming',  bg: '#DBEAFE', color: '#1D4ED8' },
  completed: { label: 'Completed', bg: '#F1F5F9', color: '#475569' },
};

/* ─── Attempt status helpers ──────────────────────────────────────────────── */

/**
 * Returns attempt state for this student on this exam.
 *
 * @param {object}      exam
 * @param {number}      usedAttempts   How many times this student has submitted
 * @returns {{ blocked: boolean, label: string, sub: string, color: string }}
 */
const resolveAttemptState = (exam, usedAttempts) => {
  const { attemptPolicy, maxAttempts } = normaliseAttemptPolicy(exam);

  if (attemptPolicy === 'single') {
    if (usedAttempts >= 1) {
      return {
        blocked: true,
        label: 'Already completed',
        sub: 'You have already submitted this exam.',
        color: '#64748B',
      };
    }
    return {
      blocked: false,
      label: 'One-Time Exam',
      sub: 'Single attempt only',
      color: '#4F46E5',
    };
  }

  // multiple
  if (maxAttempts !== null && usedAttempts >= maxAttempts) {
    return {
      blocked: true,
      label: 'Max attempts reached',
      sub: `${usedAttempts} / ${maxAttempts} attempts used`,
      color: '#EF4444',
    };
  }

  const remaining = maxAttempts === null ? null : maxAttempts - usedAttempts;
  return {
    blocked: false,
    label: 'Practice Test',
    sub: maxAttempts === null
      ? `${usedAttempts} attempt${usedAttempts !== 1 ? 's' : ''} used · Unlimited`
      : `${usedAttempts} / ${maxAttempts} attempts used`,
    color: '#10B981',
    remaining,
  };
};

/* ─── Component ────────────────────────────────────────────────────────────── */
const ExamCard = ({ exam, usedAttempts = 0 }) => {
  const navigate = useNavigate();

  const sc          = STATUS_CONFIG[exam.status] || STATUS_CONFIG.completed;
  const isActive    = exam.status === 'active';
  const isUpcoming  = exam.status === 'upcoming';
  const attemptState = resolveAttemptState(exam, usedAttempts);
  const { attemptPolicy, maxAttempts } = normaliseAttemptPolicy(exam);

  const canStart = isActive && !attemptState.blocked;

  /* Attempt progress percentage for progress bar */
  const attemptProgress = (maxAttempts !== null && maxAttempts > 0)
    ? Math.min((usedAttempts / maxAttempts) * 100, 100)
    : null;

  /* Button label */
  const buttonLabel = () => {
    if (!isActive)               return isUpcoming ? 'Upcoming' : 'Completed';
    if (attemptState.blocked)    return attemptPolicy === 'single' ? 'Completed' : 'Limit Reached';
    if (usedAttempts > 0)        return 'Retake Exam';
    return 'Start Exam';
  };

  const buttonIcon = () => {
    if (!isActive)            return isUpcoming ? <LockClock /> : <Schedule />;
    if (attemptState.blocked) return <BlockOutlined />;
    if (usedAttempts > 0)     return <RepeatOutlined />;
    return <PlayArrow />;
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: attemptState.blocked ? '1px solid #E2E8F0' : '1px solid #E2E8F0',
        opacity: attemptState.blocked ? 0.85 : 1,
        '&:hover': {
          transform: canStart ? 'translateY(-3px)' : 'none',
          boxShadow: canStart ? '0 8px 30px rgba(0,0,0,0.1)' : '0 1px 3px rgba(0,0,0,0.06)',
        },
        transition: 'all 0.2s ease',
      }}
    >
      <CardContent sx={{ flexGrow: 1, p: 3 }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Typography
            sx={{ fontWeight: 700, color: '#0F172A', fontSize: '1rem', lineHeight: 1.3, flex: 1, mr: 1 }}
          >
            {exam.title}
          </Typography>
          <Chip
            label={sc.label}
            size="small"
            sx={{ flexShrink: 0, height: 22, fontSize: '0.6875rem', fontWeight: 600, backgroundColor: sc.bg, color: sc.color }}
          />
        </Box>

        {/* ── Subject ─────────────────────────────────────────────────────── */}
        <Typography sx={{ color: '#64748B', mb: 2, fontWeight: 500, fontSize: '0.875rem' }}>
          {exam.subject}
        </Typography>

        {/* ── Attempt Policy Badge ────────────────────────────────────────── */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 2,
            p: 1.25,
            borderRadius: '8px',
            backgroundColor: attemptState.blocked ? '#FEF2F2' : (attemptPolicy === 'single' ? '#EEF2FF' : '#ECFDF5'),
            border: '1px solid',
            borderColor: attemptState.blocked ? '#FECACA' : (attemptPolicy === 'single' ? '#C7D2FE' : '#A7F3D0'),
          }}
        >
          {attemptState.blocked
            ? <BlockOutlined sx={{ fontSize: 14, color: '#EF4444', flexShrink: 0 }} />
            : attemptPolicy === 'single'
              ? <LockOutlined sx={{ fontSize: 14, color: '#4F46E5', flexShrink: 0 }} />
              : <RepeatOutlined sx={{ fontSize: 14, color: '#10B981', flexShrink: 0 }} />
          }
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{ fontWeight: 700, fontSize: '0.75rem', color: attemptState.blocked ? '#EF4444' : attemptState.color, lineHeight: 1.2 }}
            >
              {attemptState.label}
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', color: '#64748B', mt: 0.1 }}>
              {attemptState.sub}
            </Typography>
          </Box>
          {usedAttempts > 0 && !attemptState.blocked && (
            <CheckCircleOutlined sx={{ fontSize: 14, color: '#10B981', flexShrink: 0 }} />
          )}
        </Box>

        {/* ── Attempt progress bar (multiple only) ───────────────────────── */}
        {attemptPolicy === 'multiple' && maxAttempts !== null && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: '0.6875rem', color: '#94A3B8' }}>Attempts used</Typography>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#0F172A' }}>
                {usedAttempts} / {maxAttempts}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={attemptProgress}
              sx={{
                height: 4, borderRadius: 2,
                '& .MuiLinearProgress-bar': {
                  backgroundColor: attemptProgress >= 100 ? '#EF4444' : '#10B981',
                },
              }}
            />
          </Box>
        )}
        {attemptPolicy === 'multiple' && maxAttempts === null && usedAttempts > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '0.6875rem', color: '#94A3B8' }}>
              {usedAttempts} attempt{usedAttempts !== 1 ? 's' : ''} · Unlimited remaining
            </Typography>
          </Box>
        )}

        {/* ── Exam details row ─────────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <AccessTime sx={{ fontSize: 14, color: '#94A3B8' }} />
            <Typography sx={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 500 }}>
              {exam.duration} min
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <QuestionAnswer sx={{ fontSize: 14, color: '#94A3B8' }} />
            <Typography sx={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 500 }}>
              {exam.questionCount ?? exam.questions?.length ?? 0} questions
            </Typography>
          </Box>
        </Box>

        {/* ── Start time ───────────────────────────────────────────────────── */}
        {exam.startTime && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Schedule sx={{ fontSize: 13, color: '#94A3B8' }} />
            <Typography sx={{ fontSize: '0.6875rem', color: '#94A3B8' }}>
              {new Date(exam.startTime).toLocaleString()}
            </Typography>
          </Box>
        )}
      </CardContent>

      {/* ── CTA button ───────────────────────────────────────────────────── */}
      <CardActions sx={{ px: 3, pb: 3, pt: 0 }}>
        <Tooltip
          title={
            attemptState.blocked
              ? attemptState.sub
              : !isActive
                ? isUpcoming ? 'Exam not yet open' : 'Exam has ended'
                : ''
          }
          disableHoverListener={canStart}
        >
          <span style={{ width: '100%' }}>
            <Button
              fullWidth
              variant={canStart ? 'contained' : 'outlined'}
              startIcon={buttonIcon()}
              onClick={() => canStart && navigate(`/exam/${exam.id}`)}
              disabled={!canStart}
              sx={{
                fontWeight: 600,
                ...(canStart && {
                  background: usedAttempts > 0
                    ? 'linear-gradient(135deg, #10B981, #059669)'
                    : 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                  '&:hover': {
                    background: usedAttempts > 0
                      ? 'linear-gradient(135deg, #059669, #047857)'
                      : 'linear-gradient(135deg, #4338CA, #6D28D9)',
                  },
                }),
              }}
            >
              {buttonLabel()}
            </Button>
          </span>
        </Tooltip>
      </CardActions>
    </Card>
  );
};

export default ExamCard;
