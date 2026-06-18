import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  Paper,
  Chip,
  Stack,
  Button,
  CircularProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import { useUserQuestions } from '../hooks/useUserQuestions';
import { useCategories } from '../hooks/useCategories';
import type { AuthoredQuestion } from '../types/api';

type StatusChip = { label: string; color: 'default' | 'warning' | 'success' | 'error' };

function statusChip(q: AuthoredQuestion): StatusChip {
  if (!q.is_public) return { label: 'Prywatne', color: 'default' };
  if (q.verification_status === 'verified') return { label: 'Zaakceptowane', color: 'success' };
  if (q.verification_status === 'rejected') return { label: 'Odrzucone', color: 'error' };
  return { label: 'W weryfikacji', color: 'warning' };
}

export default function MojePytaniaPage() {
  const navigate = useNavigate();
  const { data: questions = [], isLoading } = useUserQuestions();
  const { data: categories = [] } = useCategories();
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  function categoryName(id: string): string {
    const cat = categoryById.get(id);
    if (!cat) return '';
    if (cat.parent_id) {
      const parent = categoryById.get(cat.parent_id);
      return parent ? `${parent.name}: ${cat.name}` : cat.name;
    }
    return cat.name;
  }

  return (
    <Box sx={{ px: 2, pt: 2, pb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate('/browse')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 700, flex: 1 }}>Moje pytania</Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => navigate('/questions/new')}
        >
          Dodaj
        </Button>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : questions.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          Nie masz jeszcze własnych pytań.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {questions.map((q) => {
            const status = statusChip(q);
            const cat = categoryName(q.category_id);
            return (
              <Paper key={q.id} variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
                  {cat && <Chip label={cat} size="small" variant="outlined" />}
                  <Chip label={status.label} size="small" color={status.color} variant="outlined" />
                </Box>
                <Typography variant="body1" sx={{ mb: 0.5 }}>{q.text}</Typography>
                <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 600 }}>
                  {q.answer}
                </Typography>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
