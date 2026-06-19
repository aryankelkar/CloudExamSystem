/**
 * AnalyticsPage.jsx — Faculty Analytics Dashboard — /faculty/analytics
 *
 * Reads from analyticsRepository.getAllDashboardData().
 * Zero changes to data fetching, calculations, or business logic.
 * Pure UI/UX redesign.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Grid, Paper, Card, CardContent, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, Tooltip, IconButton, CircularProgress,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { getAllDashboardData } from '../analytics/analyticsRepository';
import LoadingSpinner from '../components/LoadingSpinner';

const PIE_COLORS = ['#10B981', '#EF4444'];

const buildSummaryCards = (data) => [
  { label: 'Total Students',  value: data.overview.totalStudents,       color: '#4F46E5', bg: '#EEF2FF' },
  { label: 'Total Exams',     value: data.overview.totalExams,          color: '#7C3AED', bg: '#F5F3FF' },
  { label: 'Submissions',     value: data.overview.totalExamsSubmitted,  color: '#10B981', bg: '#ECFDF5' },
  { label: 'Average Score',   value: `${data.overview.averageScore}%`,  color: '#F59E0B', bg: '#FFFBEB' },
  { label: 'Pass Rate',       value: `${data.overview.passPercentage}%`,color: '#3B82F6', bg: '#EFF6FF' },
];

const formatTimestamp = (ts) => {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return String(ts); }
};

const customTooltipStyle = {
  borderRadius: 10,
  border: '1px solid #E5E7EB',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: '0.8125rem',
};

const AnalyticsPage = () => {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const result = await getAllDashboardData();
      setData(result);
    } catch (err) {
      setError('Failed to load analytics data. Please try again.');
      console.error('[AnalyticsPage]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  if (loading) return <LoadingSpinner message="Loading analytics…" />;
  if (error)   return <Alert severity="error">{error}</Alert>;
  if (!data)   return <Alert severity="warning">No analytics data available yet.</Alert>;

  const pieData = [
    { name: 'Pass', value: data.passFail.pass },
    { name: 'Fail', value: data.passFail.fail },
  ];
  const hasPieData = data.passFail.pass + data.passFail.fail > 0;

  const chartPaperSx = {
    p: 3,
    borderRadius: '16px',
    border: '1px solid #E2E8F0',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  };
  const chartTitleSx = { fontWeight: 700, color: '#0F172A', mb: 0.5, fontSize: '1rem' };
  const chartSubSx   = { fontSize: '0.8125rem', color: '#64748B', mb: 2.5 };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 700, color: '#0F172A', mb: 0.5 }}>
            Analytics Dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B' }}>
            Performance insights and exam statistics
          </Typography>
        </Box>
        <Tooltip title="Refresh data">
          <span>
            <IconButton
              onClick={() => load(true)}
              disabled={refreshing}
              sx={{
                border: '1px solid #E5E7EB',
                borderRadius: '10px',
                '&:hover': { backgroundColor: '#F8FAFC', borderColor: '#4F46E5' },
              }}
            >
              {refreshing
                ? <CircularProgress size={18} sx={{ color: '#4F46E5' }} />
                : <RefreshIcon sx={{ color: '#64748B', fontSize: 20 }} />
              }
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 5 }}>
        {buildSummaryCards(data).map(({ label, value, color, bg }) => (
          <Grid item xs={12} sm={6} md={2.4} key={label}>
            <Card
              sx={{
                borderRadius: '16px', border: '1px solid #E2E8F0',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                transition: 'all 0.2s ease',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 20px rgba(0,0,0,0.08)' },
              }}
            >
              <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <Box sx={{ width: 36, height: 36, borderRadius: '10px', backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                  <Box sx={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: color, opacity: 0.8 }} />
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: '1.875rem', color, lineHeight: 1, mb: 0.25 }}>
                  {value}
                </Typography>
                <Typography sx={{ color: '#64748B', fontWeight: 500, fontSize: '0.8125rem' }}>
                  {label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>

        {/* Pass vs Fail Pie */}
        {hasPieData && (
          <Grid item xs={12} md={4}>
            <Paper sx={chartPaperSx}>
              <Typography sx={chartTitleSx}>Pass vs Fail</Typography>
              <Typography sx={chartSubSx}>Overall result distribution</Typography>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    outerRadius={120}
                    innerRadius={55}
                    dataKey="value"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip contentStyle={customTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}

        {/* Average Marks by Subject */}
        {data.averageMarks.length > 0 && (
          <Grid item xs={12} md={hasPieData ? 8 : 12}>
            <Paper sx={chartPaperSx}>
              <Typography sx={chartTitleSx}>Average Marks by Subject</Typography>
              <Typography sx={chartSubSx}>Mean score percentage per subject</Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={data.averageMarks} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="subject" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <RTooltip contentStyle={customTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />
                  <Bar dataKey="average" fill="#4F46E5" name="Avg Score %" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}

        {/* Exam Participation */}
        {data.examParticipation.length > 0 && (
          <Grid item xs={12} md={6}>
            <Paper sx={chartPaperSx}>
              <Typography sx={chartTitleSx}>Exam Participation</Typography>
              <Typography sx={chartSubSx}>Registered vs completed per exam</Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={data.examParticipation} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="exam" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <RTooltip contentStyle={customTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />
                  <Bar dataKey="participants" fill="#4F46E5" name="Participants" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed"    fill="#10B981" name="Completed"   radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}

        {/* Top Students */}
        {data.topStudents.length > 0 && (
          <Grid item xs={12} md={6}>
            <Paper sx={chartPaperSx}>
              <Typography sx={chartTitleSx}>Top Students</Typography>
              <Typography sx={chartSubSx}>Ranked by average score percentage</Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={data.topStudents} barSize={28} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={90} />
                  <RTooltip contentStyle={customTooltipStyle} />
                  <Bar dataKey="score" fill="#7C3AED" name="Avg Score %" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}

        {/* Subject Performance */}
        {data.subjectPerformance.length > 0 && (
          <Grid item xs={12} md={6}>
            <Paper sx={chartPaperSx}>
              <Typography sx={chartTitleSx}>Subject Performance</Typography>
              <Typography sx={chartSubSx}>Score vs student count by subject</Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={data.subjectPerformance} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="subject" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <RTooltip contentStyle={customTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />
                  <Bar dataKey="score"    fill="#F59E0B" name="Score %"  radius={[4, 4, 0, 0]} />
                  <Bar dataKey="students" fill="#3B82F6" name="Students" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}

        {/* Monthly Trends */}
        {data.monthlyTrends.length > 0 && (
          <Grid item xs={12} md={6}>
            <Paper sx={chartPaperSx}>
              <Typography sx={chartTitleSx}>Monthly Trends</Typography>
              <Typography sx={chartSubSx}>Exams and student activity over time</Typography>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={data.monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <RTooltip contentStyle={customTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />
                  <Line type="monotone" dataKey="exams"    stroke="#4F46E5" strokeWidth={2.5} dot={{ r: 4, fill: '#4F46E5' }} name="Exams" />
                  <Line type="monotone" dataKey="students" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4, fill: '#10B981' }} name="Students" />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}

        {/* Daily Active Users (BigQuery only) */}
        {data.dau.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={chartPaperSx}>
              <Typography sx={chartTitleSx}>Daily Active Users — Last 30 Days</Typography>
              <Typography sx={chartSubSx}>Sourced from BigQuery GA4 export</Typography>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={data.dau}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <RTooltip contentStyle={customTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />
                  <Line type="monotone" dataKey="daily_active_users"    stroke="#4F46E5" strokeWidth={2} dot={false} name="All Users" />
                  <Line type="monotone" dataKey="daily_active_students" stroke="#10B981" strokeWidth={2} dot={false} name="Students" />
                  <Line type="monotone" dataKey="daily_active_faculty"  stroke="#F59E0B" strokeWidth={2} dot={false} name="Faculty" />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}

        {/* Recent Activity Table */}
        {data.recentActivity.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={chartPaperSx}>
              <Typography sx={chartTitleSx}>Recent Activity</Typography>
              <Typography sx={chartSubSx}>Last 10 exam submissions</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Student</TableCell>
                      <TableCell>Exam</TableCell>
                      <TableCell align="right">Score</TableCell>
                      <TableCell align="center">Status</TableCell>
                      <TableCell>Time</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.recentActivity.map((row, idx) => {
                      const statusVal = (row.status || row.pass_status || '').toLowerCase();
                      const isPass = statusVal === 'pass';
                      return (
                        <TableRow key={idx} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>
                              {row.studentName || row.user_id || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {row.examTitle || row.exam_title || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight={600}>
                              {row.percentage != null ? `${row.percentage}%` : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={(statusVal || '—').toUpperCase()}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.6875rem',
                                fontWeight: 700,
                                backgroundColor: isPass ? '#DCFCE7' : '#FEE2E2',
                                color: isPass ? '#15803D' : '#DC2626',
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {formatTimestamp(row.timestamp || row.submitted_at)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        )}

        {/* Empty state */}
        {data.averageMarks.length === 0 &&
          data.topStudents.length === 0 &&
          data.examParticipation.length === 0 && (
          <Grid item xs={12}>
            <Alert severity="info">
              No data available yet. Analytics will populate as students complete exams.
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default AnalyticsPage;
