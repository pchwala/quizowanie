import { useState } from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Paper,
  CircularProgress,
  Pagination,
  Stack,
  Alert,
  Divider,
} from '@mui/material';
import { useCategories } from '../hooks/useCategories';
import { useBrowseQuestions } from '../hooks/useQuestions';
import type { QuestionDetail, Category, QuestionType } from '../types/api';

const PAGE_SIZE = 50;

const TYPE_LABELS: Record<QuestionType, string> = {
  multiple: 'Wielokrotny wybór',
  boolean: 'Prawda / Fałsz',
  question: 'Otwarte',
};

const DIFFICULTY_RANGES: Record<string, { min: number; max: number; label: string }> = {
  easy:   { min: 1, max: 3,  label: 'Łatwe' },
  medium: { min: 4, max: 6,  label: 'Średnie' },
  hard:   { min: 7, max: 10, label: 'Trudne' },
};

function difficultyLabel(d: number | null): string {
  if (d === null) return '';
  if (d <= 3) return 'Łatwe';
  if (d <= 6) return 'Średnie';
  return 'Trudne';
}

function difficultyColor(d: number | null): 'success' | 'warning' | 'error' | 'default' {
  if (d === null) return 'default';
  if (d <= 3) return 'success';
  if (d <= 6) return 'warning';
  return 'error';
}

function buildCategoryOptions(cats: Category[]): { id: string; label: string }[] {
  const childrenOf = new Map<string, Category[]>();
  for (const c of cats) {
    if (c.parent_id) {
      const list = childrenOf.get(c.parent_id) ?? [];
      list.push(c);
      childrenOf.set(c.parent_id, list);
    }
  }

  const result: { id: string; label: string }[] = [];
  const parents = cats
    .filter((c) => c.parent_id === null)
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));

  for (const parent of parents) {
    const children = (childrenOf.get(parent.id) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name, 'pl'),
    );
    if (children.length === 0) {
      result.push({ id: parent.id, label: parent.name });
    } else {
      for (const child of children) {
        result.push({ id: child.id, label: `${parent.name}: ${child.name}` });
      }
    }
  }
  return result;
}

// ── Answer section ────────────────────────────────────────────────────────────

function AnswerSection({ question }: { question: QuestionDetail }) {
  const payload = question.payload as Record<string, unknown>;

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {question.type === 'multiple' &&
        (question.options ?? []).map((opt) => (
          <Chip
            key={opt}
            label={opt}
            size="small"
            color={opt === question.answer ? 'success' : 'default'}
            variant={opt === question.answer ? 'filled' : 'outlined'}
          />
        ))}

      {question.type === 'boolean' &&
        ['Prawda', 'Fałsz'].map((opt) => (
          <Chip
            key={opt}
            label={opt}
            size="small"
            color={opt === question.answer ? 'success' : 'default'}
            variant={opt === question.answer ? 'filled' : 'outlined'}
          />
        ))}

      {question.type === 'question' && (
        <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 600 }}>
          {(payload['accepted'] as string[] | undefined)?.join(' / ') ?? question.answer}
        </Typography>
      )}
    </Box>
  );
}

// ── Question card ─────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  categoryName,
}: {
  question: QuestionDetail;
  categoryName: string;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
        {categoryName && <Chip label={categoryName} size="small" variant="outlined" />}
        <Chip
          label={difficultyLabel(question.difficulty)}
          size="small"
          color={difficultyColor(question.difficulty)}
          variant="outlined"
        />
        <Chip
          label={TYPE_LABELS[question.type]}
          size="small"
          variant="outlined"
          sx={{ color: 'text.disabled', borderColor: 'divider' }}
        />
      </Box>

      <Typography variant="body1" sx={{ mb: 1.5 }}>
        {question.text}
      </Typography>

      <Divider sx={{ mb: 1.5 }} />

      <AnswerSection question={question} />

      {question.explanation && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {question.explanation}
        </Typography>
      )}
    </Paper>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BrowsePage() {
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState<QuestionType | ''>('');
  const [difficulty, setDifficulty] = useState('');
  const [page, setPage] = useState(1);

  const { data: categories = [], isLoading: catsLoading } = useCategories();
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const categoryOptions = buildCategoryOptions(categories);

  const diffRange = difficulty ? DIFFICULTY_RANGES[difficulty] : null;

  const filters = {
    category_id:    categoryId || undefined,
    type:           type || undefined,
    difficulty_min: diffRange?.min,
    difficulty_max: diffRange?.max,
    limit:          PAGE_SIZE,
    offset:         (page - 1) * PAGE_SIZE,
  };

  const { data: questions = [], isLoading, isError, isFetching } = useBrowseQuestions(filters);

  function getCategoryName(id: string): string {
    const cat = categoryById.get(id);
    if (!cat) return '';
    if (cat.parent_id) {
      const parent = categoryById.get(cat.parent_id);
      return parent ? `${parent.name}: ${cat.name}` : cat.name;
    }
    return cat.name;
  }

  function handleFilterChange() {
    setPage(1);
  }

  const loading = isLoading || catsLoading;

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Przeglądaj pytania
      </Typography>

      {/* ── Filters ── */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Kategoria</InputLabel>
          <Select
            value={categoryId}
            label="Kategoria"
            onChange={(e) => { setCategoryId(e.target.value); handleFilterChange(); }}
          >
            <MenuItem value="">Wszystkie kategorie</MenuItem>
            {categoryOptions.map((opt) => (
              <MenuItem key={opt.id} value={opt.id}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <ToggleButtonGroup
          value={difficulty}
          exclusive
          size="small"
          onChange={(_, v) => { setDifficulty(v ?? ''); handleFilterChange(); }}
        >
          {Object.entries(DIFFICULTY_RANGES).map(([key, { label }]) => (
            <ToggleButton key={key} value={key}>{label}</ToggleButton>
          ))}
        </ToggleButtonGroup>

        <ToggleButtonGroup
          value={type}
          exclusive
          size="small"
          onChange={(_, v: QuestionType | null) => { setType(v ?? ''); handleFilterChange(); }}
        >
          <ToggleButton value="multiple">Wielokrotny</ToggleButton>
          <ToggleButton value="boolean">Prawda/Fałsz</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* ── Results ── */}
      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Nie udało się pobrać pytań.
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : questions.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          Brak pytań spełniających kryteria.
        </Typography>
      ) : (
        <Stack spacing={1.5} sx={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity 0.15s' }}>
          {questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              categoryName={getCategoryName(q.category_id)}
            />
          ))}
        </Stack>
      )}

      {/* ── Pagination ── */}
      {!loading && questions.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={questions.length === PAGE_SIZE ? page + 1 : page}
            page={page}
            onChange={(_, p) => { setPage(p); window.scrollTo(0, 0); }}
            color="primary"
            siblingCount={1}
          />
        </Box>
      )}
    </Box>
  );
}
