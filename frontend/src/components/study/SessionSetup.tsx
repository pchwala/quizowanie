import { useState } from 'react';
import {
  Box, Button, Typography, Accordion, AccordionSummary, AccordionDetails,
  FormGroup, FormControlLabel, Checkbox, CircularProgress,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useCategories } from '../../hooks/useCategories';
import { useUserStats } from '../../hooks/useUserStats';

interface Props {
  onStart: (categoryIds?: string[]) => Promise<void>;
}

export default function SessionSetup({ onStart }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { data: categories } = useCategories();
  const { data: stats } = useUserStats();

  const handleStart = async (categoryIds?: string[]) => {
    setLoading(true);
    try {
      await onStart(categoryIds?.length ? categoryIds : undefined);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', pt: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {stats && (
        <Typography variant="h6" align="center" color="text.secondary">
          Dzisiaj do powtórki:{' '}
          <Typography component="span" variant="h6" color="text.primary">
            {stats.due_today}
          </Typography>
        </Typography>
      )}

      <Button
        variant="contained"
        size="large"
        fullWidth
        disabled={loading}
        onClick={() => handleStart()}
        startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
      >
        Zacznij naukę
      </Button>

      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Wybierz kategorie</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormGroup>
            {categories?.map((cat) => (
              <FormControlLabel
                key={cat.id}
                control={
                  <Checkbox checked={selected.includes(cat.id)} onChange={() => toggle(cat.id)} />
                }
                label={cat.name}
              />
            ))}
          </FormGroup>
          {selected.length > 0 && (
            <Button
              variant="outlined"
              fullWidth
              sx={{ mt: 2 }}
              disabled={loading}
              onClick={() => handleStart(selected)}
            >
              Start z filtrem ({selected.length})
            </Button>
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
