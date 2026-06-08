import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { updateProfile, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useUserPreferences } from '../hooks/useUserPreferences';

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { preferences, updatePreferences } = useUserPreferences();

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile(auth.currentUser, { displayName });
      setSaved(true);
    } catch {
      setError('Nie udało się zapisać zmian. Spróbuj ponownie.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 480 }}>
      <Typography variant="h5">Ustawienia</Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="subtitle1">Profil</Typography>
        <TextField
          label="Nazwa wyświetlana"
          value={displayName}
          onChange={(e) => { setDisplayName(e.target.value); setSaved(false); }}
          fullWidth
        />
        {saved && <Alert severity="success">Zapisano.</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Zapisywanie…' : 'Zapisz'}
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="subtitle1">Nauka</Typography>
        <FormControlLabel
          control={
            <Switch
              checked={preferences.show_options}
              onChange={() =>
                updatePreferences({ show_options: !preferences.show_options })
              }
            />
          }
          label={
            <Box>
              <Typography variant="body2">Pokazuj możliwe odpowiedzi</Typography>
              <Typography variant="caption" color="text.secondary">
                Dla pytań wielokrotnego wyboru i prawda/fałsz — ułatwia naukę
              </Typography>
            </Box>
          }
        />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="subtitle1">Konto</Typography>
        <Button variant="outlined" color="error" onClick={handleSignOut} sx={{ alignSelf: 'flex-start' }}>
          Wyloguj się
        </Button>
      </Box>
    </Box>
  );
}
