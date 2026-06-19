import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, Button, LinearProgress,
} from '@mui/material';
import {
  Assignment, CheckCircle, People, TrendingUp, ArrowForward, Add,
  BarChart as BarChartIcon, Star,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getAllExams } from '../services/examService';
import { getAllResults } from '../services/resultService';
import LoadingSpinner from '../components/LoadingSpinner';
import useAuth from '../hooks/useAuth';

/* ── KPI card ── */
const KPICard = ({ icon, value, label, sub, color, bg, badge }) => (
  <Card
    sx={{
      borderRadius: '16px', border: '1px solid #E2E8F0',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      transition: 'all 0.2s ease',
      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 20px rgba(0,0,0,0.08)' },
    }}
  >
    <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
        <Box
          sx={{
            width: 46, height: 46, borderRadius: '13px',
            backgroundColor: bg, display: 'flex',
            alignItems: 'center', justifyContent: 'center', color,
          }}
        >
          {icon}
        </Box>
        {badge && (
          <Chip
            label={badge}
            size="small"
            sx={{ height: 22, fontSize: '0.6875rem', fontWeight: 700, backgroundColor: '#D1FAE5', color: '#059669' }}
          />
        )}
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: '2rem', color: '#0F172A', lineHeight: 1, mb: 0.25 }}>
        {value}
      </Typography>
      <Typography sx={{ fontWeight: 600, color: '#475569', fontSize: '0.875rem', mb: 0.25 }}>
        {label}
      </Typography>
      {sub && <Typography sx={{ fontSize: '0.75rem', color: '#94A3B8' }}>{sub}</Typography>}
    </CardContent>
  </Card>
);

const STATUS_COLORS = {
  active:    { bg: '#D1FAE5', color: '#059669', label: 'Active' },
  upcoming:  { bg: '#DBEAFE', color: '#1D4ED8', label: 'Upcoming' },
  completed: { bg: '#F1F5F9', color: '#475569', label: 'Completed' },
};

const FacultyDashboard = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const [exams,   setExams]   = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [examsData, resultsData] = await Promise.all([
          getAllExams(),
          getAllResults(),
        ]);
        setExams(examsData);
        setResults(resultsData);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  const totalExams    = exams.length;
  const activeExams   = exams.filter((e) => e.status === 'active').length;
  const totalStudents = new Set(results.map((r) => r.studentId)).size;
  const averageScore  = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length)
    : 0;
  const passCount     = results.filter((r) => r.status === 'pass').length;
  const passRate      = results.length > 0 ? Math.round((passCount / results.length) * 100) : 0;
  const displayName   = userProfile?.name || currentUser?.displayName || 'Faculty';

  /* top 5 exams by result count */
  const examResultCounts = exams.map((e) => ({
    ...e,
    count: results.filter((r) => r.examId === e.id).length,
  })).sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <Box>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.5rem', md: '1.875rem' }, color: '#0F172A', mb: 0.5 }}>
            Welcome back, {displayName} 👋
          </Typography>
          <Typography sx={{ color: '#64748B', fontSize: '0.9375rem' }}>
            Here's what's happening on your platform today.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/faculty/create-exam')}
          sx={{
            display: { xs: 'none', sm: 'flex' },
            fontWeight: 600,
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            '&:hover': { background: 'linear-gradient(135deg, #4338CA, #6D28D9)', transform: 'translateY(-1px)' },
          }}
        >
          Create Exam
        </Button>
      </Box>

      {/* ── KPI Row ────────────────────────────────────────────────────── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <KPICard
            icon={<Assignment />} value={totalExams}
            label="Total Exams" sub="All time"
            color="#4F46E5" bg="#EEF2FF"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KPICard
            icon={<CheckCircle />} value={activeExams}
            label="Active Exams" sub="Currently live"
            color="#10B981" bg="#D1FAE5"
            badge={activeExams > 0 ? 'Live' : null}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KPICard
            icon={<People />} value={totalStudents}
            label="Students" sub="Unique submissions"
            color="#0EA5E9" bg="#E0F2FE"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KPICard
            icon={<TrendingUp />} value={`${averageScore}%`}
            label="Average Score" sub={`${passRate}% pass rate`}
            color="#F59E0B" bg="#FEF3C7"
          />
        </Grid>
      </Grid>

      {/* ── Three-column activity row ─────────────────────────────────── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Recent Exams */}
        <Grid item xs={12} lg={5}>
          <Card sx={{ borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Assignment sx={{ color: '#4F46E5', fontSize: 20 }} />
                  <Typography sx={{ fontWeight: 700, color: '#0F172A', fontSize: '1rem' }}>
                    Recent Exams
                  </Typography>
                </Box>
                <Button
                  size="small" variant="text" endIcon={<ArrowForward fontSize="small" />}
                  onClick={() => navigate('/faculty/manage-exams')}
                  sx={{ color: '#4F46E5', fontWeight: 600, fontSize: '0.8125rem', px: 1 }}
                >
                  Manage
                </Button>
              </Box>

              {exams.length === 0 ? (
                <Box sx={{ py: 5, textAlign: 'center' }}>
                  <Assignment sx={{ fontSize: 40, color: '#E2E8F0', mb: 1.5 }} />
                  <Typography sx={{ color: '#94A3B8', fontSize: '0.875rem' }}>No exams yet.</Typography>
                  <Button
                    size="small" variant="outlined" sx={{ mt: 2 }}
                    onClick={() => navigate('/faculty/create-exam')}
                  >
                    Create first exam
                  </Button>
                </Box>
              ) : (
                <Box>
                  {exams.slice(0, 6).map((exam, idx) => {
                    const sc = STATUS_COLORS[exam.status] || STATUS_COLORS.completed;
                    return (
                      <Box
                        key={exam.id}
                        sx={{
                          py: 1.5, px: 1, borderRadius: '10px',
                          borderBottom: idx < Math.min(exams.length, 6) - 1 ? '1px solid #F1F5F9' : 'none',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          '&:hover': { backgroundColor: '#F8FAFC' },
                          transition: 'background 0.15s', cursor: 'default',
                        }}
                      >
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontWeight: 600, color: '#0F172A', fontSize: '0.875rem' }} noWrap>
                            {exam.title}
                          </Typography>
                          <Typography sx={{ color: '#94A3B8', fontSize: '0.75rem' }}>
                            {exam.subject} · {exam.questionCount ?? 0} Qs
                          </Typography>
                        </Box>
                        <Chip
                          label={sc.label} size="small"
                          sx={{ ml: 1.5, flexShrink: 0, height: 22, fontSize: '0.6875rem', fontWeight: 600, backgroundColor: sc.bg, color: sc.color }}
                        />
                      </Box>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Results */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Star sx={{ color: '#F59E0B', fontSize: 20 }} />
                  <Typography sx={{ fontWeight: 700, color: '#0F172A', fontSize: '1rem' }}>
                    Recent Results
                  </Typography>
                </Box>
                <Button
                  size="small" variant="text" endIcon={<ArrowForward fontSize="small" />}
                  onClick={() => navigate('/faculty/results')}
                  sx={{ color: '#4F46E5', fontWeight: 600, fontSize: '0.8125rem', px: 1 }}
                >
                  View all
                </Button>
              </Box>

              {results.length === 0 ? (
                <Box sx={{ py: 5, textAlign: 'center' }}>
                  <Star sx={{ fontSize: 40, color: '#E2E8F0', mb: 1.5 }} />
                  <Typography sx={{ color: '#94A3B8', fontSize: '0.875rem' }}>No results yet.</Typography>
                </Box>
              ) : (
                <Box>
                  {results.slice(0, 6).map((result, idx) => {
                    const isPass = result.status === 'pass';
                    return (
                      <Box
                        key={result.id}
                        sx={{
                          py: 1.5, px: 1, borderRadius: '10px',
                          borderBottom: idx < Math.min(results.length, 6) - 1 ? '1px solid #F1F5F9' : 'none',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          '&:hover': { backgroundColor: '#F8FAFC' },
                          transition: 'background 0.15s',
                        }}
                      >
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontWeight: 600, color: '#0F172A', fontSize: '0.875rem' }} noWrap>
                            {result.studentName}
                          </Typography>
                          <Typography sx={{ color: '#94A3B8', fontSize: '0.75rem' }} noWrap>
                            {result.examTitle}
                          </Typography>
                        </Box>
                        <Typography
                          sx={{ fontWeight: 800, fontSize: '0.9375rem', flexShrink: 0, ml: 1.5, color: isPass ? '#10B981' : '#EF4444' }}
                        >
                          {result.percentage}%
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Analytics Snapshot */}
        <Grid item xs={12} lg={3}>
          <Card sx={{ borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BarChartIcon sx={{ color: '#7C3AED', fontSize: 20 }} />
                  <Typography sx={{ fontWeight: 700, color: '#0F172A', fontSize: '1rem' }}>
                    Analytics
                  </Typography>
                </Box>
                <Button
                  size="small" variant="text"
                  onClick={() => navigate('/faculty/analytics')}
                  sx={{ color: '#4F46E5', fontWeight: 600, fontSize: '0.8125rem', px: 1 }}
                >
                  Full report
                </Button>
              </Box>

              {/* Pass rate meter */}
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>Pass Rate</Typography>
                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: passRate >= 60 ? '#10B981' : '#EF4444' }}>{passRate}%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate" value={passRate}
                  sx={{ height: 8, borderRadius: 4, '& .MuiLinearProgress-bar': { backgroundColor: passRate >= 60 ? '#10B981' : '#EF4444' } }}
                />
              </Box>

              {/* Avg score meter */}
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>Avg Score</Typography>
                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#4F46E5' }}>{averageScore}%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate" value={averageScore}
                  sx={{ height: 8, borderRadius: 4, '& .MuiLinearProgress-bar': { backgroundColor: '#4F46E5' } }}
                />
              </Box>

              {/* Top exams by participation */}
              {examResultCounts.length > 0 && (
                <>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1.5 }}>
                    By participation
                  </Typography>
                  {examResultCounts.slice(0, 4).map((e) => (
                    <Box key={e.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography sx={{ fontSize: '0.8125rem', color: '#475569', flex: 1 }} noWrap>{e.title}</Typography>
                      <Chip
                        label={e.count} size="small"
                        sx={{ ml: 1, height: 20, fontSize: '0.6875rem', fontWeight: 700, backgroundColor: '#EEF2FF', color: '#4F46E5' }}
                      />
                    </Box>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default FacultyDashboard;
