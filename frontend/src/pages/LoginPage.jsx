import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, Alert, InputAdornment,
  IconButton, Divider,
} from '@mui/material';
import {
  CloudOutlined, Email, Lock, Visibility, VisibilityOff,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../services/authService';
import { ROLES } from '../utils/constants';

const LoginPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [orphanedAccount, setOrphanedAccount] = useState(false);

  const handleChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setOrphanedAccount(false);
    setLoading(true);

    try {
      const { profile } = await loginUser(formData.email, formData.password);
      if (profile.role === ROLES.FACULTY) {
        navigate('/faculty');
      } else {
        navigate('/student');
      }
    } catch (err) {
      if (err.code === 'auth/orphaned-account') {
        setOrphanedAccount(true);
        setError(err.message);
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        backgroundColor: '#F8FAFC',
      }}
    >
      {/* Left panel — branding (desktop only) */}
      <Box
        sx={{
          display: { xs: 'none', lg: 'flex' },
          flex: '0 0 480px',
          background: 'linear-gradient(160deg, #4F46E5 0%, #7C3AED 100%)',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          p: 8,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -100,
            right: -100,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: -60,
            left: -60,
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
          },
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              mb: 8,
              cursor: 'pointer',
            }}
            onClick={() => navigate('/')}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '12px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CloudOutlined sx={{ color: '#fff', fontSize: 22 }} />
            </Box>
            <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.125rem' }}>
              CloudExam
            </Typography>
          </Box>

          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '2rem', lineHeight: 1.2, mb: 2 }}>
            Welcome back
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '1rem', lineHeight: 1.7, mb: 6 }}>
            Sign in to access your dashboard, manage exams, and view analytics.
          </Typography>

          {['Secure Firebase Auth', 'Role-based access control', 'Real-time cloud sync'].map((item) => (
            <Box key={item} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#fff' }} />
              </Box>
              <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem' }}>
                {item}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Right panel — form */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 3, sm: 4 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 420 }}>
          {/* Mobile logo */}
          <Box
            sx={{
              display: { xs: 'flex', lg: 'none' },
              alignItems: 'center',
              gap: 1,
              mb: 5,
              cursor: 'pointer',
            }}
            onClick={() => navigate('/')}
          >
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CloudOutlined sx={{ color: '#fff', fontSize: 18 }} />
            </Box>
            <Typography sx={{ fontWeight: 700, color: '#0F172A', fontSize: '1rem' }}>
              CloudExam
            </Typography>
          </Box>

          <Typography
            variant="h3"
            sx={{ fontWeight: 700, color: '#0F172A', mb: 1, fontSize: '1.75rem' }}
          >
            Sign in
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 4 }}>
            Don't have an account?{' '}
            <Box
              component="span"
              sx={{
                color: '#4F46E5',
                fontWeight: 600,
                cursor: 'pointer',
                '&:hover': { textDecoration: 'underline' },
              }}
              onClick={() => navigate('/register')}
            >
              Create one
            </Box>
          </Typography>

          {error && !orphanedAccount && (
            <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
          )}
          {orphanedAccount && (
            <Alert
              severity="warning"
              sx={{ mb: 3 }}
              action={
                <Button color="inherit" size="small" onClick={() => navigate('/register')}>
                  Re-register
                </Button>
              }
            >
              Your account setup was incomplete. Re-register with the same email and
              password to restore full access.
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
              EMAIL ADDRESS
            </Typography>
            <TextField
              fullWidth
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
              size="small"
              sx={{ mb: 2.5 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email sx={{ color: '#94A3B8', fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
            />

            <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
              PASSWORD
            </Typography>
            <TextField
              fullWidth
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              size="small"
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock sx={{ color: '#94A3B8', fontSize: 18 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      size="small"
                      tabIndex={-1}
                    >
                      {showPassword
                        ? <VisibilityOff sx={{ fontSize: 18, color: '#94A3B8' }} />
                        : <Visibility sx={{ fontSize: 18, color: '#94A3B8' }} />
                      }
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{
                py: 1.375,
                fontWeight: 600,
                fontSize: '0.9375rem',
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #4338CA, #6D28D9)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 20px rgba(79,70,229,0.35)',
                },
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>

            <Divider sx={{ my: 3, color: '#94A3B8', fontSize: '0.75rem' }}>or</Divider>

            <Button
              fullWidth
              variant="outlined"
              onClick={() => navigate('/register')}
              sx={{ py: 1.375, fontWeight: 600 }}
            >
              Create a new account
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default LoginPage;
