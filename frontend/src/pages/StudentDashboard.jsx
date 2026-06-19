import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button,
  LinearProgress, Chip,
} from '@mui/material';
import {
  Assignment, Schedule, CheckCircle, TrendingUp, ArrowForward,
  CalendarToday, EmojiEvents, PlayArrow, BarChart, RepeatOutlined as RepeatIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { getAvailableExams, normaliseAttemptPolicy } from '../services/examService';
import { getStudentStatistics, getResultsByStudent } from '../services/resultService';
import useAuth from '../hooks/useAuth';

/* ─── KPI card ─────────────────────────────────────────────────────────────── */
const KPICard = ({ icon, value, label, sub, color, bg }) => (
  <Card
    sx={{
      height: '100%',
      background: '#fff',
      border: '1px solid #E2E8F0',
      borderRadius: '16px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      transition: 'all 0.2s ease',
      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 20px rgba(0,0,0,0.08)' },
    }}
  >
    <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
      <Box
        sx={{
          width: 46, height: 46, borderRadius: '13px',
          backgroundColor: bg, display: 'flex',
          alignItems: 'center', justifyContent: 'center', color, mb: 2,
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: '2rem', color: '#0F172A', lineHeight: 1, mb: 0.25 }}>
        {value}
      </Typography>
      <Typography sx={{ fontWeight: 600, color: '#475569', fontSize: '0.875rem', mb: 0.25 }}>
        {label}
      </Typography>
      {sub && (
        <Typography sx={{ fontSize: '0.75rem', color: '#94A3B8' }}>{sub}</Typography>
      )}
    </CardContent>
  </Card>
);

/* ─── Quick action button ──────────────────────────────────────────────────── */
const QuickAction = ({ icon, label, desc, onClick, color, bg }) => (
  <Box
    onClick={onClick}
    sx={{
      p: 2.5,
      borderRadius: '14px',
      border: '1px solid #E2E8F0',
      backgroundColor: '#fff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      transition: 'all 0.15s ease',
      '&:hover': {
        borderColor: color,
        backgroundColor: bg,
        transform: 'translateY(-1px)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
      },
    }}
  >
    <Box
      sx={{
        width: 40, height: 40, borderRadius: '11px',
        backgroundColor: bg, display: 'flex',
        alignItems: 'center', justifyContent: 'center', color, flexShrink: 0,
      }}
    >
      {icon}
    </Box>
    <Box>
      <Typography sx={{ fontWeight: 700, color: '#0F172A', fontSize: '0.875rem', lineHeight: 1.2 }}>
        {label}
      </Typography>
      <Typography sx={{ color: '#94A3B8', fontSize: '0.75rem', mt: 0.25 }}>
        {desc}
      </Typography>
    </Box>
    <ArrowForward sx={{ ml: 'auto', color: '#CBD5E1', fontSize: 18, flexShrink: 0 }} />
  </Box>
);

/* ─── Component ────────────────────────────────────────────────────────────── */
const StudentDashboard = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  const [exams,      setExams]      = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [results,    setResults]    = useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const load = async () => {
      try {
        const [examsData, statsData, resultsData] = await Promise.all([
          getAvailableExams(),
          getStudentStatistics(currentUser.uid),
          getResultsByStudent(currentUser.uid),
        ]);
        setExams(examsData);
        setStatistics(statsData);
        setResults(resultsData);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser]);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  const stats        = statistics || { totalExams: 0, passed: 0, failed: 0, averageScore: 0 };
  const displayName  = userProfile?.name || currentUser?.displayName || 'Student';
  const upcomingExams = exams.filter((e) => e.status === 'upcoming');
  const activeCount   = exams.filter((e) => e.status === 'active').length;

  /* Practice tests = multiple-attempt exams that are active/upcoming */
  const practiceTests = exams.filter(
    (e) => normaliseAttemptPolicy(e).attemptPolicy === 'multiple'
  ).length;

  /* Build attempt counts map: { examId → number of submissions } */
  const attemptCounts = {};
  results.forEach((r) => {
    attemptCounts[r.examId] = (attemptCounts[r.examId] ?? 0) + 1;
  });

  /* Count active exams where the student still has attempts remaining */
  const remainingAttempts = exams
    .filter((e) => e.status === 'active')
    .filter((e) => {
      const { attemptPolicy, maxAttempts } = normaliseAttemptPolicy(e);
      const used = attemptCounts[e.id] ?? 0;
      if (attemptPolicy === 'single') return used < 1;
      if (maxAttempts === null)        return true;        // unlimited
      return used < maxAttempts;
    }).length;

  /* Sort results newest-first, take top 5 */
  const recentResults = [...results]
    .sort((a, b) => {
      const ta = a.submittedAt?.toDate ? a.submittedAt.toDate() : new Date(a.submittedAt || 0);
      const tb = b.submittedAt?.toDate ? b.submittedAt.toDate() : new Date(b.submittedAt || 0);
      return tb - ta;
    })
    .slice(0, 5);

  return (
    <Box>
      {/* ── Welcome header ───────────────────────────────────────────────── */}
      <Box sx={{ mb: 4 }}>
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: { xs: '1.5rem', md: '1.875rem' },
            color: '#0F172A',
            mb: 0.5,
          }}
        >
          Welcome back, {displayName} 👋
        </Typography>
        <Typography sx={{ color: '#64748B', fontSize: '0.9375rem' }}>
          Here's your learning overview for today.
        </Typography>
      </Box>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <KPICard
            icon={<Assignment />}
            value={stats.totalExams}
            label="Total Exams"
            sub="All time"
            color="#4F46E5" bg="#EEF2FF"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KPICard
            icon={<Schedule />}
            value={upcomingExams.length}
            label="Upcoming"
            sub="Scheduled exams"
            color="#0EA5E9" bg="#E0F2FE"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KPICard
            icon={<CheckCircle />}
            value={stats.passed}
            label="Passed"
            sub={`${stats.failed} failed`}
            color="#10B981" bg="#D1FAE5"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KPICard
            icon={<TrendingUp />}
            value={`${stats.averageScore}%`}
            label="Average Score"
            sub="Across all exams"
            color="#F59E0B" bg="#FEF3C7"
          />
        </Grid>
        {/* Practice tests card — only shown when at least 1 exists */}
        {practiceTests > 0 && (
          <Grid item xs={12} sm={6} lg={3}>
            <KPICard
              icon={<RepeatIcon />}
              value={practiceTests}
              label="Practice Tests"
              sub="Multiple attempts"
              color="#7C3AED" bg="#F5F3FF"
            />
          </Grid>
        )}
        {/* Remaining attempts card — only when there are active exams */}
        {activeCount > 0 && (
          <Grid item xs={12} sm={6} lg={3}>
            <KPICard
              icon={<PlayArrow />}
              value={remainingAttempts}
              label="Exams Available"
              sub="Attempts remaining"
              color="#0EA5E9" bg="#E0F2FE"
            />
          </Grid>
        )}
      </Grid>

      {/* ── Recent Results + Upcoming Exams ──────────────────────────────── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>

        {/* Recent Results */}
        <Grid item xs={12} lg={6}>
          <Card
            sx={{
              borderRadius: '16px', border: '1px solid #E2E8F0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)', height: '100%',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EmojiEvents sx={{ color: '#F59E0B', fontSize: 20 }} />
                  <Typography sx={{ fontWeight: 700, color: '#0F172A', fontSize: '1rem' }}>
                    Recent Results
                  </Typography>
                </Box>
                <Button
                  size="small" variant="text" endIcon={<ArrowForward fontSize="small" />}
                  onClick={() => navigate('/student/results')}
                  sx={{ color: '#4F46E5', fontWeight: 600, fontSize: '0.8125rem', px: 1 }}
                >
                  View all
                </Button>
              </Box>

              {recentResults.length === 0 ? (
                <Box sx={{ py: 5, textAlign: 'center' }}>
                  <EmojiEvents sx={{ fontSize: 40, color: '#E2E8F0', mb: 1.5 }} />
                  <Typography sx={{ color: '#94A3B8', fontSize: '0.875rem' }}>
                    No results yet. Take your first exam!
                  </Typography>
                  <Button
                    variant="outlined" size="small" sx={{ mt: 2 }}
                    onClick={() => navigate('/student/exams')}
                  >
                    Browse Exams
                  </Button>
                </Box>
              ) : (
                <Box>
                  {recentResults.map((r, idx) => {
                    const isPass = r.status === 'pass';
                    return (
                      <Box
                        key={r.id}
                        onClick={() => navigate(`/result/${r.id}`)}
                        sx={{
                          py: 1.75, px: 1.5, borderRadius: '10px',
                          borderBottom: idx < recentResults.length - 1 ? '1px solid #F1F5F9' : 'none',
                          display: 'flex', alignItems: 'center', gap: 2,
                          cursor: 'pointer',
                          '&:hover': { backgroundColor: '#F8FAFC' },
                          transition: 'background 0.15s',
                        }}
                      >
                        {/* Score badge */}
                        <Box
                          sx={{
                            width: 44, height: 44, borderRadius: '12px',
                            backgroundColor: isPass ? '#D1FAE5' : '#FEE2E2',
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}
                        >
                          <Typography
                            sx={{
                              fontWeight: 800, fontSize: '0.875rem', lineHeight: 1,
                              color: isPass ? '#059669' : '#DC2626',
                            }}
                          >
                            {r.percentage}
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: '0.5625rem', fontWeight: 600,
                              color: isPass ? '#059669' : '#DC2626',
                            }}
                          >
                            %
                          </Typography>
                        </Box>

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            sx={{ fontWeight: 600, color: '#0F172A', fontSize: '0.875rem', lineHeight: 1.2 }}
                            noWrap
                          >
                            {r.examTitle}
                          </Typography>
                          <Typography
                            sx={{ color: '#94A3B8', fontSize: '0.75rem', mt: 0.25 }}
                            noWrap
                          >
                            {r.subject}
                          </Typography>
                          <Box sx={{ mt: 0.75 }}>
                            <LinearProgress
                              variant="determinate"
                              value={r.percentage}
                              sx={{
                                height: 3, borderRadius: 2,
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor: isPass ? '#10B981' : '#EF4444',
                                },
                              }}
                            />
                          </Box>
                        </Box>

                        <Chip
                          label={isPass ? 'Pass' : 'Fail'}
                          size="small"
                          sx={{
                            height: 22, fontSize: '0.6875rem', fontWeight: 700, flexShrink: 0,
                            backgroundColor: isPass ? '#D1FAE5' : '#FEE2E2',
                            color: isPass ? '#059669' : '#DC2626',
                          }}
                        />
                      </Box>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Upcoming Exams */}
        <Grid item xs={12} lg={6}>
          <Card
            sx={{
              borderRadius: '16px', border: '1px solid #E2E8F0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)', height: '100%',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarToday sx={{ color: '#0EA5E9', fontSize: 20 }} />
                  <Typography sx={{ fontWeight: 700, color: '#0F172A', fontSize: '1rem' }}>
                    Upcoming Exams
                  </Typography>
                </Box>
                <Chip
                  label={upcomingExams.length}
                  size="small"
                  sx={{
                    height: 22, fontSize: '0.75rem', fontWeight: 700,
                    backgroundColor: '#E0F2FE', color: '#0284C7',
                  }}
                />
              </Box>

              {upcomingExams.length === 0 ? (
                <Box sx={{ py: 5, textAlign: 'center' }}>
                  <CalendarToday sx={{ fontSize: 40, color: '#E2E8F0', mb: 1.5 }} />
                  <Typography sx={{ color: '#94A3B8', fontSize: '0.875rem' }}>
                    No upcoming exams scheduled.
                  </Typography>
                </Box>
              ) : (
                <Box>
                  {upcomingExams.slice(0, 5).map((exam, idx) => (
                    <Box
                      key={exam.id}
                      sx={{
                        py: 1.75, px: 1.5, borderRadius: '10px',
                        borderBottom: idx < Math.min(upcomingExams.length, 5) - 1
                          ? '1px solid #F1F5F9' : 'none',
                        display: 'flex', alignItems: 'center', gap: 2,
                      }}
                    >
                      <Box
                        sx={{
                          width: 44, height: 44, borderRadius: '12px',
                          backgroundColor: '#EFF6FF',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Assignment sx={{ color: '#3B82F6', fontSize: 20 }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          sx={{ fontWeight: 600, color: '#0F172A', fontSize: '0.875rem' }}
                          noWrap
                        >
                          {exam.title}
                        </Typography>
                        <Typography sx={{ color: '#94A3B8', fontSize: '0.75rem', mt: 0.25 }}>
                          {exam.subject} · {exam.duration} min · {exam.questionCount ?? 0} Qs
                        </Typography>
                      </Box>
                      <Chip
                        label="Upcoming"
                        size="small"
                        sx={{
                          height: 22, fontSize: '0.6875rem', fontWeight: 600,
                          backgroundColor: '#DBEAFE', color: '#1D4ED8', flexShrink: 0,
                        }}
                      />
                    </Box>
                  ))}

                  {upcomingExams.length > 5 && (
                    <Box sx={{ pt: 2, textAlign: 'center' }}>
                      <Button
                        size="small" variant="text" endIcon={<ArrowForward fontSize="small" />}
                        onClick={() => navigate('/student/exams')}
                        sx={{ color: '#4F46E5', fontWeight: 600, fontSize: '0.8125rem' }}
                      >
                        {upcomingExams.length - 5} more upcoming
                      </Button>
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Quick Actions ─────────────────────────────────────────────────── */}
      <Box sx={{ mb: 2 }}>
        <Typography sx={{ fontWeight: 700, color: '#0F172A', fontSize: '1rem', mb: 0.5 }}>
          Quick Actions
        </Typography>
        <Typography sx={{ color: '#64748B', fontSize: '0.8125rem', mb: 2.5 }}>
          Jump straight to what you need
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <QuickAction
              icon={<PlayArrow />}
              label="Start an Exam"
              desc={`${activeCount} active exam${activeCount !== 1 ? 's' : ''} available`}
              onClick={() => navigate('/student/exams')}
              color="#4F46E5" bg="#EEF2FF"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <QuickAction
              icon={<BarChart />}
              label="View My Results"
              desc={`${results.length} result${results.length !== 1 ? 's' : ''} recorded`}
              onClick={() => navigate('/student/results')}
              color="#10B981" bg="#D1FAE5"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <QuickAction
              icon={<Schedule />}
              label="Upcoming Schedule"
              desc={`${upcomingExams.length} exam${upcomingExams.length !== 1 ? 's' : ''} coming up`}
              onClick={() => navigate('/student/exams')}
              color="#0EA5E9" bg="#E0F2FE"
            />
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default StudentDashboard;
