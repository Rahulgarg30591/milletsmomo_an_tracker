import { AppBar, Toolbar, Typography, IconButton, Box, Chip, Tooltip } from '@mui/material';
import { LogOut, Sun, Moon, Leaf } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import { haptics, vibrate } from '../theme/tokens';
import { getToday } from '../utils/dateUtils';

const pageTitles: Record<string, string> = {
  '/login': 'Login',
  '/day': 'Orders',
};

function getPageTitle(path: string): string {
  if (path.startsWith('/day/') && path.endsWith('/new')) return 'New Order';
  if (path.startsWith('/day/')) return 'Day View';
  for (const [route, title] of Object.entries(pageTitles)) {
    if (path === route || path.startsWith(route + '/')) return title;
  }
  return 'Millets Momo';
}

export default function AppBarComponent() {
  const { auth, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const location = useLocation();
  const navigate = useNavigate();
  const title = getPageTitle(location.pathname);

  const isLogin = location.pathname === '/login';
  if (isLogin) return null;

  const handleLogout = async () => {
    vibrate(haptics.medium);
    await logout();
    navigate('/login');
  };

  const handleLogoClick = () => {
    vibrate(haptics.light);
    if (auth.role === 'admin') {
      navigate('/admin');
    } else {
      navigate(`/day/${getToday()}`);
    }
  };

  return (
    <AppBar position="sticky" elevation={0} sx={{ zIndex: 1200 }}>
      <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, sm: 3 }, minHeight: 56 }}>
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
          onClick={handleLogoClick}
        >
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #1B6B3A, #2D8A4E)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                '&:active': { transform: 'scale(0.95)' },
              }}
            >
              <Leaf size={18} color="currentColor" />
            </Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: '1.05rem',
              letterSpacing: '-0.3px',
              display: { xs: 'none', sm: 'block' },
            }}
          >
            Millets Momo
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              color: 'text.secondary',
              display: { xs: 'block', sm: 'none' },
            }}
          >
            {title}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              color: 'text.secondary',
              display: { xs: 'none', md: 'block' },
              mr: 1,
            }}
          >
            {title}
          </Typography>
          {auth.role && (
            <Chip
              label={auth.role}
              size="small"
              sx={{
                fontWeight: 600,
                textTransform: 'capitalize',
                fontSize: '0.75rem',
                height: 24,
                backgroundColor: auth.role === 'admin' ? 'rgba(251,191,36,0.12)' : 'rgba(27,107,58,0.12)',
                color: auth.role === 'admin' ? '#FBBF24' : '#4ADE80',
                border: '1px solid',
                borderColor: auth.role === 'admin' ? 'rgba(251,191,36,0.2)' : 'rgba(27,107,58,0.2)',
              }}
            />
          )}
          <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
            <IconButton
              onClick={() => {
                vibrate(haptics.light);
                toggleMode();
              }}
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Logout">
            <IconButton
              onClick={handleLogout}
              size="small"
              sx={{
                color: 'text.secondary',
                '&:hover': { color: 'error.main' },
              }}
            >
              <LogOut size={18} />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
