import React from 'react';
import {
  Box, Container, Typography, Button, Grid, Card, CardContent,
  Chip,
} from '@mui/material';
import {
  Security, Quiz, Storage, TrendingUp,
  CloudOutlined, CheckCircle, ArrowForward, School, People,
  BarChart,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

const FEATURES = [
  {
    icon: <Quiz sx={{ fontSize: 24 }} />,
    title: 'Online Exams',
    description: 'Conduct secure exams with real-time monitoring, auto-grading, and instant results.',
    color: '#4F46E5',
    bg: '#EEF2FF',
  },
  {
    icon: <BarChart sx={{ fontSize: 24 }} />,
    title: 'Analytics Dashboard',
    description: 'Deep insights into student performance, pass rates, and subject trends.',
    color: '#7C3AED',
    bg: '#F5F3FF',
  },
  {
    icon: <CheckCircle sx={{ fontSize: 24 }} />,
    title: 'Automated Results',
    description: 'Server-side evaluation via Cloud Functions — zero client-side exposure.',
    color: '#10B981',
    bg: '#ECFDF5',
  },
  {
    icon: <Storage sx={{ fontSize: 24 }} />,
    title: 'Cloud Monitoring',
    description: 'Real-time GCP cost tracking and budget alerts to keep spending in control.',
    color: '#F59E0B',
    bg: '#FFFBEB',
  },
  {
    icon: <Security sx={{ fontSize: 24 }} />,
    title: 'Secure Authentication',
    description: 'Firebase Auth with custom claims and Firestore role enforcement.',
    color: '#3B82F6',
    bg: '#EFF6FF',
  },
  {
    icon: <TrendingUp sx={{ fontSize: 24 }} />,
    title: 'Performance Reports',
    description: 'Downloadable reports, subject breakdowns, and top-student leaderboards.',
    color: '#EF4444',
    bg: '#FEF2F2',
  },
];

const STATS = [
  { value: '10k+', label: 'Exams Conducted' },
  { value: '50k+', label: 'Students Served' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '<1s',  label: 'Result Evaluation' },
];

const TESTIMONIALS = [
  {
    name: 'Dr. Priya Sharma',
    role: 'Head of CS Department',
    text: 'CloudExam has transformed how we conduct semester assessments. The analytics give us actionable data we never had before.',
    initial: 'P',
  },
  {
    name: 'Rahul Desai',
    role: 'Student, B.Tech CSE',
    text: 'The exam interface is clean and distraction-free. I got my results instantly — no waiting, no anxiety.',
    initial: 'R',
  },
  {
    name: 'Prof. Anita Kulkarni',
    role: 'Faculty, Data Science',
    text: 'Creating and managing exams takes minutes now. The question palette and timer work flawlessly.',
    initial: 'A',
  },
];

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
      {/* Navbar (unauthenticated state) */}
      <Navbar toggleSidebar={() => {}} />

      {/* Hero Section */}
      <Box
        sx={{
          pt: { xs: 14, md: 18 },
          pb: { xs: 10, md: 14 },
          px: 2,
          background: 'linear-gradient(160deg, #ffffff 0%, #EEF2FF 60%, #F5F3FF 100%)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -120,
            right: -120,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(79,70,229,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: -60,
            left: -60,
            width: 350,
            height: 350,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)',
            pointerEvents: 'none',
          },
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ maxWidth: 720, mx: 'auto', textAlign: 'center' }}>
            <Chip
              icon={<CloudOutlined sx={{ fontSize: '16px !important' }} />}
              label="Built on Google Cloud Platform"
              size="small"
              sx={{
                mb: 3,
                backgroundColor: '#EEF2FF',
                color: '#4F46E5',
                fontWeight: 600,
                fontSize: '0.75rem',
                border: '1px solid #C7D2FE',
                '& .MuiChip-icon': { color: '#4F46E5' },
              }}
            />

            <Typography
              variant="h1"
              sx={{
                fontWeight: 800,
                fontSize: { xs: '2.25rem', md: '3rem', lg: '3.5rem' },
                lineHeight: 1.15,
                color: '#0F172A',
                mb: 2.5,
              }}
            >
              Cloud-Based Online{' '}
              <Box
                component="span"
                sx={{
                  background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Examination Platform
              </Box>
            </Typography>

            <Typography
              variant="body1"
              sx={{
                fontSize: { xs: '1rem', md: '1.125rem' },
                color: '#64748B',
                mb: 4,
                maxWidth: 560,
                mx: 'auto',
                lineHeight: 1.7,
              }}
            >
              Secure online examinations, real-time analytics, faculty management,
              and cloud monitoring — all in one modern platform.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForward />}
                onClick={() => navigate('/register')}
                sx={{
                  px: 3.5,
                  py: 1.5,
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #4338CA, #6D28D9)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 24px rgba(79,70,229,0.35)',
                  },
                }}
              >
                Get Started Free
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<School />}
                onClick={() => navigate('/login')}
                sx={{ px: 3.5, py: 1.5, fontSize: '0.9375rem', fontWeight: 600 }}
              >
                Faculty Login
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<People />}
                onClick={() => navigate('/login')}
                sx={{ px: 3.5, py: 1.5, fontSize: '0.9375rem', fontWeight: 600 }}
              >
                Student Login
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Stats Bar */}
      <Box sx={{ backgroundColor: '#ffffff', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}>
        <Container maxWidth="lg">
          <Grid container>
            {STATS.map((stat, i) => (
              <Grid item xs={6} md={3} key={stat.label}>
                <Box
                  sx={{
                    py: { xs: 3, md: 4 },
                    px: 3,
                    textAlign: 'center',
                    borderRight: i < 3 ? '1px solid #E5E7EB' : 'none',
                  }}
                >
                  <Typography
                    sx={{
                      fontWeight: 800,
                      fontSize: { xs: '1.75rem', md: '2rem' },
                      color: '#4F46E5',
                      lineHeight: 1,
                      mb: 0.5,
                    }}
                  >
                    {stat.value}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748B', fontWeight: 500 }}>
                    {stat.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: '#F8FAFC' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography
              variant="h2"
              sx={{ fontWeight: 700, color: '#0F172A', mb: 2, fontSize: { xs: '1.75rem', md: '2.25rem' } }}
            >
              Everything you need to run exams at scale
            </Typography>
            <Typography variant="body1" sx={{ color: '#64748B', maxWidth: 500, mx: 'auto' }}>
              A complete cloud-native platform designed for educational institutions of any size.
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {FEATURES.map((feature) => (
              <Grid item xs={12} sm={6} md={4} key={feature.title}>
                <Card
                  sx={{
                    height: '100%',
                    border: '1px solid #E5E7EB',
                    boxShadow: 'none',
                    '&:hover': {
                      boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                      transform: 'translateY(-4px)',
                    },
                    transition: 'all 0.2s ease',
                    cursor: 'default',
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '12px',
                        backgroundColor: feature.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2,
                        color: feature.color,
                      }}
                    >
                      {feature.icon}
                    </Box>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 600, color: '#0F172A', mb: 1, fontSize: '1rem' }}
                    >
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748B', lineHeight: 1.6 }}>
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Testimonials */}
      <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: '#ffffff' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography
              variant="h2"
              sx={{ fontWeight: 700, color: '#0F172A', mb: 2, fontSize: { xs: '1.75rem', md: '2.25rem' } }}
            >
              Trusted by educators and students
            </Typography>
            <Typography variant="body1" sx={{ color: '#64748B' }}>
              See what people are saying about CloudExam.
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {TESTIMONIALS.map((t) => (
              <Grid item xs={12} md={4} key={t.name}>
                <Box
                  sx={{
                    p: 3,
                    border: '1px solid #E5E7EB',
                    borderRadius: '16px',
                    backgroundColor: '#F8FAFC',
                    height: '100%',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ color: '#334155', lineHeight: 1.7, mb: 3, fontStyle: 'italic' }}
                  >
                    "{t.text}"
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        flexShrink: 0,
                      }}
                    >
                      {t.initial}
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={600} color="text.primary">
                        {t.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t.role}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box
        sx={{
          py: { xs: 10, md: 14 },
          background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
          textAlign: 'center',
        }}
      >
        <Container maxWidth="sm">
          <Typography
            variant="h2"
            sx={{
              fontWeight: 700,
              color: '#ffffff',
              mb: 2,
              fontSize: { xs: '1.75rem', md: '2.25rem' },
            }}
          >
            Ready to modernize your exams?
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: 'rgba(255,255,255,0.8)', mb: 4, fontSize: '1.0625rem' }}
          >
            Join thousands of institutions using CloudExam System today.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/register')}
              sx={{
                px: 4,
                py: 1.5,
                backgroundColor: '#ffffff',
                color: '#4F46E5',
                fontWeight: 700,
                '&:hover': {
                  backgroundColor: '#F1F5F9',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              Create Free Account
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/login')}
              sx={{
                px: 4,
                py: 1.5,
                borderColor: 'rgba(255,255,255,0.5)',
                color: '#ffffff',
                fontWeight: 600,
                '&:hover': {
                  borderColor: '#ffffff',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                },
              }}
            >
              Sign In
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          py: 4,
          backgroundColor: '#0F172A',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CloudOutlined sx={{ color: '#fff', fontSize: 16 }} />
              </Box>
              <Typography variant="body2" sx={{ color: '#9CA3AF', fontWeight: 600 }}>
                CloudExam System
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: '#6B7280' }}>
              © {new Date().getFullYear()} CloudExam System. All rights reserved.
            </Typography>
            <Box sx={{ display: 'flex', gap: 3 }}>
              {['Privacy Policy', 'Terms of Service', 'Contact Us'].map((link) => (
                <Typography
                  key={link}
                  component="a"
                  href="#"
                  variant="caption"
                  sx={{
                    color: '#6B7280',
                    textDecoration: 'none',
                    '&:hover': { color: '#9CA3AF' },
                  }}
                >
                  {link}
                </Typography>
              ))}
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default LandingPage;
