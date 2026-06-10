import { Box } from '@mui/material';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import ErrorBoundary from '../common/ErrorBoundary';

function useShouldShowNav() {
  const { pathname } = useLocation();
  return !pathname.startsWith('/study/') && !pathname.startsWith('/browse/');
}

export default function AppShell() {
  const showNav = useShouldShowNav();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Box component="main" sx={{ flex: 1, overflowY: 'auto' }}>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </Box>
      {showNav && <BottomNav />}
    </Box>
  );
}
