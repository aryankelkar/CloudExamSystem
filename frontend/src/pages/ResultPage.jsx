import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, Grid, Button, Chip, LinearProgress,
  Alert, Divider, Tooltip, TextField, InputAdornment, Select,
  MenuItem, FormControl, Collapse, IconButton,
} from '@mui/material';
import {
  CheckCircle, Cancel, Download, ArrowBack, TrendingUp,
  EmojiEvents, MilitaryTech, WorkspacePremium, School,
  WarningAmberOutlined, CalendarToday, Person, Subject,
  AccessTime, QuizOutlined, RepeatOutlined, HomeOutlined,
  Search, ExpandMore, ExpandLess, FilterList,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { getResultById, getResultsByStudent, getAllResults } from '../services/resultService';
import { generateReportText } from '../utils/resultUtils';
import LoadingSpinner from '../components/LoadingSpinner';
import useAuth from '../hooks/useAuth';
import { ROLES, ROUTES } from '../utils/constants';
import { trackResultViewed } from '../services/analyticsService';
import { logAuditEvent } from '../services/auditService';
import { AUDIT_ACTIONS } from '../utils/auditActions';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const getNavRoutes = (role) => {
  if (role === ROLES.FACULTY) {
    return {
      dashboard:        ROUTES.FACULTY,
      resultsList:      ROUTES.FACULTY_RESULTS,
      dashboardLabel:   'Back to Dashboard',
      resultsListLabel: 'All Results',
    };
  }
  return {
    dashboard:        ROUTES.STUDENT,
    resultsList:      ROUTES.STUDENT_RESULTS,
    dashboardLabel:   'Back to Dashboard',
    resultsListLabel: 'My Results',
  };
};

const formatDate = (ts) => {
  if (!ts) return 'N/A';
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return 'N/A'; }
};

/** Derive letter grade from percentage */
const getGrade = (pct) => {
  if (pct >= 90) return { letter: 'A+', label: 'Outstanding',  color: '#059669', bg: '#D1FAE5' };
  if (pct >= 80) return { letter: 'A',  label: 'Excellent',    color: '#0284C7', bg: '#E0F2FE' };
  if (pct >= 70) return { letter: 'B',  label: 'Good',         color: '#7C3AED', bg: '#F5F3FF' };
  if (pct >= 60) return { letter: 'C',  label: 'Satisfactory', color: '#D97706', bg: '#FEF3C7' };
  if (pct >= 50) return { letter: 'D',  label: 'Passing',      color: '#EA580C', bg: '#FFEDD5' };
  return             { letter: 'F',  label: 'Fail',          color: '#DC2626', bg: '#FEE2E2' };
};

/** Choose a hero icon based on score */
const HeroIcon = ({ pct, isPass }) => {
  const sz = { fontSize: 40 };
  if (pct >= 90) return <EmojiEvents sx={{ ...sz, color: '#F59E0B' }} />;
  if (pct >= 75) return <MilitaryTech sx={{ ...sz, color: '#6366F1' }} />;
  if (isPass)    return <WorkspacePremium sx={{ ...sz, color: '#10B981' }} />;
  return              <WarningAmberOutlined sx={{ ...sz, color: '#EF4444' }} />;
};

/* ─── Reusable sub-components ────────────────────────────────────────────── */

/** KPI card with gradient accent bar */
const KPICard = ({ icon, value, label, desc, color, bg }) => (
  <Paper
    sx={{
      p: 2.5,
      borderRadius: '14px',
      border: '1px solid #E5E7EB',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      height: '100%',
      transition: 'all 0.2s ease',
      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.08)' },
      borderTop: `3px solid ${color}`,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
      <Box sx={{ width: 38, height: 38, borderRadius: '10px', backgroundColor: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: '1.625rem', color: '#0F172A', lineHeight: 1 }}>
        {value}
      </Typography>
    </Box>
    <Typography sx={{ fontWeight: 600, color: '#475569', fontSize: '0.8125rem' }}>{label}</Typography>
    {desc && <Typography sx={{ color: '#94A3B8', fontSize: '0.6875rem', mt: 0.25 }}>{desc}</Typography>}
  </Paper>
);

/** Horizontal progress bar row for comparisons */
const ProgressRow = ({ label, value, max = 100, color = '#4F46E5', highlight = false }) => (
  <Box sx={{ mb: 2 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
      <Typography sx={{ fontSize: '0.8125rem', fontWeight: highlight ? 700 : 500,
        color: highlight ? '#0F172A' : '#64748B' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color }}>
        {value}%
      </Typography>
    </Box>
    <LinearProgress variant="determinate" value={Math.min(value, 100)}
      sx={{ height: highlight ? 8 : 6, borderRadius: 4,
        '& .MuiLinearProgress-bar': { backgroundColor: color, borderRadius: 4 } }} />
  </Box>
);

/** Single insight row */
const InsightRow = ({ text, type = 'success' }) => {
  const cfg = {
    success: { icon: <CheckCircle sx={{ fontSize: 16, color: '#10B981' }} />, bg: '#F0FDF4', border: '#A7F3D0' },
    warning: { icon: <WarningAmberOutlined sx={{ fontSize: 16, color: '#F59E0B' }} />, bg: '#FFFBEB', border: '#FDE68A' },
    info:    { icon: <School sx={{ fontSize: 16, color: '#6366F1' }} />, bg: '#EEF2FF', border: '#C7D2FE' },
  }[type];
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5,
      borderRadius: '10px', backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`, mb: 1 }}>
      {cfg.icon}
      <Typography sx={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>{text}</Typography>
    </Box>
  );
};

/* ─── Info stat row for summary card ─────────────────────────────────────── */
const StatRow = ({ icon, label, value, valueColor }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25,
    borderBottom: '1px solid #F1F5F9', '&:last-child': { borderBottom: 'none' } }}>
    <Box sx={{ color: '#9CA3AF', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</Box>
    <Typography sx={{ fontSize: '0.8125rem', color: '#64748B', flex: 1 }}>{label}</Typography>
    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: valueColor || '#0F172A' }}>
      {value}
    </Typography>
  </Box>
);

/* ─── Main component ──────────────────────────────────────────────────────── */
const ResultPage = () => {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { currentUser, role } = useAuth();

  const [result,     setResult]     = useState(null);
  const [allResults, setAllResults] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  /* ── List-view UI state — always at top level (rules of hooks) ── */
  const [search,       setSearch]       = useState('');
  const [sortBy,       setSortBy]       = useState('newest');
  const [quickFilter,  setQuickFilter]  = useState('all');
  const [expandedExams,setExpandedExams]= useState({});

  const nav = getNavRoutes(role);

  /* All Firebase calls, analytics, and audit logging preserved exactly */
  useEffect(() => {
    const load = async () => {
      try {
        if (id) {
          const r = await getResultById(id);
          setResult(r);
          trackResultViewed(r.examId);
          logAuditEvent({
            action:     AUDIT_ACTIONS.RESULT_VIEWED,
            userId:     currentUser?.uid ?? 'anonymous',
            userRole:   role ?? 'unknown',
            targetId:   r.id,
            targetType: 'result',
            metadata: {
              examId:     r.examId,
              examTitle:  r.examTitle  ?? '',
              percentage: r.percentage ?? 0,
              status:     r.status     ?? '',
            },
          });
        } else if (currentUser) {
          const results = role === ROLES.FACULTY
            ? await getAllResults()
            : await getResultsByStudent(currentUser.uid);
          setAllResults(results);
        }
      } catch (err) {
        setError(err.message || 'Failed to load result');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, currentUser, role]);

  /* Report download — generateReportText preserved exactly */
  const handleDownload = () => {
    const text = generateReportText(result);
    const blob = new Blob([text], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `result_${result?.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Sorting helper (stable reference for useMemo) ─────────────────── */
  const toMs = (ts) => {
    if (!ts) return 0;
    try { return (ts?.toDate ? ts.toDate() : new Date(ts)).getTime(); }
    catch { return 0; }
  };

  const now     = Date.now();
  const WEEK_MS = 7 * 24 * 3600 * 1000;
  const MON_MS  = 30 * 24 * 3600 * 1000;

  const SORT_FNS = {
    newest:  (a, b) => { const d = toMs(b.submittedAt) - toMs(a.submittedAt); return d !== 0 ? d : (a.examTitle ?? '').localeCompare(b.examTitle ?? ''); },
    oldest:  (a, b) => { const d = toMs(a.submittedAt) - toMs(b.submittedAt); return d !== 0 ? d : (a.examTitle ?? '').localeCompare(b.examTitle ?? ''); },
    highest: (a, b) => (b.percentage ?? 0) - (a.percentage ?? 0),
    lowest:  (a, b) => (a.percentage ?? 0) - (b.percentage ?? 0),
    az:      (a, b) => (a.examTitle ?? '').localeCompare(b.examTitle ?? ''),
    za:      (a, b) => (b.examTitle ?? '').localeCompare(a.examTitle ?? ''),
    passed:  (a, b) => { if (a.status === b.status) return toMs(b.submittedAt) - toMs(a.submittedAt); return a.status === 'pass' ? -1 : 1; },
    failed:  (a, b) => { if (a.status === b.status) return toMs(b.submittedAt) - toMs(a.submittedAt); return a.status === 'fail' ? -1 : 1; },
  };

  const dateLabel = (ts) => {
    const diff = now - toMs(ts);
    if (diff < 86400000)  return 'Today';
    if (diff < 172800000) return 'Yesterday';
    if (diff < WEEK_MS)   return 'This Week';
    if (diff < MON_MS)    return 'This Month';
    return 'Older Results';
  };

  const GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older Results'];

  /* ── Derived list stats (always computed, cheap) ────────────────────── */
  const totalCount = allResults.length;
  const passCount  = allResults.filter((r) => r.status === 'pass').length;
  const failCount  = totalCount - passCount;
  const avgScore   = totalCount > 0
    ? Math.round(allResults.reduce((s, r) => s + (r.percentage ?? 0), 0) / totalCount)
    : 0;

  /* ── Filter + sort ─────────────────────────────────────────────────── */
  const processed = useMemo(() => {
    let list = [...allResults];
    if (quickFilter === 'passed') list = list.filter((r) => r.status === 'pass');
    if (quickFilter === 'failed') list = list.filter((r) => r.status !== 'pass');
    if (quickFilter === 'week')   list = list.filter((r) => now - toMs(r.submittedAt) <= WEEK_MS);
    if (quickFilter === 'month')  list = list.filter((r) => now - toMs(r.submittedAt) <= MON_MS);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        (r.examTitle   ?? '').toLowerCase().includes(q) ||
        (r.subject     ?? '').toLowerCase().includes(q) ||
        (r.status      ?? '').toLowerCase().includes(q) ||
        String(r.attemptNumber ?? '').includes(q)
      );
    }
    list.sort(SORT_FNS[sortBy] ?? SORT_FNS.newest);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allResults, search, sortBy, quickFilter]);

  /* ── Date grouping ─────────────────────────────────────────────────── */
  const grouped = useMemo(() => {
    const map = {};
    processed.forEach((r) => {
      const lbl = dateLabel(r.submittedAt);
      if (!map[lbl]) map[lbl] = [];
      map[lbl].push(r);
    });
    return GROUP_ORDER.filter((g) => map[g]).map((g) => ({ group: g, items: map[g] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processed]);

  /* ── Attempt map: examId → results sorted newest-first ─────────────── */
  const attemptMap = useMemo(() => {
    const m = {};
    allResults.forEach((r) => {
      if (!m[r.examId]) m[r.examId] = [];
      m[r.examId].push(r);
    });
    Object.values(m).forEach((arr) => arr.sort((a, b) => toMs(b.submittedAt) - toMs(a.submittedAt)));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allResults]);

  const toggleExpand = (examId) =>
    setExpandedExams((p) => ({ ...p, [examId]: !p[examId] }));

  if (loading) return <LoadingSpinner message="Loading result..." />;
  if (error)   return <Alert severity="error">{error}</Alert>;

  /* ── List view (no :id param) ───────────────────────────────────────── */
  if (!id) {
    const listTitle = role === ROLES.FACULTY ? 'All Results' : 'My Results';

    return (
      <Box>
        {/* ── Page header ─────────────────────────────────────────────── */}
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.5rem', md: '1.875rem' }, color: '#0F172A', mb: 0.5 }}>
            {listTitle}
          </Typography>
          <Typography sx={{ color: '#64748B', fontSize: '0.9375rem' }}>
            Your exam submission history, sorted by most recent.
          </Typography>
        </Box>

        {/* ── Summary bar ─────────────────────────────────────────────── */}
        {totalCount > 0 && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Total Results', value: totalCount, color: '#4F46E5', bg: '#EEF2FF' },
              { label: 'Passed',        value: passCount,  color: '#10B981', bg: '#ECFDF5' },
              { label: 'Failed',        value: failCount,  color: '#EF4444', bg: '#FEF2F2' },
              { label: 'Average Score', value: `${avgScore}%`, color: '#F59E0B', bg: '#FFFBEB' },
            ].map(({ label, value, color, bg }) => (
              <Grid item xs={6} sm={3} key={label}>
                <Paper sx={{ p: 2, borderRadius: '12px', border: '1px solid #E5E7EB',
                  borderTop: `3px solid ${color}`, textAlign: 'center' }}>
                  <Typography sx={{ fontWeight: 800, fontSize: '1.5rem', color, lineHeight: 1 }}>{value}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748B', mt: 0.25, fontWeight: 500 }}>{label}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}

        {/* ── Controls: search + sort ──────────────────────────────────── */}
        <Paper sx={{ p: 2, mb: 3, borderRadius: '14px', border: '1px solid #E2E8F0' }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              placeholder="Search exam, subject, status…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              sx={{ flex: '1 1 220px', minWidth: 180 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: '#94A3B8', fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                startAdornment={<FilterList sx={{ fontSize: 16, color: '#94A3B8', mr: 0.5 }} />}
              >
                <MenuItem value="newest">Most Recent</MenuItem>
                <MenuItem value="oldest">Oldest First</MenuItem>
                <MenuItem value="highest">Highest Score</MenuItem>
                <MenuItem value="lowest">Lowest Score</MenuItem>
                <MenuItem value="az">A–Z Exam Name</MenuItem>
                <MenuItem value="za">Z–A Exam Name</MenuItem>
                <MenuItem value="passed">Passed First</MenuItem>
                <MenuItem value="failed">Failed First</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Paper>

        {/* ── Quick filter chips ───────────────────────────────────────── */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
          {[
            { key: 'all',    label: `All (${totalCount})` },
            { key: 'passed', label: `Passed (${passCount})` },
            { key: 'failed', label: `Failed (${failCount})` },
            { key: 'week',   label: 'This Week' },
            { key: 'month',  label: 'This Month' },
          ].map(({ key, label }) => (
            <Chip
              key={key}
              label={label}
              onClick={() => setQuickFilter(key)}
              sx={{
                fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer',
                backgroundColor: quickFilter === key ? '#4F46E5' : '#F1F5F9',
                color: quickFilter === key ? '#fff' : '#475569',
                '&:hover': { backgroundColor: quickFilter === key ? '#4338CA' : '#E2E8F0' },
              }}
            />
          ))}
        </Box>

        {/* ── Empty states ─────────────────────────────────────────────── */}
        {totalCount === 0 && (
          <Box sx={{ py: 12, textAlign: 'center', backgroundColor: '#fff',
            borderRadius: '16px', border: '1px solid #E5E7EB' }}>
            <TrendingUp sx={{ fontSize: 52, color: '#CBD5E1', mb: 2 }} />
            <Typography sx={{ color: '#64748B', fontWeight: 600, fontSize: '1rem' }}>
              You have not completed any exams yet.
            </Typography>
            <Typography sx={{ color: '#94A3B8', fontSize: '0.875rem', mt: 0.5 }}>
              Results will appear here after your first submission.
            </Typography>
            <Button variant="outlined" sx={{ mt: 3, fontWeight: 600 }}
              onClick={() => navigate('/student/exams')}>
              Browse Exams
            </Button>
          </Box>
        )}

        {totalCount > 0 && processed.length === 0 && (
          <Box sx={{ py: 8, textAlign: 'center', backgroundColor: '#fff',
            borderRadius: '16px', border: '1px solid #E5E7EB' }}>
            <Search sx={{ fontSize: 40, color: '#CBD5E1', mb: 1.5 }} />
            <Typography sx={{ color: '#64748B', fontWeight: 600, fontSize: '1rem' }}>
              No exams match your search.
            </Typography>
            <Typography sx={{ color: '#94A3B8', fontSize: '0.875rem', mt: 0.5 }}>
              Try a different keyword or clear the filters.
            </Typography>
          </Box>
        )}

        {/* ── Grouped results ──────────────────────────────────────────── */}
        {grouped.map(({ group, items }) => (
          <Box key={group} sx={{ mb: 4 }}>
            {/* Group header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Typography sx={{ fontWeight: 700, color: '#0F172A', fontSize: '0.9375rem' }}>
                {group}
              </Typography>
              <Chip label={items.length} size="small"
                sx={{ height: 20, fontSize: '0.6875rem', fontWeight: 700,
                  backgroundColor: '#EEF2FF', color: '#4F46E5' }} />
              <Box sx={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
            </Box>

            <Grid container spacing={2.5}>
              {items.map((r, idx) => {
                const siblings    = attemptMap[r.examId] ?? [];
                const hasMulti    = siblings.length > 1;
                const isExpanded  = !!expandedExams[r.examId];
                const isPass      = r.status === 'pass';
                const attempt     = r.attemptNumber ?? 1;

                return (
                  <Grid item xs={12} sm={6} lg={4} key={r.id}>
                    <Paper
                      sx={{
                        p: 0,
                        borderRadius: '14px',
                        border: '1px solid',
                        borderColor: idx === 0 && group === 'Today' ? '#C7D2FE' : '#E5E7EB',
                        overflow: 'hidden',
                        transition: 'all 0.2s ease',
                        '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' },
                      }}
                    >
                      {/* Accent bar */}
                      <Box sx={{ height: 3, backgroundColor: isPass ? '#10B981' : '#EF4444' }} />

                      <Box sx={{ p: 2.5 }}>
                        {/* Header row */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Box sx={{ flex: 1, mr: 1 }}>
                            <Typography sx={{ fontWeight: 700, color: '#0F172A', fontSize: '0.9375rem', lineHeight: 1.3 }} noWrap>
                              {r.examTitle}
                            </Typography>
                            <Typography sx={{ fontSize: '0.8125rem', color: '#64748B', mt: 0.25 }}>
                              {r.subject}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                            <Chip
                              label={isPass ? 'Pass' : 'Fail'}
                              size="small"
                              sx={{ height: 22, fontSize: '0.6875rem', fontWeight: 700,
                                backgroundColor: isPass ? '#DCFCE7' : '#FEE2E2',
                                color: isPass ? '#15803D' : '#DC2626' }}
                            />
                            {idx === 0 && group === 'Today' && (
                              <Chip label="Latest" size="small"
                                sx={{ height: 18, fontSize: '0.5625rem', fontWeight: 700,
                                  backgroundColor: '#EEF2FF', color: '#4F46E5' }} />
                            )}
                          </Box>
                        </Box>

                        {/* Attempt badge */}
                        {(attempt > 1 || hasMulti) && (
                          <Chip label={`Attempt ${attempt}`} size="small"
                            sx={{ height: 18, fontSize: '0.625rem', fontWeight: 700, mb: 1.25,
                              backgroundColor: '#FEF3C7', color: '#92400E' }} />
                        )}

                        {/* Marks progress bar */}
                        <Box sx={{ mb: 1.5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography sx={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 500 }}>Marks</Typography>
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F172A' }}>
                              {r.obtainedMarks ?? r.score} / {r.totalMarks}
                            </Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={r.percentage ?? 0}
                            sx={{ height: 5, borderRadius: 3,
                              '& .MuiLinearProgress-bar': { backgroundColor: isPass ? '#10B981' : '#EF4444' } }} />
                        </Box>

                        {/* Percentage + date */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography sx={{ fontWeight: 800, fontSize: '1.375rem',
                            color: isPass ? '#10B981' : '#EF4444' }}>
                            {r.percentage}%
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CalendarToday sx={{ fontSize: 11, color: '#94A3B8' }} />
                            <Typography sx={{ fontSize: '0.6875rem', color: '#94A3B8' }}>
                              {formatDate(r.submittedAt)}
                            </Typography>
                          </Box>
                        </Box>

                        {/* Actions */}
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button fullWidth variant="outlined" size="small"
                            onClick={() => navigate(`/result/${r.id}`)}
                            sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                            View Details
                          </Button>
                          {hasMulti && (
                            <Tooltip title={isExpanded ? 'Hide history' : 'View attempt history'}>
                              <IconButton size="small" onClick={() => toggleExpand(r.examId)}
                                sx={{ border: '1px solid #E5E7EB', borderRadius: '8px', flexShrink: 0 }}>
                                {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>

                        {/* Expandable attempt history */}
                        {hasMulti && (
                          <Collapse in={isExpanded}>
                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed #E5E7EB' }}>
                              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B',
                                textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1.5 }}>
                                Attempt History
                              </Typography>
                              {siblings.map((s, si) => (
                                <Box key={s.id}
                                  sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1,
                                    cursor: 'pointer', p: 1, borderRadius: '8px',
                                    '&:hover': { backgroundColor: '#F8FAFC' },
                                    transition: 'background 0.12s' }}
                                  onClick={() => navigate(`/result/${s.id}`)}
                                >
                                  <Box sx={{ width: 24, height: 24, borderRadius: '6px', flexShrink: 0,
                                    backgroundColor: s.status === 'pass' ? '#ECFDF5' : '#FEF2F2',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Typography sx={{ fontSize: '0.625rem', fontWeight: 800,
                                      color: s.status === 'pass' ? '#10B981' : '#EF4444' }}>
                                      {si + 1}
                                    </Typography>
                                  </Box>
                                  <Box sx={{ flex: 1 }}>
                                    <Typography sx={{ fontSize: '0.75rem', color: '#64748B' }}>
                                      {s.attemptNumber ? `Attempt ${s.attemptNumber}` : `Attempt ${siblings.length - si}`}
                                      {si === 0 && <Chip label="Latest" size="small"
                                        sx={{ ml: 0.75, height: 14, fontSize: '0.5rem', fontWeight: 700,
                                          backgroundColor: '#EEF2FF', color: '#4F46E5' }} />}
                                    </Typography>
                                  </Box>
                                  <Typography sx={{ fontWeight: 800, fontSize: '0.875rem',
                                    color: s.status === 'pass' ? '#10B981' : '#EF4444' }}>
                                    {s.percentage}%
                                  </Typography>
                                </Box>
                              ))}
                            </Box>
                          </Collapse>
                        )}
                      </Box>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        ))}
      </Box>
    );
  }

  if (!result) return <Alert severity="error">Result not found</Alert>;

  /* ── Derived values — strict separation of marks vs question counts ───── */
  const isPass  = result.status === 'pass';
  const pct     = result.percentage ?? 0;
  const grade   = getGrade(pct);

  // ── MARKS (never used as question counts) ─────────────────────────────
  const obtainedMarks = result.obtainedMarks ?? result.score ?? 0;
  const totalMarks    = result.totalMarks    ?? 0;
  const passingMark   = Math.ceil(totalMarks * 0.5);

  // ── QUESTION COUNTS (never used as marks) ─────────────────────────────
  //
  // LEGACY DATA GUARD:
  // Old result documents written before the Cloud Function fix stored
  // `correctAnswers = obtainedMarks` and `wrongAnswers = totalMarks - obtainedMarks`
  // (marks were incremented instead of the count +1).
  //
  // Detection: if `totalQuestions` is stored and `correctAnswers > totalQuestions`,
  // the document is legacy — its question-count fields are unreliable marks.
  // In that case we cannot recover the true per-question counts from this
  // document alone, so we show what we can derive safely.
  //
  // Safe derivation when legacy is detected:
  //   totalQuestions = result.totalQuestions (stored by the CF as questions.length)
  //   correctAnswers = cannot know exactly → derive from pct and marks
  //   wrongAnswers   = totalQuestions - correctAnswers - unanswered
  //
  // When result.totalQuestions is missing AND correctAnswers looks like marks,
  // we conservatively show totalQuestions = 0 and let the UI handle gracefully.

  const storedTotalQ  = result.totalQuestions   ?? null;
  const rawCorrect    = result.correctAnswers    ?? null;
  const rawWrong      = result.wrongAnswers      ?? null;
  const rawUnanswered = result.unanswered        ?? 0;

  // Determine if this is a legacy document (correctAnswers contains marks value)
  const isLegacyDoc = storedTotalQ !== null && rawCorrect !== null
    && rawCorrect > storedTotalQ;

  let totalQuestions, correctAnswers, wrongAnswers, unanswered;

  if (!isLegacyDoc && rawCorrect !== null && rawWrong !== null) {
    // ── Modern document: all fields are trustworthy ──────────────────────
    correctAnswers = rawCorrect;
    wrongAnswers   = rawWrong;
    unanswered     = rawUnanswered;
    totalQuestions = storedTotalQ
      ?? ((correctAnswers + wrongAnswers + unanswered) || 0);

  } else if (storedTotalQ !== null) {
    // ── Legacy document but totalQuestions is stored ─────────────────────
    // We know how many questions there were.
    // We cannot know exactly which were correct vs wrong from marks alone,
    // so display N/A-safe zeros and let the user see marks correctly.
    totalQuestions = storedTotalQ;
    correctAnswers = null; // signals "unknown" to the UI
    wrongAnswers   = null;
    unanswered     = rawUnanswered <= storedTotalQ ? rawUnanswered : 0;

  } else {
    // ── Completely legacy document: no reliable question counts ───────────
    totalQuestions = 0;
    correctAnswers = null;
    wrongAnswers   = null;
    unanswered     = 0;
  }

  // UI-safe display values — never show null to the user
  const displayCorrect    = correctAnswers ?? '—';
  const displayWrong      = wrongAnswers   ?? '—';
  const displayTotal      = totalQuestions > 0 ? totalQuestions : '—';

  const attemptNum = result.attemptNumber ?? 1;
  const isMulti    = attemptNum > 1;

  /* ── Insights — use question counts for Q-stats, marks for score ─────── */
  const insights = [];
  if (isPass) {
    insights.push({ text: 'Successfully passed the examination', type: 'success' });
    if (correctAnswers !== null && totalQuestions > 0) {
      insights.push({ text: `Answered ${correctAnswers} of ${totalQuestions} question${totalQuestions !== 1 ? 's' : ''} correctly`, type: 'success' });
    }
    if (pct >= 90) insights.push({ text: 'Outstanding performance — top tier result', type: 'success' });
    else if (pct >= 75) insights.push({ text: 'Strong performance above passing threshold', type: 'success' });
    else insights.push({ text: 'Passed with satisfactory marks', type: 'info' });
    insights.push({ text: `Grade ${grade.letter} — ${grade.label}`, type: 'info' });
  } else {
    insights.push({ text: 'Did not meet the passing threshold for this exam', type: 'warning' });
    if (wrongAnswers !== null && wrongAnswers > 0) {
      insights.push({ text: `${wrongAnswers} question${wrongAnswers !== 1 ? 's' : ''} answered incorrectly`, type: 'warning' });
    }
    insights.push({ text: 'Review incorrect concepts before reattempting', type: 'warning' });
    insights.push({ text: `${passingMark} marks required to pass — scored ${obtainedMarks}`, type: 'info' });
  }
  if (unanswered > 0) {
    insights.push({ text: `${unanswered} question${unanswered !== 1 ? 's' : ''} left unanswered`, type: 'warning' });
  }

  /* ── Single-result render ─────────────────────────────────────────────── */
  return (
    <Box>
      {/* ── Back nav ─────────────────────────────────────────────────────── */}
      <Button
        startIcon={<ArrowBack fontSize="small" />}
        onClick={() => navigate(nav.resultsList)}
        sx={{ mb: 3, color: '#64748B', pl: 0, '&:hover': { color: '#4F46E5' } }}
      >
        {nav.resultsListLabel}
      </Button>

      {/* ════════════════════════════════════════════════════════════════════
          COMPACT HERO HEADER
      ════════════════════════════════════════════════════════════════════ */}
      <Paper
        sx={{
          mb: 3,
          borderRadius: '16px',
          border: `1px solid ${isPass ? '#A7F3D0' : '#FECACA'}`,
          overflow: 'hidden',
        }}
      >
        {/* Thin colour bar at top */}
        <Box sx={{ height: 4, background: isPass
          ? 'linear-gradient(90deg, #10B981, #34D399)'
          : 'linear-gradient(90deg, #EF4444, #F87171)' }} />

        <Box sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          <Grid container spacing={2} alignItems="center">

            {/* Left: exam info */}
            <Grid item xs={12} md={7}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ flexShrink: 0, mt: 0.25 }}>
                  <HeroIcon pct={pct} isPass={isPass} />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.125rem', sm: '1.375rem' },
                    color: '#0F172A', lineHeight: 1.2, mb: 0.5 }}>
                    {result.examTitle}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: '0.875rem', color: '#64748B', fontWeight: 500 }}>
                      {result.subject}
                    </Typography>
                    <Box sx={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: '#CBD5E1' }} />
                    <Typography sx={{ fontSize: '0.875rem', color: '#64748B' }}>
                      {result.studentName}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75 }}>
                    <CalendarToday sx={{ fontSize: 13, color: '#94A3B8' }} />
                    <Typography sx={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                      Submitted: {formatDate(result.submittedAt)}
                    </Typography>
                    {isMulti && (
                      <Chip label={`Attempt ${attemptNum}`} size="small"
                        sx={{ height: 18, fontSize: '0.625rem', fontWeight: 700,
                          backgroundColor: '#FEF3C7', color: '#92400E', ml: 0.5 }} />
                    )}
                  </Box>
                </Box>
              </Box>
            </Grid>

            {/* Right: score + grade + badge */}
            <Grid item xs={12} md={5}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 3 }}>
                {/* Percentage */}
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontWeight: 900, fontSize: { xs: '2.5rem', sm: '3rem' },
                    color: isPass ? '#10B981' : '#EF4444', lineHeight: 1 }}>
                    {pct}%
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#94A3B8', mt: 0.25 }}>
                    Score: {obtainedMarks}/{totalMarks}
                  </Typography>
                </Box>

                <Divider orientation="vertical" flexItem sx={{ borderColor: '#E5E7EB' }} />

                {/* Grade */}
                <Box sx={{ textAlign: 'center' }}>
                  <Box sx={{ width: 52, height: 52, borderRadius: '14px',
                    backgroundColor: grade.bg, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', mx: 'auto', mb: 0.5 }}>
                    <Typography sx={{ fontWeight: 900, fontSize: '1.375rem', color: grade.color }}>
                      {grade.letter}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#94A3B8' }}>{grade.label}</Typography>
                </Box>

                <Divider orientation="vertical" flexItem sx={{ borderColor: '#E5E7EB' }} />

                {/* Pass/Fail */}
                <Chip
                  icon={isPass
                    ? <CheckCircle sx={{ fontSize: '16px !important', color: 'inherit !important' }} />
                    : <Cancel sx={{ fontSize: '16px !important', color: 'inherit !important' }} />
                  }
                  label={isPass ? 'PASSED' : 'FAILED'}
                  sx={{
                    fontWeight: 800, fontSize: '0.875rem', px: 1, py: 2.5, height: 'auto',
                    backgroundColor: isPass ? '#DCFCE7' : '#FEE2E2',
                    color: isPass ? '#15803D' : '#DC2626',
                    '& .MuiChip-icon': { color: 'inherit' },
                  }}
                />
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* ════════════════════════════════════════════════════════════════════
          KPI CARDS
      ════════════════════════════════════════════════════════════════════ */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <KPICard
            icon={<TrendingUp fontSize="small" />}
            value={`${obtainedMarks} / ${totalMarks}`}
            label="Score (Marks)"
            desc={pct >= 50 ? 'Above passing threshold' : 'Below passing threshold'}
            color="#3B82F6" bg="#EFF6FF"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KPICard
            icon={<CheckCircle fontSize="small" />}
            value={displayCorrect}
            label="Correct Answers"
            desc={totalQuestions > 0 && correctAnswers !== null
              ? `${correctAnswers} of ${totalQuestions} question${totalQuestions !== 1 ? 's' : ''}`
              : 'Question data unavailable'}
            color="#10B981" bg="#ECFDF5"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KPICard
            icon={<Cancel fontSize="small" />}
            value={displayWrong}
            label="Incorrect Answers"
            desc={wrongAnswers === null ? 'Question data unavailable'
              : wrongAnswers === 0 ? 'None wrong!' : `${wrongAnswers} question${wrongAnswers !== 1 ? 's' : ''} wrong`}
            color="#EF4444" bg="#FEF2F2"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KPICard
            icon={<QuizOutlined fontSize="small" />}
            value={displayTotal}
            label="Total Questions"
            desc={unanswered > 0 ? `${unanswered} unanswered` : totalQuestions > 0 ? 'All attempted' : 'Data unavailable'}
            color="#7C3AED" bg="#F5F3FF"
          />
        </Grid>
      </Grid>

      {/* ════════════════════════════════════════════════════════════════════
          MIDDLE ROW: Score Breakdown | Performance Insights
      ════════════════════════════════════════════════════════════════════ */}
      <Grid container spacing={3} sx={{ mb: 3 }}>

        {/* Score Breakdown — progress bars using correct separations */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, borderRadius: '16px', height: '100%' }}>
            <Typography sx={{ fontWeight: 700, color: '#0F172A', fontSize: '0.9375rem', mb: 2.5 }}>
              Score Breakdown
            </Typography>

            {/* Correct Questions */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                <Typography sx={{ fontSize: '0.8125rem', color: '#10B981', fontWeight: 600 }}>
                  ✓ Correct Questions
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#10B981' }}>
                  {correctAnswers !== null ? `${correctAnswers} / ${totalQuestions || '?'}` : '—'}
                </Typography>
              </Box>
              <LinearProgress variant="determinate"
                value={totalQuestions > 0 && correctAnswers !== null
                  ? (correctAnswers / totalQuestions) * 100 : 0}
                sx={{ height: 10, borderRadius: 5,
                  '& .MuiLinearProgress-bar': { backgroundColor: '#10B981', borderRadius: 5 } }} />
              <Typography sx={{ fontSize: '0.6875rem', color: '#94A3B8', mt: 0.5 }}>
                {correctAnswers !== null
                  ? `${correctAnswers} question${correctAnswers !== 1 ? 's' : ''} answered correctly`
                  : 'Question count data unavailable for this result'}
              </Typography>
            </Box>

            {/* Incorrect Questions */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                <Typography sx={{ fontSize: '0.8125rem', color: '#EF4444', fontWeight: 600 }}>
                  ✗ Incorrect Questions
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#EF4444' }}>
                  {wrongAnswers !== null ? `${wrongAnswers} / ${totalQuestions || '?'}` : '—'}
                </Typography>
              </Box>
              <LinearProgress variant="determinate"
                value={totalQuestions > 0 && wrongAnswers !== null
                  ? (wrongAnswers / totalQuestions) * 100 : 0}
                sx={{ height: 10, borderRadius: 5,
                  '& .MuiLinearProgress-bar': { backgroundColor: '#EF4444', borderRadius: 5 } }} />
              <Typography sx={{ fontSize: '0.6875rem', color: '#94A3B8', mt: 0.5 }}>
                {wrongAnswers !== null
                  ? `${wrongAnswers} question${wrongAnswers !== 1 ? 's' : ''} answered incorrectly`
                  : 'Question count data unavailable for this result'}
              </Typography>
            </Box>

            {/* Unanswered — only show if any exist */}
            {unanswered > 0 && (
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#94A3B8', fontWeight: 600 }}>
                    — Unanswered
                  </Typography>
                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#94A3B8' }}>
                    {unanswered} / {totalQuestions || '?'}
                  </Typography>
                </Box>
                <LinearProgress variant="determinate"
                  value={totalQuestions > 0 ? (unanswered / totalQuestions) * 100 : 0}
                  sx={{ height: 6, borderRadius: 5,
                    '& .MuiLinearProgress-bar': { backgroundColor: '#CBD5E1', borderRadius: 5 } }} />
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Marks summary — clearly labelled as marks, not question counts */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                <Typography sx={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>
                  Marks obtained
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: isPass ? '#10B981' : '#EF4444' }}>
                  {obtainedMarks} / {totalMarks}
                </Typography>
              </Box>
              <LinearProgress variant="determinate"
                value={totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0}
                sx={{ height: 8, borderRadius: 5,
                  '& .MuiLinearProgress-bar': { backgroundColor: isPass ? '#10B981' : '#EF4444', borderRadius: 5 } }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5, mb: 0.75 }}>
                <Typography sx={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>
                  Passing marks (50%)
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#64748B' }}>
                  {passingMark} / {totalMarks}
                </Typography>
              </Box>
              <LinearProgress variant="determinate"
                value={50}
                sx={{ height: 6, borderRadius: 5,
                  '& .MuiLinearProgress-bar': { backgroundColor: '#94A3B8', borderRadius: 5 } }} />
            </Box>
          </Paper>
        </Grid>

        {/* Performance Insights */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, borderRadius: '16px', height: '100%' }}>
            <Typography sx={{ fontWeight: 700, color: '#0F172A', fontSize: '0.9375rem', mb: 2.5 }}>
              Performance Insights
            </Typography>
            {insights.map((ins, i) => (
              <InsightRow key={i} text={ins.text} type={ins.type} />
            ))}
          </Paper>
        </Grid>
      </Grid>

      {/* ════════════════════════════════════════════════════════════════════
          BOTTOM ROW: Performance Comparison | Performance Summary
      ════════════════════════════════════════════════════════════════════ */}
      <Grid container spacing={3} sx={{ mb: 3 }}>

        {/* Performance Comparison */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: '16px', height: '100%' }}>
            <Typography sx={{ fontWeight: 700, color: '#0F172A', fontSize: '0.9375rem', mb: 2.5 }}>
              Performance Comparison
            </Typography>
            <ProgressRow label="Your Score"    value={pct}  color={isPass ? '#10B981' : '#EF4444'} highlight />
            <ProgressRow label="Passing Marks" value={50}   color="#94A3B8" />
            {/* Class average / highest score shown only if available from result doc */}
            {result.classAverage != null && (
              <ProgressRow label="Class Average" value={result.classAverage} color="#6366F1" />
            )}
            {result.highestScore != null && (
              <ProgressRow label="Highest Score" value={result.highestScore} color="#F59E0B" />
            )}
            {result.classAverage == null && result.highestScore == null && (
              <Box sx={{ mt: 2, p: 2, borderRadius: '10px', backgroundColor: '#F8FAFC',
                border: '1px solid #E5E7EB', textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.8125rem', color: '#94A3B8' }}>
                  Class-level data is not available for this exam.
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Performance Summary */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: '16px', height: '100%' }}>
            <Typography sx={{ fontWeight: 700, color: '#0F172A', fontSize: '0.9375rem', mb: 2 }}>
              Exam Summary
            </Typography>
            <StatRow icon={<Person sx={{ fontSize: 16 }} />}       label="Student"           value={result.studentName} />
            <StatRow icon={<QuizOutlined sx={{ fontSize: 16 }} />}  label="Exam"              value={result.examTitle} />
            <StatRow icon={<Subject sx={{ fontSize: 16 }} />}       label="Subject"           value={result.subject} />
            {/* MARKS — clearly labelled */}
            <StatRow icon={<TrendingUp sx={{ fontSize: 16 }} />}    label="Marks Obtained"    value={`${obtainedMarks} / ${totalMarks}`} />
            <StatRow icon={<AccessTime sx={{ fontSize: 16 }} />}    label="Passing Marks"     value={`${passingMark} / ${totalMarks}`} />
            <StatRow icon={<TrendingUp sx={{ fontSize: 16 }} />}    label="Score %"           value={`${pct}%`} valueColor={isPass ? '#10B981' : '#EF4444'} />
            {/* QUESTION COUNTS — clearly labelled, never mixed with marks */}
            {totalQuestions > 0 && (
              <StatRow icon={<QuizOutlined sx={{ fontSize: 16 }} />}  label="Total Questions"   value={totalQuestions} />
            )}
            {correctAnswers !== null && (
              <StatRow icon={<CheckCircle sx={{ fontSize: 16 }} />}   label="Correct Answers"   value={correctAnswers} valueColor="#10B981" />
            )}
            {wrongAnswers !== null && (
              <StatRow icon={<Cancel sx={{ fontSize: 16 }} />}        label="Wrong Answers"     value={wrongAnswers}   valueColor="#EF4444" />
            )}
            {unanswered > 0 && (
              <StatRow icon={<QuizOutlined sx={{ fontSize: 16 }} />} label="Unanswered"        value={unanswered}    valueColor="#94A3B8" />
            )}
            <StatRow icon={<CalendarToday sx={{ fontSize: 16 }} />} label="Submitted"         value={formatDate(result.submittedAt)} />
            {isMulti && (
              <StatRow icon={<RepeatOutlined sx={{ fontSize: 16 }} />} label="Attempt"        value={`#${attemptNum}`} />
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* ════════════════════════════════════════════════════════════════════
          ACTION PANEL
      ════════════════════════════════════════════════════════════════════ */}
      <Paper sx={{ p: 3, borderRadius: '16px', border: '1px solid #E5E7EB' }}>
        <Typography sx={{ fontWeight: 700, color: '#0F172A', fontSize: '0.9375rem', mb: 2.5 }}>
          Actions
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {/* Primary: download */}
          <Button
            variant="contained"
            startIcon={<Download />}
            onClick={handleDownload}
            sx={{
              fontWeight: 600, px: 3,
              background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
              '&:hover': { background: 'linear-gradient(135deg, #4338CA, #6D28D9)',
                transform: 'translateY(-1px)', boxShadow: '0 6px 18px rgba(79,70,229,0.3)' },
            }}
          >
            Download Report
          </Button>

          {/* Secondary: back to results list */}
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => navigate(nav.resultsList)}
            sx={{ fontWeight: 600, px: 3 }}
          >
            {nav.resultsListLabel}
          </Button>

          {/* Dashboard */}
          <Button
            variant="outlined"
            startIcon={<HomeOutlined />}
            onClick={() => navigate(nav.dashboard)}
            sx={{ fontWeight: 600, px: 3 }}
          >
            {nav.dashboardLabel}
          </Button>

          {/* Retake — shown only for students on multiple-attempt exams */}
          {role === ROLES.STUDENT && isMulti && !isPass && (
            <Tooltip title="Return to exams to retake this assessment">
              <Button
                variant="outlined"
                startIcon={<RepeatOutlined />}
                onClick={() => navigate('/student/exams')}
                sx={{ fontWeight: 600, px: 3, borderColor: '#10B981', color: '#10B981',
                  '&:hover': { backgroundColor: '#ECFDF5', borderColor: '#059669' } }}
              >
                Retake Exam
              </Button>
            </Tooltip>
          )}
        </Box>
      </Paper>

    </Box>
  );
};

export default ResultPage;
