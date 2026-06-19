import React from 'react';
import {
  Drawer, List, Box, Typography, Avatar, Divider,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Dashboard, Assignment, Person, Create, ManageSearch,
  Analytics, Assessment, LogoutOutlined,
  Description, CloudOutlined, SchoolOutlined,
  AdminPanelSettingsOutlined,
} from '@mui/icons-material';
import { logoutUser } from '../services/authService';
import { ROLES } from '../utils/constants';
import useAuth from '../hooks/useAuth';

/* ── Width constant — consumed by layouts + navbar ────────────────────────── */
export const drawerWidth = 280;

/* ── Nav definitions ──────────────────────────────────────────────────────── */
const STUDENT_NAV = [
  {
    section: 'OVERVIEW',
    items: [
      { text: 'Dashboard',       icon: <Dashboard />,  path: '/student' },
    ],
  },
  {
    section: 'EXAMS',
    items: [
      { text: 'Available Exams', icon: <Assignment />,  path: '/student/exams' },
      { text: 'My Results',      icon: <Assessment />,  path: '/student/results' },
    ],
  },
  {
    section: 'ACCOUNT',
    items: [
      { text: 'Profile',         icon: <Person />,      path: '/student/profile' },
    ],
  },
];

const FACULTY_NAV = [
  {
    section: 'OVERVIEW',
    items: [
      { text: 'Dashboard',    icon: <Dashboard />,             path: '/faculty' },
    ],
  },
  {
    section: 'EXAM MANAGEMENT',
    items: [
      { text: 'Create Exam',  icon: <Create />,                path: '/faculty/create-exam' },
      { text: 'Manage Exams', icon: <ManageSearch />,          path: '/faculty/manage-exams' },
      { text: 'Results',      icon: <Description />,           path: '/faculty/results' },
    ],
  },
  {
    section: 'REPORTS',
    items: [
      { text: 'Analytics',    icon: <Analytics />,             path: '/faculty/analytics' },
    ],
  },
  {
    section: 'ACCOUNT',
    items: [
      { text: 'Profile',      icon: <Person />,                path: '/faculty/profile' },
    ],
  },
];

/* ── Reusable nav item ────────────────────────────────────────────────────── */
const SidebarItem = ({ icon, text, active, onClick }) => (
  <Box
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => e.key === 'Enter' && onClick()}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      px: 1.5,
      height: 44,
      borderRadius: '10px',
      mb: 0.25,
      cursor: 'pointer',
      position: 'relative',
      overflow: 'hidden',
      userSelect: 'none',
      outline: 'none',
      /* ── Active ── */
      ...(active
        ? {
            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
            boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
            color: '#FFFFFF',
          }
        : {
            background: 'transparent',
            color: '#4B5563',
          }),
      /* ── Hover (inactive only) ── */
      ...(!active && {
        '&:hover': {
          backgroundColor: '#F3F4F6',
          color: '#1F2937',
          transform: 'translateX(2px)',
          '& .sidebar-icon': { color: '#6366F1' },
        },
      }),
      /* ── Focus ring ── */
      '&:focus-visible': {
        outline: '2px solid #6366F1',
        outlineOffset: 2,
      },
      transition: 'background 0.18s ease, color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease',
    }}
  >
    {/* Active left bar */}
    {active && (
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: '18%',
          height: '64%',
          width: 3,
          borderRadius: '0 3px 3px 0',
          backgroundColor: 'rgba(255,255,255,0.7)',
        }}
      />
    )}

    {/* Icon */}
    <Box
      className="sidebar-icon"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        color: active ? '#FFFFFF' : '#6B7280',
        flexShrink: 0,
        transition: 'color 0.18s ease',
        '& svg': { fontSize: 18 },
      }}
    >
      {icon}
    </Box>

    {/* Label */}
    <Typography
      sx={{
        fontSize: '0.875rem',
        fontWeight: active ? 600 : 500,
        fontFamily: 'Inter, sans-serif',
        letterSpacing: '-0.01em',
        lineHeight: 1,
        color: 'inherit',
      }}
    >
      {text}
    </Typography>
  </Box>
);

/* ── Main component ───────────────────────────────────────────────────────── */
const Sidebar = ({ mobileOpen, handleDrawerToggle, role, sidebarWidth = drawerWidth }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { currentUser, userProfile } = useAuth();

  const navSections = role === ROLES.FACULTY ? FACULTY_NAV : STUDENT_NAV;

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  const isActive    = (path) => location.pathname === path;
  const displayName = userProfile?.name || currentUser?.displayName || '';
  const initials    = displayName
    ? displayName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';
  const roleLabel   = role === ROLES.FACULTY ? 'Faculty' : 'Student';
  const RoleIcon    = role === ROLES.FACULTY ? AdminPanelSettingsOutlined : SchoolOutlined;

  /* ── Inner drawer content ─────────────────────────────────────────────── */
  const content = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        borderRight: '1px solid #E5E7EB',
        overflowY: 'auto',
        overflowX: 'hidden',
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-track': { background: 'transparent' },
        '&::-webkit-scrollbar-thumb': { background: '#E5E7EB', borderRadius: 4 },
      }}
    >

      {/* ── Brand ──────────────────────────────────────────────────────── */}
      <Box
        sx={{
          height: 64,
          px: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderBottom: '1px solid #F3F4F6',
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 10px rgba(99,102,241,0.3)',
          }}
        >
          <CloudOutlined sx={{ color: '#fff', fontSize: 19 }} />
        </Box>
        <Box>
          <Typography
            sx={{
              color: '#111827',
              fontWeight: 800,
              fontSize: '1rem',
              lineHeight: 1.1,
              letterSpacing: '-0.025em',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            CloudExam
          </Typography>
          <Typography
            sx={{
              color: '#9CA3AF',
              fontSize: '0.6875rem',
              fontWeight: 500,
              mt: 0.2,
              letterSpacing: '0.01em',
            }}
          >
            Examination Platform
          </Typography>
        </Box>
      </Box>

      {/* ── User profile card ───────────────────────────────────────────── */}
      <Box sx={{ px: 2, pt: 2.5, pb: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.5,
            borderRadius: '12px',
            backgroundColor: '#F9FAFB',
            border: '1px solid #F3F4F6',
            cursor: 'default',
            transition: 'all 0.18s ease',
            '&:hover': {
              backgroundColor: '#F3F4F6',
              borderColor: '#E5E7EB',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            },
          }}
        >
          <Avatar
            sx={{
              width: 36,
              height: 36,
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              flexShrink: 0,
              boxShadow: '0 0 0 2px #fff, 0 0 0 4px rgba(99,102,241,0.2)',
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              sx={{
                color: '#111827',
                fontWeight: 600,
                fontSize: '0.875rem',
                lineHeight: 1.2,
                letterSpacing: '-0.01em',
                fontFamily: 'Inter, sans-serif',
              }}
              noWrap
            >
              {displayName || 'User'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
              <RoleIcon sx={{ fontSize: 11, color: '#6366F1' }} />
              <Typography
                sx={{
                  color: '#6B7280',
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  letterSpacing: '0.01em',
                }}
              >
                {roleLabel}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── Navigation sections ──────────────────────────────────────────── */}
      <Box sx={{ flex: 1, px: 1.5, pt: 1 }}>
        {navSections.map((section, si) => (
          <Box key={section.section} sx={{ mt: si === 0 ? 0.5 : 2.5 }}>
            {/* Section label */}
            <Typography
              sx={{
                color: '#9CA3AF',
                fontSize: '0.6rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                px: 1.5,
                mb: 0.75,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {section.section}
            </Typography>

            <List disablePadding>
              {section.items.map((item) => (
                <SidebarItem
                  key={item.path}
                  icon={item.icon}
                  text={item.text}
                  active={isActive(item.path)}
                  onClick={() => navigate(item.path)}
                />
              ))}
            </List>
          </Box>
        ))}
      </Box>

      {/* ── Sign Out ───────────────────────────────────────────────────── */}
      <Box sx={{ px: 1.5, pb: 3, flexShrink: 0 }}>
        <Divider sx={{ borderColor: '#F3F4F6', mb: 2 }} />
        <Box
          onClick={handleLogout}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleLogout()}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 1.5,
            height: 44,
            borderRadius: '10px',
            cursor: 'pointer',
            color: '#6B7280',
            border: '1px solid #F3F4F6',
            transition: 'all 0.18s ease',
            outline: 'none',
            '&:hover': {
              backgroundColor: '#FEF2F2',
              borderColor: '#FECACA',
              color: '#DC2626',
              '& .logout-icon': { color: '#DC2626' },
            },
            '&:focus-visible': { outline: '2px solid #EF4444', outlineOffset: 2 },
          }}
        >
          <Box
            className="logout-icon"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              color: '#9CA3AF',
              flexShrink: 0,
              transition: 'color 0.18s ease',
              '& svg': { fontSize: 18 },
            }}
          >
            <LogoutOutlined />
          </Box>
          <Typography
            sx={{
              fontSize: '0.875rem',
              fontWeight: 500,
              fontFamily: 'Inter, sans-serif',
              color: 'inherit',
              letterSpacing: '-0.01em',
            }}
          >
            Sign Out
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Mobile temporary drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': {
            width: sidebarWidth,
            border: 'none',
            boxSizing: 'border-box',
          },
        }}
      >
        {content}
      </Drawer>

      {/* Desktop permanent drawer — position:fixed */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: sidebarWidth,
            border: 'none',
            boxSizing: 'border-box',
            position: 'fixed',
            top: 0,
            left: 0,
            height: '100vh',
            zIndex: (theme) => theme.zIndex.drawer,
          },
        }}
        open
      >
        {content}
      </Drawer>

      {/* Flex spacer — makes main content start after sidebar */}
      <Box
        sx={{
          display: { xs: 'none', sm: 'block' },
          width: sidebarWidth,
          flexShrink: 0,
        }}
      />
    </>
  );
};

export default Sidebar;
