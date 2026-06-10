import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useCategories } from '../hooks/useCategories';
import { useBrowseQuestions } from '../hooks/useQuestions';
import type { QuestionDetail, Category, QuestionType, QuestionSource } from '../types/api';
import { SOURCE_LABELS } from '../types/api';

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

function QuestionCard({ question, categoryName }: { question: QuestionDetail; categoryName: string }) {
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
      <Typography variant="body1" sx={{ mb: 1.5 }}>{question.text}</Typography>
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

export default function SourceQuestionsPage() {
  const { source } = useParams<{ source: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const categoryId = searchParams.get('category') ?? '';
  const type       = (searchParams.get('type') ?? '') as QuestionType | '';
  const difficulty = searchParams.get('difficulty') ?? '';
  const page       = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));

  const { data: categories = [], isLoading: catsLoading } = useCategories();
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const categoryOptions = buildCategoryOptions(categories);

  const diffRange = difficulty ? DIFFICULTY_RANGES[difficulty] : null;

  const filters = {
    source:         source as QuestionSource,
    category_id:    categoryId || undefined,
    type:           type || undefined,
    difficulty_min: diffRange?.min,
    difficulty_max: diffRange?.max,
    limit:          PAGE_SIZE,
    offset:         (page - 1) * PAGE_SIZE,
  };

  const { data, isLoading, isError, isFetching } = useBrowseQuestions(filters);
  const questions = data?.items ?? [];
  const total     = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function updateFilter(key: string, value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      next.set('page', '1');
      return next;
    });
  }

  function getCategoryName(id: string): string {
    const cat = categoryById.get(id);
    if (!cat) return '';
    if (cat.parent_id) {
      const parent = categoryById.get(cat.parent_id);
      return parent ? `${parent.name}: ${cat.name}` : cat.name;
    }
    return cat.name;
  }

  const sourceLabel = source ? (SOURCE_LABELS[source as QuestionSource] ?? source) : '';
  const loading = isLoading || catsLoading;

  return (
    <Box sx={{ px: 2, pt: 2, pb: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate('/browse')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>{sourceLabel}</Typography>
      </Box>

      {/* Filters */}
      <Stack spacing={1.5} sx={{ mb: 2.5 }}>
        <FormControl size="small" fullWidth>
          <InputLabel>Kategoria</InputLabel>
          <Select
            value={categoryId}
            label="Kategoria"
            onChange={(e) => updateFilter('category', e.target.value)}
          >
            <MenuItem value="">Wszystkie kategorie</MenuItem>
            {categoryOptions.map((opt) => (
              <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <ToggleButtonGroup
          value={difficulty}
          exclusive
          size="small"
          onChange={(_, v) => updateFilter('difficulty', v ?? '')}
          sx={{ '& .MuiToggleButton-root': { flex: 1 } }}
        >
          {Object.entries(DIFFICULTY_RANGES).map(([key, { label }]) => (
            <ToggleButton key={key} value={key}>{label}</ToggleButton>
          ))}
        </ToggleButtonGroup>

        <ToggleButtonGroup
          value={type}
          exclusive
          size="small"
          onChange={(_, v: QuestionType | null) => updateFilter('type', v ?? '')}
          sx={{ '& .MuiToggleButton-root': { flex: 1 } }}
        >
          <ToggleButton value="multiple">Wielokrotnego wyboru</ToggleButton>
          <ToggleButton value="boolean">Prawda/Fałsz</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

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

      {!loading && questions.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={pageCount}
            page={page}
            onChange={(_, p) => { updateFilter('page', String(p)); window.scrollTo(0, 0); }}
            color="primary"
            siblingCount={1}
          />
        </Box>
      )}
    </Box>
  );
}
