import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import theme from './theme';
import { AuthProvider } from './contexts/AuthContext';
import AppShell from './components/layout/AppShell';
import ProtectedRoute from './components/common/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import NaukaPage from './pages/NaukaPage';
import StudySessionPage from './pages/StudySessionPage';
import PytaniaPage from './pages/PytaniaPage';
import SourceQuestionsPage from './pages/SourceQuestionsPage';
import AddQuestionPage from './pages/AddQuestionPage';
import MojePytaniaPage from './pages/MojePytaniaPage';
import MenuPage from './pages/MenuPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

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
      { path: '/study', element: <NaukaPage /> },
      { path: '/study/session', element: <StudySessionPage /> },
      { path: '/browse', element: <PytaniaPage /> },
      { path: '/browse/:source', element: <SourceQuestionsPage /> },
      { path: '/questions/new', element: <AddQuestionPage /> },
      { path: '/questions/mine', element: <MojePytaniaPage /> },
      { path: '/menu', element: <MenuPage /> },
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
