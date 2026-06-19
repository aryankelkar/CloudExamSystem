import React from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { Home, ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
      }}
    >
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center' }}>
          {/* 404 number */}
          <Typography
            sx={{
              fontSize: { xs: '7rem', sm: '10rem' },
              fontWeight: 900,
              lineHeight: 1,
              background: 'linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 2,
              userSelect: 'none',
            }}
          >
            404
          </Typography>

          <Typography
            variant="h4"
            sx={{ fontWeight: 700, color: '#0F172A', mb: 1.5, fontSize: { xs: '1.5rem', sm: '1.875rem' } }}
          >
            Page not found
          </Typography>

          <Typography
            variant="body1"
            sx={{ color: '#64748B', mb: 5, maxWidth: 380, mx: 'auto', lineHeight: 1.7 }}
          >
            Sorry, we couldn't find the page you were looking for.
            It might have been moved or deleted.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<Home />}
              onClick={() => navigate('/')}
              sx={{
                fontWeight: 600,
                px: 3,
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                '&:hover': { background: 'linear-gradient(135deg, #4338CA, #6D28D9)' },
              }}
            >
              Go to Home
            </Button>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => navigate(-1)}
              sx={{ fontWeight: 600, px: 3 }}
            >
              Go Back
            </Button>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default NotFoundPage;
