import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Stack,
  Chip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useCategories } from '../hooks/useCategories';
import { useCreateQuestion } from '../hooks/useCreateQuestion';
import { buildCategoryOptions } from '../utils/categories';

export default function AddQuestionPage() {
  const navigate = useNavigate();
  const { data: categories = [] } = useCategories();
  const { mutateAsync, isPending } = useCreateQuestion();

  const [text, setText] = useState('');
  const [answer, setAnswer] = useState('');
  const [extraAccepted, setExtraAccepted] = useState('');
  const [explanation, setExplanation] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState('');

  // Both private and public questions are filed under a real category.
  const categoryOptions = buildCategoryOptions(categories);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!text.trim() || !answer.trim()) {
      setError('Pytanie i odpowiedź są wymagane.');
      return;
    }
    if (!categoryId) {
      setError('Wybierz kategorię.');
      return;
    }
    try {
      await mutateAsync({
        text,
        answer,
        extraAccepted: extraAccepted
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        explanation,
        mnemonic,
        isPublic,
        categoryId,
      });
      navigate('/questions/mine');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać pytania.');
    }
  }

  return (
    <Box sx={{ px: 2, pt: 2, pb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate(-1)} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Dodaj pytanie</Typography>
      </Box>

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <Chip label="Format: Otwarte" size="small" sx={{ alignSelf: 'flex-start' }} />

          <TextField
            label="Pytanie"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            fullWidth
            multiline
            minRows={2}
          />
          <TextField
            label="Poprawna odpowiedź"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Inne akceptowane odpowiedzi"
            value={extraAccepted}
            onChange={(e) => setExtraAccepted(e.target.value)}
            fullWidth
            helperText="Oddziel przecinkami (opcjonalne)"
          />
          <TextField
            label="Wyjaśnienie"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <TextField
            label="Mnemonika"
            value={mnemonic}
            onChange={(e) => setMnemonic(e.target.value)}
            fullWidth
          />

          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Widoczność
            </Typography>
            <ToggleButtonGroup
              value={isPublic ? 'public' : 'private'}
              exclusive
              size="small"
              onChange={(_, v: string | null) => {
                if (v) setIsPublic(v === 'public');
              }}
              sx={{ '& .MuiToggleButton-root': { flex: 1 } }}
            >
              <ToggleButton value="private">Prywatne</ToggleButton>
              <ToggleButton value="public">Publiczne</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <FormControl size="small" fullWidth required>
            <InputLabel>Kategoria</InputLabel>
            <Select
              value={categoryId}
              label="Kategoria"
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categoryOptions.map((opt) => (
                <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {isPublic && (
            <Alert severity="info">
              Pytanie trafi do weryfikacji. Po akceptacji będzie widoczne dla innych
              w wybranej kategorii. Twoja kopia pozostaje na urządzeniu niezależnie
              od wyniku.
            </Alert>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          <Button type="submit" variant="contained" fullWidth disabled={isPending}>
            Zapisz pytanie
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
