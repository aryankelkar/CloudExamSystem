import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Grid, TextField, InputAdornment,
  ToggleButton, ToggleButtonGroup, Chip, Alert,
} from '@mui/material';
import {
  Search, Assignment, CheckCircle, Schedule,
  LockOutlined, RepeatOutlined,
} from '@mui/icons-material';
import ExamCard from '../components/ExamCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { getAvailableExams } from '../services/examService';
import { getResultsByStudent } from '../services/resultService';
import useAuth from '../hooks/useAuth';

/* ─── Filter definitions ──────────────────────────────────────────────────── */
const FILTERS = [
  { value: 'all',      label: 'All',       icon: <Assignment  fontSize="small" /> },
  { value: 'active',   label: 'Active',    icon: <CheckCircle fontSize="small" /> },
  { value: 'upcoming', label: 'Upcoming',  icon: <Schedule    fontSize="small" /> },
];

/* ─── Component ────────────────────────────────────────────────────────────── */
const AvailableExamsPage = () => {
  const { currentUser } = useAuth();

  const [exams,          setExams]          = useState([]);
  const [attemptCounts,  setAttemptCounts]  = useState({}); // { examId: number }
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [search,         setSearch]         = useState('');
  const [filter,         setFilter]         = useState('all');

  /* ── Load exams + student attempt counts in parallel ── */
  useEffect(() => {
    const load = async () => {
      try {
        const [examsData, studentResults] = await Promise.all([
          getAvailableExams(),
          currentUser ? getResultsByStudent(currentUser.uid) : Promise.resolve([]),
        ]);

        setExams(examsData);

        /* Build { examId → count } map from student's existing results */
        const counts = {};
        studentResults.forEach((r) => {
          counts[r.examId] = (counts[r.examId] ?? 0) + 1;
        });
        setAttemptCounts(counts);

      } catch (err) {
        console.error('Failed to load exams:', err);
        setError('Failed to load exams. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser]);

  /* ── Client-side filter + search ── */
  const filtered = useMemo(() => {
    let list = exams;
    if (filter !== 'all') list = list.filter((e) => e.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) => e.title?.toLowerCase().includes(q) || e.subject?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [exams, filter, search]);

  const activeCount   = exams.filter((e) => e.status === 'active').length;
  const upcomingCount = exams.filter((e) => e.status === 'upcoming').length;
  const practiceCount = exams.filter((e) => (e.attemptPolicy ?? 'single') === 'multiple').length;

  if (loading) return <LoadingSpinner message="Loading exams..." />;

  return (
    <Box>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <Box sx={{ mb: 4 }}>
        <Typography
          sx={{ fontWeight: 800, fontSize: { xs: '1.5rem', md: '1.875rem' }, color: '#0F172A', mb: 0.5 }}
        >
          Available Exams
        </Typography>
        <Typography sx={{ color: '#64748B', fontSize: '0.9375rem' }}>
          Browse and start your exams below.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* ── Summary chips ────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
        <Chip
          icon={<Assignment sx={{ fontSize: '14px !important' }} />}
          label={`${exams.length} total`}
          sx={{ fontWeight: 600, backgroundColor: '#F1F5F9', color: '#475569' }}
        />
        <Chip
          icon={<CheckCircle sx={{ fontSize: '14px !important' }} />}
          label={`${activeCount} active`}
          sx={{
            fontWeight: 700,
            backgroundColor: activeCount > 0 ? '#D1FAE5' : '#F1F5F9',
            color: activeCount > 0 ? '#059669' : '#94A3B8',
          }}
        />
        <Chip
          icon={<Schedule sx={{ fontSize: '14px !important' }} />}
          label={`${upcomingCount} upcoming`}
          sx={{
            fontWeight: 600,
            backgroundColor: upcomingCount > 0 ? '#DBEAFE' : '#F1F5F9',
            color: upcomingCount > 0 ? '#1D4ED8' : '#94A3B8',
          }}
        />
        {practiceCount > 0 && (
          <Chip
            icon={<RepeatOutlined sx={{ fontSize: '14px !important' }} />}
            label={`${practiceCount} practice`}
            sx={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#059669' }}
          />
        )}
        {exams.length - practiceCount > 0 && (
          <Chip
            icon={<LockOutlined sx={{ fontSize: '14px !important' }} />}
            label={`${exams.length - practiceCount} one-time`}
            sx={{ fontWeight: 600, backgroundColor: '#EEF2FF', color: '#4F46E5' }}
          />
        )}
      </Box>

      {/* ── Search + Filter bar ──────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex', gap: 2, alignItems: 'center',
          flexWrap: 'wrap', mb: 4, p: 2.5,
          backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px',
        }}
      >
        <TextField
          placeholder="Search by title or subject…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ flex: '1 1 240px', minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: '#94A3B8', fontSize: 18 }} />
              </InputAdornment>
            ),
          }}
        />

        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(_, val) => { if (val !== null) setFilter(val); }}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              px: 2, py: 0.75,
              fontSize: '0.8125rem', fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              border: '1px solid #E2E8F0', color: '#64748B',
              textTransform: 'none', gap: 0.75,
              '&.Mui-selected': { backgroundColor: '#EEF2FF', color: '#4F46E5', borderColor: '#C7D2FE' },
              '&:hover': { backgroundColor: '#F8FAFC' },
            },
          }}
        >
          {FILTERS.map((f) => (
            <ToggleButton key={f.value} value={f.value}>
              {f.icon}
              {f.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* ── Exam grid ────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <Box
          sx={{
            py: 12, textAlign: 'center',
            backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0',
          }}
        >
          <Assignment sx={{ fontSize: 52, color: '#CBD5E1', mb: 2 }} />
          <Typography sx={{ color: '#64748B', fontWeight: 600, fontSize: '1rem', mb: 0.5 }}>
            {search || filter !== 'all' ? 'No exams match your search' : 'No exams available right now'}
          </Typography>
          <Typography sx={{ color: '#94A3B8', fontSize: '0.875rem' }}>
            {search ? 'Try a different title or subject.' : 'Check back later — your faculty will schedule new exams.'}
          </Typography>
        </Box>
      ) : (
        <>
          <Typography sx={{ color: '#64748B', fontSize: '0.8125rem', mb: 2.5, fontWeight: 500 }}>
            Showing {filtered.length} exam{filtered.length !== 1 ? 's' : ''}
            {filter !== 'all' ? ` · ${filter}` : ''}
            {search ? ` · "${search}"` : ''}
          </Typography>

          <Grid container spacing={3}>
            {filtered.map((exam) => (
              <Grid item xs={12} sm={6} xl={4} key={exam.id}>
                {/* Pass attempt count for this exam to ExamCard */}
                <ExamCard
                  exam={exam}
                  usedAttempts={attemptCounts[exam.id] ?? 0}
                />
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Box>
  );
};

export default AvailableExamsPage;
