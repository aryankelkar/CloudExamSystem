import React from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent,
  LinearProgress, Alert, Chip,
} from '@mui/material';
import {
  Warning, CheckCircle, CloudOutlined,
  Storage, Functions, Language, Cloud,
} from '@mui/icons-material';

// ─── Simulated GCP Billing Dashboard ─────────────────────────────────────────
// Static values for demonstration. In production, connect to GCP Billing API
// via a Cloud Function that reads from a Billing export BigQuery dataset.

const BUDGET = 500;
const CURRENT_USAGE = 120;

const COST_BREAKDOWN = [
  { label: 'Firestore Database', amount: 45,  icon: <Storage />,   color: '#4F46E5', bg: '#EEF2FF' },
  { label: 'Cloud Storage',      amount: 30,  icon: <Cloud />,     color: '#3B82F6', bg: '#EFF6FF' },
  { label: 'Cloud Functions',    amount: 25,  icon: <Functions />, color: '#7C3AED', bg: '#F5F3FF' },
  { label: 'Firebase Hosting',   amount: 20,  icon: <Language />,  color: '#10B981', bg: '#ECFDF5' },
];

const ALERT_THRESHOLDS = [
  { percentage: 50,  severity: 'success', label: 'Normal',   message: '50% of budget reached' },
  { percentage: 75,  severity: 'warning', label: 'Moderate', message: '75% of budget reached' },
  { percentage: 90,  severity: 'error',   label: 'High',     message: '90% of budget reached' },
  { percentage: 100, severity: 'error',   label: 'Exceeded', message: 'Budget limit exceeded' },
];

const BillingPage = () => {
  const remaining = BUDGET - CURRENT_USAGE;
  const usagePercentage = (CURRENT_USAGE / BUDGET) * 100;

  const alertLevel = (() => {
    if (usagePercentage >= 100) return { color: 'error',   message: 'Budget exceeded!' };
    if (usagePercentage >= 90)  return { color: 'error',   message: 'Critical: 90% budget used' };
    if (usagePercentage >= 75)  return { color: 'warning', message: 'Warning: 75% budget used' };
    if (usagePercentage >= 50)  return { color: 'info',    message: 'Moderate: 50% budget used' };
    return                              { color: 'success', message: 'Normal usage' };
  })();

  const progressColor = {
    error: '#EF4444', warning: '#F59E0B', info: '#3B82F6', success: '#10B981',
  }[alertLevel.color];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <Box
            sx={{
              width: 38, height: 38, borderRadius: '11px',
              background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <CloudOutlined sx={{ color: '#fff', fontSize: 20 }} />
          </Box>
          <Typography variant="h3" sx={{ fontWeight: 700, color: '#0F172A' }}>
            Cloud Cost Monitoring
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: '#64748B', ml: 0.5 }}>
          Simulated GCP Billing Dashboard
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 4 }}>
        This is a simulated billing dashboard for demonstration purposes. Values are static.
        In production, data would be sourced from the GCP Cloud Billing API via a Cloud Function.
      </Alert>

      {/* Budget Overview */}
      <Paper sx={{ p: 4, mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F172A', mb: 3 }}>
          Budget Overview
        </Typography>

        {/* KPI cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {[
            { label: 'Total Budget',   value: `₹${BUDGET}`,         color: '#4F46E5', bg: '#EEF2FF' },
            { label: 'Current Usage',  value: `₹${CURRENT_USAGE}`,  color: '#F59E0B', bg: '#FFFBEB' },
            { label: 'Remaining',      value: `₹${remaining}`,      color: '#10B981', bg: '#ECFDF5' },
          ].map(({ label, value, color, bg }) => (
            <Grid item xs={12} sm={4} key={label}>
              <Card sx={{ border: 'none', boxShadow: 'none', backgroundColor: bg }}>
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                  <Typography variant="body2" sx={{ color: '#64748B', fontWeight: 500, mb: 0.5 }}>
                    {label}
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color }}>
                    {value}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Progress bar */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A' }}>
              Usage Progress
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: progressColor }}>
              {usagePercentage.toFixed(1)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={usagePercentage}
            sx={{
              height: 10,
              '& .MuiLinearProgress-bar': { backgroundColor: progressColor },
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.75 }}>
            <Typography variant="caption" sx={{ color: '#94A3B8' }}>₹0</Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8' }}>₹{BUDGET}</Typography>
          </Box>
        </Box>

        <Alert
          severity={alertLevel.color}
          icon={alertLevel.color === 'success' ? <CheckCircle /> : <Warning />}
        >
          {alertLevel.message}
        </Alert>
      </Paper>

      {/* Alert Thresholds */}
      <Paper sx={{ p: 4, mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F172A', mb: 1 }}>
          Alert Thresholds
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
          Budget alert levels configured for this GCP project.
        </Typography>

        <Grid container spacing={2}>
          {ALERT_THRESHOLDS.map((t) => {
            const isTriggered = usagePercentage >= t.percentage;
            const chipColors = {
              success: { bg: '#DCFCE7', color: '#15803D' },
              warning: { bg: '#FEF3C7', color: '#92400E' },
              error:   { bg: '#FEE2E2', color: '#991B1B' },
            }[t.severity];

            return (
              <Grid item xs={12} sm={6} md={3} key={t.percentage}>
                <Card
                  sx={{
                    border: `2px solid ${isTriggered ? (t.severity === 'success' ? '#10B981' : t.severity === 'warning' ? '#F59E0B' : '#EF4444') : '#E5E7EB'}`,
                    boxShadow: isTriggered ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: isTriggered ? chipColors.color : '#64748B' }}>
                        {t.percentage}%
                      </Typography>
                      {isTriggered && (
                        <Chip
                          label="Active"
                          size="small"
                          sx={{ height: 20, fontSize: '0.625rem', fontWeight: 700, backgroundColor: chipColors.bg, color: chipColors.color }}
                        />
                      )}
                    </Box>
                    <Chip
                      label={t.label}
                      size="small"
                      sx={{ height: 22, fontSize: '0.6875rem', fontWeight: 600, backgroundColor: chipColors.bg, color: chipColors.color, mb: 1 }}
                    />
                    <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block' }}>
                      {t.message}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Paper>

      {/* Cost Breakdown */}
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F172A', mb: 1 }}>
          Cost Breakdown
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
          Simulated per-service costs this billing cycle.
        </Typography>

        <Grid container spacing={2}>
          {COST_BREAKDOWN.map(({ label, amount, icon, color, bg }) => (
            <Grid item xs={12} sm={6} md={3} key={label}>
              <Card sx={{ border: '1px solid #E5E7EB', boxShadow: 'none' }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box
                    sx={{
                      width: 40, height: 40, borderRadius: '11px',
                      backgroundColor: bg, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', color, mb: 2,
                    }}
                  >
                    {React.cloneElement(icon, { fontSize: 'small' })}
                  </Box>
                  <Typography variant="body2" sx={{ color: '#64748B', mb: 0.5 }}>
                    {label}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color }}>
                    ₹{amount}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                    {((amount / CURRENT_USAGE) * 100).toFixed(0)}% of total spend
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Box>
  );
};

export default BillingPage;
