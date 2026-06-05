import { useState } from 'react';
import { Box, Paper, TextField, Button, Typography, Alert } from '@mui/material';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, FirebaseError } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';

type Mode = 'login' | 'register';

const FIREBASE_ERRORS: Record<string, string> = {
  'auth/invalid-email': 'Nieprawidłowy adres email.',
  'auth/user-not-found': 'Nie znaleziono konta o podanym adresie email.',
  'auth/wrong-password': 'Nieprawidłowe hasło.',
  'auth/invalid-credential': 'Nieprawidłowy email lub hasło.',
  'auth/email-already-in-use': 'Konto z tym adresem email już istnieje.',
  'auth/weak-password': 'Hasło jest za słabe. Użyj co najmniej 6 znaków.',
  'auth/too-many-requests': 'Za dużo prób logowania. Spróbuj ponownie za chwilę.',
  'auth/network-request-failed': 'Błąd sieci. Sprawdź połączenie z internetem.',
};

function getFirebaseErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError && FIREBASE_ERRORS[err.code]) {
    return FIREBASE_ERRORS[err.code];
  }
  return 'Wystąpił błąd. Spróbuj ponownie.';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      navigate('/study', { replace: true });
    } catch (err: unknown) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper sx={{ p: 4, width: '100%', maxWidth: 400 }}>
        <Typography variant="h5" gutterBottom>
          {mode === 'login' ? 'Zaloguj się' : 'Zarejestruj się'}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            autoComplete="email"
          />
          <TextField
            label="Hasło"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          <Button type="submit" variant="contained" fullWidth disabled={loading}>
            {mode === 'login' ? 'Zaloguj' : 'Zarejestruj'}
          </Button>
          <Button
            variant="text"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
          >
            {mode === 'login' ? 'Nie masz konta? Zarejestruj się' : 'Masz już konto? Zaloguj się'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
