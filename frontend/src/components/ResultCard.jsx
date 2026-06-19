import React from 'react';
import { Card, CardContent, Typography, Chip, Box, LinearProgress, Button } from '@mui/material';
import { CheckCircle, Cancel, CalendarToday, ArrowForward } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const ResultCard = ({ result }) => {
  const navigate = useNavigate();
  const isPass = result.status === 'pass';

  const submittedDate = (() => {
    if (!result.submittedAt) return 'N/A';
    try {
      const d = result.submittedAt?.toDate
        ? result.submittedAt.toDate()
        : new Date(result.submittedAt);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return 'N/A';
    }
  })();

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' },
        transition: 'all 0.2s ease',
      }}
    >
      <CardContent sx={{ flexGrow: 1, p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Typography
            variant="h6"
            sx={{ fontWeight: 700, color: '#0F172A', fontSize: '0.9375rem', lineHeight: 1.3, flex: 1, mr: 1 }}
          >
            {result.examTitle}
          </Typography>
          <Chip
            icon={isPass
              ? <CheckCircle sx={{ fontSize: '14px !important' }} />
              : <Cancel sx={{ fontSize: '14px !important' }} />
            }
            label={isPass ? 'Pass' : 'Fail'}
            size="small"
            sx={{
              height: 24,
              flexShrink: 0,
              fontSize: '0.6875rem',
              fontWeight: 700,
              backgroundColor: isPass ? '#DCFCE7' : '#FEE2E2',
              color: isPass ? '#15803D' : '#DC2626',
              '& .MuiChip-icon': { color: 'inherit' },
            }}
          />
        </Box>

        {/* Subject */}
        <Typography variant="body2" sx={{ color: '#64748B', mb: 2.5, fontWeight: 500 }}>
          {result.subject}
        </Typography>

        {/* Marks score */}
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 500 }}>
              Marks
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#0F172A' }}>
              {result.obtainedMarks ?? result.score} / {result.totalMarks}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={result.percentage}
            sx={{
              height: 6,
              '& .MuiLinearProgress-bar': {
                backgroundColor: isPass ? '#10B981' : '#EF4444',
              },
            }}
          />
        </Box>

        {/* Percentage + Date */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography
            variant="h5"
            sx={{ fontWeight: 800, color: isPass ? '#10B981' : '#EF4444' }}
          >
            {result.percentage}%
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CalendarToday sx={{ fontSize: 12, color: '#94A3B8' }} />
            <Typography variant="caption" sx={{ color: '#94A3B8' }}>
              {submittedDate}
            </Typography>
          </Box>
        </Box>
      </CardContent>

      {/* View Details */}
      {result.id && (
        <Box sx={{ px: 3, pb: 3 }}>
          <Button
            fullWidth
            variant="outlined"
            size="small"
            endIcon={<ArrowForward fontSize="small" />}
            onClick={() => navigate(`/result/${result.id}`)}
            sx={{ fontWeight: 600, fontSize: '0.8125rem' }}
          >
            View Details
          </Button>
        </Box>
      )}
    </Card>
  );
};

export default ResultCard;
