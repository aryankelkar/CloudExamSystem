import React from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';

const LEGEND = [
  { key: 'current',     label: 'Current',     bg: '#4F46E5', color: '#fff' },
  { key: 'answered',    label: 'Answered',    bg: '#10B981', color: '#fff' },
  { key: 'not-answered',label: 'Unanswered',  bg: '#F1F5F9', color: '#64748B' },
];

const QuestionPalette = ({ questions, currentQuestion, answers, onQuestionClick }) => {
  const getStatus = (questionId) => {
    if (questionId === currentQuestion) return 'current';
    if (answers[questionId]) return 'answered';
    return 'not-answered';
  };

  const answeredCount = Object.keys(answers).length;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        position: 'sticky',
        top: 80,
        border: '1px solid #E5E7EB',
        borderRadius: '16px',
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A', mb: 2, fontSize: '0.9375rem' }}>
        Question Palette
      </Typography>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2.5 }}>
        {LEGEND.map(({ key, label, bg, color }) => (
          <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box
              sx={{
                width: 16, height: 16, borderRadius: '5px',
                backgroundColor: bg,
                border: key === 'not-answered' ? '1px solid #CBD5E1' : 'none',
              }}
            />
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 500 }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Grid of question numbers */}
      <Grid container spacing={0.75}>
        {questions.map((question, index) => {
          const status = getStatus(question.id);
          const isCurrent = status === 'current';
          const isAnswered = status === 'answered';

          return (
            <Grid item xs={3} key={question.id}>
              <Box
                onClick={() => onQuestionClick?.(index)}
                sx={{
                  width: '100%',
                  aspectRatio: '1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: isCurrent ? 700 : 600,
                  fontSize: '0.8125rem',
                  fontFamily: 'Inter, sans-serif',
                  backgroundColor: isCurrent ? '#4F46E5' : isAnswered ? '#10B981' : '#F1F5F9',
                  color: isCurrent ? '#fff' : isAnswered ? '#fff' : '#64748B',
                  border: isCurrent ? '2px solid #4338CA' : isAnswered ? '2px solid #059669' : '1px solid #E2E8F0',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    transform: 'scale(1.08)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  },
                  userSelect: 'none',
                }}
              >
                {index + 1}
              </Box>
            </Grid>
          );
        })}
      </Grid>

      {/* Progress */}
      <Box
        sx={{
          mt: 2.5,
          pt: 2,
          borderTop: '1px solid #F1F5F9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 500 }}>
          Progress
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 700, color: answeredCount === questions.length ? '#10B981' : '#4F46E5' }}>
          {answeredCount} / {questions.length}
        </Typography>
      </Box>

      {/* Progress bar */}
      <Box
        sx={{
          mt: 1,
          height: 5,
          borderRadius: 3,
          backgroundColor: '#F1F5F9',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            height: '100%',
            borderRadius: 3,
            backgroundColor: answeredCount === questions.length ? '#10B981' : '#4F46E5',
            width: `${(answeredCount / questions.length) * 100}%`,
            transition: 'width 0.3s ease',
          }}
        />
      </Box>
    </Paper>
  );
};

export default QuestionPalette;
