import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './contexts/AuthContext';
import AppRoutes from './routes/AppRoutes';

const theme = createTheme({
  palette: {
    primary: {
      main: '#4F46E5',
      light: '#6D63F0',
      dark: '#4338CA',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#7C3AED',
      light: '#9461F7',
      dark: '#5B21B6',
      contrastText: '#ffffff',
    },
    success: {
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
    },
    warning: {
      main: '#F59E0B',
      light: '#FCD34D',
      dark: '#D97706',
    },
    error: {
      main: '#EF4444',
      light: '#F87171',
      dark: '#DC2626',
    },
    info: {
      main: '#3B82F6',
      light: '#60A5FA',
      dark: '#2563EB',
    },
    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#0F172A',
      secondary: '#64748B',
    },
    divider: '#E5E7EB',
    grey: {
      50:  '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
    },
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontWeight: 700, fontSize: '2.25rem', lineHeight: 1.2 },
    h2: { fontWeight: 700, fontSize: '1.875rem', lineHeight: 1.25 },
    h3: { fontWeight: 600, fontSize: '1.5rem',   lineHeight: 1.3 },
    h4: { fontWeight: 600, fontSize: '1.25rem',  lineHeight: 1.35 },
    h5: { fontWeight: 600, fontSize: '1.125rem', lineHeight: 1.4 },
    h6: { fontWeight: 600, fontSize: '1rem',     lineHeight: 1.4 },
    body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem',  lineHeight: 1.5 },
    caption: { fontSize: '0.75rem', lineHeight: 1.5 },
    button: { fontWeight: 500, textTransform: 'none', letterSpacing: '0.01em' },
  },
  shape: {
    borderRadius: 10,
  },
  shadows: [
    'none',
    '0 1px 2px rgba(0,0,0,0.05)',
    '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    '0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04)',
    '0 10px 15px rgba(0,0,0,0.06), 0 4px 6px rgba(0,0,0,0.04)',
    '0 20px 25px rgba(0,0,0,0.07), 0 10px 10px rgba(0,0,0,0.04)',
    '0 25px 50px rgba(0,0,0,0.10)',
    '0 25px 50px rgba(0,0,0,0.10)',
    '0 25px 50px rgba(0,0,0,0.10)',
    '0 25px 50px rgba(0,0,0,0.10)',
    '0 25px 50px rgba(0,0,0,0.10)',
    '0 25px 50px rgba(0,0,0,0.10)',
    '0 25px 50px rgba(0,0,0,0.10)',
    '0 25px 50px rgba(0,0,0,0.10)',
    '0 25px 50px rgba(0,0,0,0.10)',
    '0 25px 50px rgba(0,0,0,0.10)',
    '0 25px 50px rgba(0,0,0,0.10)',
    '0 25px 50px rgba(0,0,0,0.10)',
    '0 25px 50px rgba(0,0,0,0.10)',
    '0 25px 50px rgba(0,0,0,0.10)',
    '0 25px 50px rgba(0,0,0,0.10)',
    '0 25px 50px rgba(0,0,0,0.10)',
    '0 25px 50px rgba(0,0,0,0.10)',
    '0 25px 50px rgba(0,0,0,0.10)',
    '0 25px 50px rgba(0,0,0,0.10)',
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 500,
          padding: '8px 18px',
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        contained: {
          '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' },
          transition: 'all 0.15s ease',
        },
        outlined: {
          borderColor: '#D1D5DB',
          '&:hover': { borderColor: '#4F46E5', backgroundColor: 'rgba(79,70,229,0.04)' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: '1px solid #E5E7EB',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          '&:hover': {
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          },
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: '1px solid #E5E7EB',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        },
        elevation0: { boxShadow: 'none', border: 'none' },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#4F46E5' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#4F46E5', borderWidth: 2 },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 500 },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            backgroundColor: '#F8FAFC',
            color: '#64748B',
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            borderBottom: '1px solid #E5E7EB',
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': { backgroundColor: '#F8FAFC' },
          '& .MuiTableCell-root': { borderBottom: '1px solid #F1F5F9' },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 6, backgroundColor: '#E5E7EB' },
        bar: { borderRadius: 6 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 16 },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: { borderRadius: 8, margin: '1px 8px' },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { boxShadow: '0 1px 0 #E5E7EB' },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
