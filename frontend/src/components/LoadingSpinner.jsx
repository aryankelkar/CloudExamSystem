import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { CloudOutlined } from '@mui/icons-material';

const LoadingSpinner = ({ message = 'Loading...' }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: 2,
    }}
  >
    <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress
        size={48}
        thickness={3}
        sx={{ color: '#4F46E5' }}
      />
      <CloudOutlined
        sx={{
          position: 'absolute',
          fontSize: 22,
          color: '#4F46E5',
          opacity: 0.7,
          animation: 'pulse 2s ease-in-out infinite',
          '@keyframes pulse': {
            '0%, 100%': { opacity: 0.7 },
            '50%': { opacity: 0.3 },
          },
        }}
      />
    </Box>
    <Typography variant="body2" sx={{ color: '#64748B', fontWeight: 500 }}>
      {message}
    </Typography>
  </Box>
);

export default LoadingSpinner;
