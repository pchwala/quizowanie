import { useState } from 'react';
import { Alert, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const DISMISS_KEY = 'quizowanie-register-cta-dismissed';

/**
 * Dismissible banner for anonymous users: the app works without an account,
 * but registering keeps progress across devices.
 */
export default function RegisterCta() {
  const navigate = useNavigate();
  const { loading, isAnonymous } = useAuth();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === '1',
  );

  if (loading || !isAnonymous || dismissed) return null;

  return (
    <Alert
      severity="info"
      sx={{ mb: 2 }}
      onClose={() => {
        localStorage.setItem(DISMISS_KEY, '1');
        setDismissed(true);
      }}
      action={
        <Button color="inherit" size="small" onClick={() => navigate('/login')}>
          Załóż konto
        </Button>
      }
    >
      Zarejestruj się, aby zapisać postępy i korzystać z nich na różnych urządzeniach.
    </Alert>
  );
}
