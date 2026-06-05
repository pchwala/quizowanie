import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import theme from './theme';
import { AuthProvider } from './contexts/AuthContext';
import AppShell from './components/layout/AppShell';
import ProtectedRoute from './components/common/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import StudyPage from './pages/StudyPage';
import BrowsePage from './pages/BrowsePage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';

const queryClient = new QueryClient();

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/study" replace /> },
      { path: '/study', element: <StudyPage /> },
      { path: '/browse', element: <BrowsePage /> },
      { path: '/stats', element: <StatsPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <RouterProvider router={router} />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
