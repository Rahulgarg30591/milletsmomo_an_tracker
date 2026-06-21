import { BottomNavigation, BottomNavigationAction, Paper, useMediaQuery, useTheme } from '@mui/material';
import { Home, PlusCircle, BarChart3 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getToday } from '../utils/dateUtils';

function getDateFromPath(path: string): string {
  const match = path.match(/\/day\/([^\/]+)/);
  return match ? match[1] : getToday();
}

export default function BottomNav() {
  const { auth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  if (!auth.role || location.pathname === '/login') return null;
  if (isDesktop) return null; // Hide on desktop, use FAB instead

  const isAdmin = auth.role === 'admin';
  const isStaff = auth.role === 'staff';
  const currentDate = getDateFromPath(location.pathname);

  let value = 0;
  if (location.pathname.startsWith('/day') && !location.pathname.endsWith('/new')) value = 0;
  if (location.pathname.endsWith('/new')) value = 1;
  if (location.pathname === '/admin') value = 0;

  if (isAdmin) {
    return (
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1200 }} elevation={0}>
        <BottomNavigation
          showLabels
          value={value}
          onChange={(_e, newValue) => {
            if (newValue === 0) navigate('/admin');
          }}
        >
          <BottomNavigationAction label="Dashboard" icon={<BarChart3 size={20} />} />
        </BottomNavigation>
      </Paper>
    );
  }

  if (isStaff) {
    return (
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1200 }} elevation={0}>
        <BottomNavigation
          showLabels
          value={value}
          onChange={(_e, newValue) => {
            if (newValue === 0) navigate(`/day/${currentDate}`);
            if (newValue === 1) navigate(`/day/${currentDate}/new`);
          }}
        >
          <BottomNavigationAction label="Orders" icon={<Home size={20} />} />
          <BottomNavigationAction label="New Order" icon={<PlusCircle size={20} />} />
        </BottomNavigation>
      </Paper>
    );
  }

  return null;
}