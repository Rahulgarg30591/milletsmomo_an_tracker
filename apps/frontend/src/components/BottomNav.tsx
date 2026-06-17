import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import { Home, PlusCircle, BarChart3 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function BottomNav() {
  const { auth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!auth.role || location.pathname === '/login') return null;

  const isAdmin = auth.role === 'admin';
  const isStaff = auth.role === 'staff';

  let value = 0;
  if (location.pathname.startsWith('/day')) value = 0;
  if (location.pathname === '/dates') value = 0;
  if (location.pathname.startsWith('/day') && location.pathname.endsWith('/new')) value = 1;
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
            if (newValue === 0) {
              const today = new Date().toISOString().split('T')[0];
              navigate(`/day/${today}`);
            }
            if (newValue === 1) {
              const today = new Date().toISOString().split('T')[0];
              navigate(`/day/${today}/new`);
            }
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