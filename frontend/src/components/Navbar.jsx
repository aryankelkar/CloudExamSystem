import React, { useState } from 'react';
import {
  AppBar, Toolbar, Typography, Button, IconButton,
  Menu, MenuItem, Box, Avatar, Divider, ListItemIcon,
  Breadcrumbs,
} from '@mui/material';
import {
  Menu as MenuIcon, Logout, Person, CloudOutlined,
  NavigateNext,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { logoutUser } from '../services/authService';
import useAuth from '../hooks/useAuth';
import { ROLES } from '../utils/constants';

const DEFAULT_SIDEBAR_W = 280;

/* ── Route → { title, crumbs } map ── */
const ROUTE_META = {
  // Student routes
  '/student':          { title: 'Dashboard',       crumbs: ['Student', 'Dashboard'] },
  '/student/exams':    { title: 'Available Exams',  crumbs: ['Student', 'Exams'] },
  '/student/results':  { title: 'My Results',       crumbs: ['Student', 'Results'] },
  '/student/profile':  { title: 'Profile',          crumbs: ['Student', 'Profile'] },
  // Faculty routes
  '/faculty':               { title: 'Dashboard',    crumbs: ['Faculty', 'Dashboard'] },
  '/faculty/create-exam':   { title: 'Create Exam',  crumbs: ['Faculty', 'Exams', 'Create'] },
  '/faculty/manage-exams':  { title: 'Manage Exams', crumbs: ['Faculty', 'Exams', 'Manage'] },
  '/faculty/results':       { title: 'Results',      crumbs: ['Faculty', 'Results'] },
  '/faculty/analytics':     { title: 'Analytics',    crumbs: ['Faculty', 'Analytics'] },
  '/faculty/profile':       { title: 'Profile',      crumbs: ['Faculty', 'Profile'] },
};

const resolveMeta = (pathname) => {
  if (ROUTE_META[pathname]) return ROUTE_META[pathname];
  if (pathname.startsWith('/exam/'))              return { title: 'Take Exam',   crumbs: ['Student', 'Exams', 'Take Exam'] };
  if (pathname.startsWith('/result/'))            return { title: 'View Result', crumbs: ['Student', 'Results', 'Detail'] };
  if (pathname.startsWith('/faculty/edit-exam/')) return { title: 'Edit Exam',   crumbs: ['Faculty', 'Exams', 'Edit'] };
  if (pathname.startsWith('/faculty/view-exam/')) return { title: 'Preview Exam',crumbs: ['Faculty', 'Exams', 'Preview'] };
  return { title: 'CloudExam', crumbs: ['Home'] };
};

const Navbar = ({ toggleSidebar, sidebarWidth = DEFAULT_SIDEBAR_W }) => {
  const navigate   = useNavigate();
  const location   = useLocation();
  const { currentUser, role, userProfile } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);

  const isAuthenticated = Boolean(currentUser);
  const displayName     = userProfile?.name || currentUser?.displayName || '';
  const email           = currentUser?.email || '';
  const initials        = displayName
    ? displayName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const meta  = resolveMeta(location.pathname);

  const handleMenu    = (e) => setAnchorEl(e.currentTarget);
  const handleClose   = ()  => setAnchorEl(null);
  const handleLogout  = async () => { handleClose(); await logoutUser(); navigate('/login'); };
  const handleProfile = ()  => {
    handleClose();
    navigate(role === ROLES.FACULTY ? '/faculty/profile' : '/student/profile');
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #E2E8F0',
        color: '#0F172A',
        width: isAuthenticated ? { sm: `calc(100% - ${sidebarWidth}px)` } : '100%',
        ml: isAuthenticated ? { sm: `${sidebarWidth}px` } : 0,
      }}
    >
      <Toolbar
        sx={{
          height: 64,
          minHeight: '64px !important',
          px: { xs: 2, sm: 3 },
          gap: 2,
        }}
      >
        {/* Mobile hamburger */}
        {isAuthenticated && (
          <IconButton
            edge="start"
            onClick={toggleSidebar}
            sx={{ display: { sm: 'none' }, color: '#64748B' }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {/* Public logo */}
        {!isAuthenticated && (
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            <Box
              sx={{
                width: 32, height: 32, borderRadius: '9px',
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
        )}

        {/* Page title + breadcrumb (authenticated desktop) */}
        {isAuthenticated && (
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column', justifyContent: 'center' }}>
            <Typography
              sx={{ fontWeight: 700, fontSize: '0.9375rem', color: '#0F172A', lineHeight: 1.1 }}
            >
              {meta.title}
            </Typography>
            <Breadcrumbs
              separator={<NavigateNext sx={{ fontSize: 13 }} />}
              sx={{ mt: 0.2, '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' } }}
            >
              {meta.crumbs.map((crumb, i) => (
                <Typography
                  key={crumb}
                  variant="caption"
                  sx={{
                    color: i === meta.crumbs.length - 1 ? '#4F46E5' : '#94A3B8',
                    fontWeight: i === meta.crumbs.length - 1 ? 600 : 400,
                    fontSize: '0.6875rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {crumb}
                </Typography>
              ))}
            </Breadcrumbs>
          </Box>
        )}

        {/* Mobile page title */}
        {isAuthenticated && (
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '0.9375rem',
              color: '#0F172A',
              display: { xs: 'block', sm: 'none' },
            }}
          >
            {meta.title}
          </Typography>
        )}

        <Box sx={{ flexGrow: 1 }} />

        {/* ── Unauthenticated actions ── */}
        {!isAuthenticated && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="text"
              onClick={() => navigate('/login')}
              sx={{ color: '#64748B', fontWeight: 500, '&:hover': { color: '#4F46E5' } }}
            >
              Login
            </Button>
            <Button variant="contained" onClick={() => navigate('/register')} sx={{ px: 2.5 }}>
              Get Started
            </Button>
          </Box>
        )}

        {/* ── Authenticated: user chip ── */}
        {isAuthenticated && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Name (desktop) */}
            <Box sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'right' }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', lineHeight: 1.2 }}>
                {displayName}
              </Typography>
              <Typography sx={{ fontSize: '0.6875rem', color: '#94A3B8', lineHeight: 1.2 }}>
                {role === ROLES.FACULTY ? 'Faculty' : 'Student'}
              </Typography>
            </Box>

            <IconButton onClick={handleMenu} size="small" sx={{ p: 0 }}>
              <Avatar
                sx={{
                  width: 36, height: 36,
                  background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                  fontSize: '0.8125rem', fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(79,70,229,0.3)',
                }}
              >
                {initials}
              </Avatar>
            </IconButton>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleClose}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              PaperProps={{
                sx: {
                  mt: 1.5,
                  minWidth: 200,
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                  borderRadius: '12px',
                },
              }}
            >
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="body2" fontWeight={700} color="text.primary">
                  {displayName || 'User'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {email}
                </Typography>
              </Box>
              <Divider />
              <MenuItem onClick={handleProfile} sx={{ py: 1.25, px: 2, gap: 1.5 }}>
                <ListItemIcon sx={{ minWidth: 'unset' }}>
                  <Person fontSize="small" sx={{ color: '#64748B' }} />
                </ListItemIcon>
                <Typography variant="body2">My Profile</Typography>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout} sx={{ py: 1.25, px: 2, gap: 1.5 }}>
                <ListItemIcon sx={{ minWidth: 'unset' }}>
                  <Logout fontSize="small" sx={{ color: '#EF4444' }} />
                </ListItemIcon>
                <Typography variant="body2" sx={{ color: '#EF4444' }}>Sign Out</Typography>
              </MenuItem>
            </Menu>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
