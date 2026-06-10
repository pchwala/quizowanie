import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Divider,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Avatar,
  Alert,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import InfoIcon from '@mui/icons-material/Info';
import LogoutIcon from '@mui/icons-material/Logout';
import { updateProfile, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useUserPreferences } from '../hooks/useUserPreferences';

export default function MenuPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { preferences, updatePreferences } = useUserPreferences();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [dailyLimit, setDailyLimit] = useState(String(preferences.daily_limit ?? 15));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile(auth.currentUser, { displayName });
      updatePreferences({
        ...preferences,
        daily_limit: Math.max(1, parseInt(dailyLimit, 10) || 15),
      });
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

  const initials = (user?.displayName ?? user?.email ?? '?')
    .split(/[\s@]/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Box sx={{ px: 2, pt: 3, pb: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Menu
      </Typography>

      {/* User card */}
      <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48, fontSize: '1rem' }}>
          {initials}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }} noWrap>
            {user?.displayName || 'Brak nazwy'}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {user?.email}
          </Typography>
        </Box>
      </Paper>

      {/* Settings */}
      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block', px: 0.5 }}>
        Ustawienia
      </Typography>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField
            label="Nazwa wyświetlana"
            value={displayName}
            onChange={(e) => { setDisplayName(e.target.value); setSaved(false); }}
            size="small"
            fullWidth
          />

          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.show_options}
                  onChange={() =>
                    updatePreferences({ ...preferences, show_options: !preferences.show_options })
                  }
                />
              }
              label="Pokaż możliwe odpowiedzi"
              sx={{ mx: 0 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, ml: 0.5 }}>
              Pokazuj opcje dla pytań wielokrotnego wyboru
            </Typography>
          </Box>

          <TextField
            label="Dzienny cel"
            type="number"
            value={dailyLimit}
            onChange={(e) => { setDailyLimit(e.target.value); setSaved(false); }}
            size="small"
            slotProps={{ htmlInput: { min: 1, max: 200 } }}
            sx={{ width: 180 }}
          />

          {saved && <Alert severity="success" sx={{ py: 0.5 }}>Zapisano.</Alert>}
          {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}

          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            sx={{ alignSelf: 'flex-start' }}
          >
            {saving ? 'Zapisywanie…' : 'Zapisz'}
          </Button>
        </Box>
      </Paper>

      {/* Placeholder items */}
      <Paper sx={{ mb: 3, opacity: 0.35, pointerEvents: 'none' }}>
        <ListItemButton disabled>
          <ListItemIcon><BarChartIcon /></ListItemIcon>
          <ListItemText primary="Statystyki" />
        </ListItemButton>
        <Divider />
        <ListItemButton disabled>
          <ListItemIcon><InfoIcon /></ListItemIcon>
          <ListItemText primary="O aplikacji" />
        </ListItemButton>
      </Paper>

      {/* Sign out */}
      <Paper>
        <ListItemButton onClick={handleSignOut} sx={{ color: 'error.main', borderRadius: 'inherit' }}>
          <ListItemIcon>
            <LogoutIcon sx={{ color: 'error.main' }} />
          </ListItemIcon>
          <ListItemText primary="Wyloguj się" />
        </ListItemButton>
      </Paper>
    </Box>
  );
}
