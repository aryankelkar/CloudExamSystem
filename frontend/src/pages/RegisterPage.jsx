import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, Alert, FormControl, Select,
  MenuItem, InputAdornment, IconButton, Divider,
} from '@mui/material';
import {
  CloudOutlined, Email, Lock, Person, Visibility, VisibilityOff,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { registerUser } from '../services/authService';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const validate = () => {
    if (!formData.fullName.trim())
      return 'Full name is required';
    if (!formData.email || !formData.password || !formData.confirmPassword)
      return 'All fields are required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      return 'Enter a valid email address';
    if (formData.password.length < 6)
      return 'Password must be at least 6 characters';
    if (formData.password !== formData.confirmPassword)
      return 'Passwords do not match';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setError('');
    setLoading(true);

    try {
      await registerUser({
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
      });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fieldLabel = (label) => (
    <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 0.75, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {label}
    </Typography>
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        backgroundColor: '#F8FAFC',
      }}
    >
      {/* Left branding panel */}
      <Box
        sx={{
          display: { xs: 'none', lg: 'flex' },
          flex: '0 0 460px',
          background: 'linear-gradient(160deg, #4F46E5 0%, #7C3AED 100%)',
          flexDirection: 'column',
          justifyContent: 'center',
          p: 8,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -100,
            right: -80,
            width: 380,
            height: 380,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
          },
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 8, cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            <Box
              sx={{
                width: 40, height: 40, borderRadius: '12px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <CloudOutlined sx={{ color: '#fff', fontSize: 22 }} />
            </Box>
            <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.125rem' }}>
              CloudExam
            </Typography>
          </Box>

          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '2rem', lineHeight: 1.2, mb: 2 }}>
            Get started today
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '1rem', lineHeight: 1.7, mb: 6 }}>
            Create your account and join thousands of educators and students on CloudExam.
          </Typography>

          <Box
            sx={{
              p: 2.5,
              borderRadius: '14px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <Typography sx={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.875rem', lineHeight: 1.7 }}>
              "CloudExam has transformed how we conduct assessments. Results are instant and the analytics are brilliant."
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2 }}>
              <Box
                sx={{
                  width: 36, height: 36, borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: '0.875rem',
                }}
              >
                P
              </Box>
              <Box>
                <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.8125rem' }}>Dr. Priya Sharma</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>Head of CS Department</Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Form panel */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 3, sm: 4 },
          overflowY: 'auto',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 440, py: 3 }}>
          {/* Mobile logo */}
          <Box
            sx={{
              display: { xs: 'flex', lg: 'none' },
              alignItems: 'center', gap: 1, mb: 5, cursor: 'pointer',
            }}
            onClick={() => navigate('/')}
          >
            <Box
              sx={{
                width: 34, height: 34, borderRadius: '10px',
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <CloudOutlined sx={{ color: '#fff', fontSize: 18 }} />
            </Box>
            <Typography sx={{ fontWeight: 700, color: '#0F172A', fontSize: '1rem' }}>
              CloudExam
            </Typography>
          </Box>

          <Typography variant="h3" sx={{ fontWeight: 700, color: '#0F172A', mb: 1, fontSize: '1.75rem' }}>
            Create an account
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 4 }}>
            Already have an account?{' '}
            <Box
              component="span"
              sx={{ color: '#4F46E5', fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
              onClick={() => navigate('/login')}
            >
              Sign in
            </Box>
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              Account created! Redirecting to login…
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            {fieldLabel('Full Name')}
            <TextField
              fullWidth name="fullName" placeholder="Your full name"
              autoComplete="name" autoFocus
              value={formData.fullName} onChange={handleChange}
              disabled={loading || success} size="small" sx={{ mb: 2.5 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person sx={{ color: '#94A3B8', fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
            />

            {fieldLabel('Email Address')}
            <TextField
              fullWidth name="email" type="email" placeholder="you@example.com"
              autoComplete="email"
              value={formData.email} onChange={handleChange}
              disabled={loading || success} size="small" sx={{ mb: 2.5 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email sx={{ color: '#94A3B8', fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
            />

            {fieldLabel('Role')}
            <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
              <Select
                name="role"
                value={formData.role}
                onChange={handleChange}
                disabled={loading || success}
              >
                <MenuItem value="student">Student</MenuItem>
                <MenuItem value="faculty">Faculty</MenuItem>
              </Select>
            </FormControl>

            {fieldLabel('Password')}
            <TextField
              fullWidth name="password" type={showPassword ? 'text' : 'password'}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              value={formData.password} onChange={handleChange}
              disabled={loading || success} size="small" sx={{ mb: 2.5 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock sx={{ color: '#94A3B8', fontSize: 18 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small" tabIndex={-1}>
                      {showPassword
                        ? <VisibilityOff sx={{ fontSize: 18, color: '#94A3B8' }} />
                        : <Visibility sx={{ fontSize: 18, color: '#94A3B8' }} />
                      }
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {fieldLabel('Confirm Password')}
            <TextField
              fullWidth name="confirmPassword" type={showConfirm ? 'text' : 'password'}
              placeholder="Repeat your password"
              autoComplete="new-password"
              value={formData.confirmPassword} onChange={handleChange}
              disabled={loading || success} size="small" sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock sx={{ color: '#94A3B8', fontSize: 18 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowConfirm(!showConfirm)} edge="end" size="small" tabIndex={-1}>
                      {showConfirm
                        ? <VisibilityOff sx={{ fontSize: 18, color: '#94A3B8' }} />
                        : <Visibility sx={{ fontSize: 18, color: '#94A3B8' }} />
                      }
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit" fullWidth variant="contained"
              disabled={loading || success}
              sx={{
                py: 1.375, fontWeight: 600, fontSize: '0.9375rem',
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #4338CA, #6D28D9)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 20px rgba(79,70,229,0.35)',
                },
              }}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </Button>

            <Divider sx={{ my: 3, color: '#94A3B8', fontSize: '0.75rem' }}>or</Divider>

            <Button
              fullWidth variant="outlined"
              onClick={() => navigate('/login')}
              sx={{ py: 1.375, fontWeight: 600 }}
            >
              Sign in to existing account
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default RegisterPage;
