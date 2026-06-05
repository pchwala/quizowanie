import { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  Divider,
  Checkbox,
  FormControlLabel,
  Link,
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider } from '../firebase';

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
  'auth/popup-closed-by-user': 'Okno logowania zostało zamknięte przed zakończeniem.',
  'auth/popup-blocked': 'Przeglądarka zablokowała okno logowania.',
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
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const applyPersistence = () =>
    setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await applyPersistence();
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

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await applyPersistence();
      await signInWithPopup(auth, googleProvider);
      navigate('/study', { replace: true });
    } catch (err: unknown) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Paper variant="outlined" sx={{ p: 4, width: '100%', maxWidth: 440 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, textAlign: 'center' }}>
          Zaloguj się
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
          Witaj, zaloguj się aby kontynuować
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Button
          variant="outlined"
          color="inherit"
          fullWidth
          size="large"
          startIcon={<GoogleIcon />}
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          Zaloguj się przez Google
        </Button>

        <Divider sx={{ my: 3 }}>lub</Divider>

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            autoComplete="email"
            placeholder="twoj@email.com"
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

          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
              }
              label="Zapamiętaj mnie"
            />
            {mode === 'login' && (
              <Link href="#" underline="hover" variant="body2">
                Nie pamiętasz hasła?
              </Link>
            )}
          </Box>

          <Button type="submit" variant="contained" fullWidth size="large" disabled={loading}>
            {mode === 'login' ? 'Zaloguj się' : 'Zarejestruj się'}
          </Button>

          <Box sx={{ textAlign: 'center' }}>
            <Link
              component="button"
              type="button"
              underline="hover"
              variant="body2"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
              }}
            >
              {mode === 'login' ? 'Nie masz konta? Zarejestruj się' : 'Masz już konto? Zaloguj się'}
            </Link>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
