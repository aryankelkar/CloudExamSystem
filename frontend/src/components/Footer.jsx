import React from 'react';
import { Box, Typography, Container, Link } from '@mui/material';
import { CloudOutlined } from '@mui/icons-material';

const Footer = () => (
  <Box
    component="footer"
    sx={{
      py: 3,
      px: 2,
      mt: 'auto',
      borderTop: '1px solid #E5E7EB',
      backgroundColor: '#ffffff',
    }}
  >
    <Container maxWidth="lg">
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 26, height: 26, borderRadius: '8px',
              background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <CloudOutlined sx={{ color: '#fff', fontSize: 14 }} />
          </Box>
          <Typography variant="body2" sx={{ color: '#64748B', fontWeight: 600 }}>
            CloudExam System
          </Typography>
        </Box>

        <Typography variant="caption" sx={{ color: '#94A3B8' }}>
          © {new Date().getFullYear()} CloudExam System. All rights reserved.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2.5 }}>
          {['Privacy Policy', 'Terms of Service', 'Contact Us'].map((text) => (
            <Link
              key={text}
              href="#"
              underline="hover"
              sx={{ color: '#94A3B8', fontSize: '0.75rem', '&:hover': { color: '#4F46E5' } }}
            >
              {text}
            </Link>
          ))}
        </Box>
      </Box>
    </Container>
  </Box>
);

export default Footer;
