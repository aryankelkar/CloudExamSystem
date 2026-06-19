import React, { useState } from 'react';
import { Box } from '@mui/material';
import Navbar from '../components/Navbar';
import Sidebar, { drawerWidth } from '../components/Sidebar';

const StudentLayout = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
      {/* Sidebar — renders fixed drawer + invisible spacer internally */}
      <Sidebar
        mobileOpen={mobileOpen}
        handleDrawerToggle={() => setMobileOpen(!mobileOpen)}
        role="student"
        sidebarWidth={drawerWidth}
      />

      {/* Main column — fills all space left by the spacer */}
      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        <Navbar
          toggleSidebar={() => setMobileOpen(!mobileOpen)}
          sidebarWidth={drawerWidth}
        />

        {/* Content area — push down by navbar height */}
        <Box
          sx={{
            flex: 1,
            mt: '64px',
            p: { xs: 2, sm: '24px' },
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default StudentLayout;
