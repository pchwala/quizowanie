import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Divider,
  ButtonBase,
  Autocomplete,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  CircularProgress,
  Pagination,
  Alert,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import QuizIcon from '@mui/icons-material/Quiz';
import TvIcon from '@mui/icons-material/Tv';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlined';
import type { QuestionSource, QuestionType } from '../types/api';
import { SOURCE_LABELS } from '../types/api';
import { useCategories } from '../hooks/useCategories';
import { useBrowseQuestions } from '../hooks/useQuestions';
import { buildCategoryOptions } from '../utils/categories';
import QuestionCard from '../components/QuestionCard';
import { DIFFICULTY_RANGES } from '../utils/questionDisplay';
import ReportQuestionDialog from '../components/ReportQuestionDialog';

interface SourceConfig {
  key: QuestionSource;
  Icon: React.ElementType;
  color: string;
}

const SOURCES: SourceConfig[] = [
  { key: 'opentdb',            Icon: QuizIcon,         color: '#4f6ef7' },
  { key: '1z10_archive',       Icon: TvIcon,           color: '#e5c07b' },
  { key: 'milionerzy_archive', Icon: EmojiEventsIcon,  color: '#56b6c2' },
];

const PAGE_SIZE = 50;

export default function PytaniaPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reportTarget, setReportTarget] = useState<string | null>(null);

  const categoryId = searchParams.get('category') ?? '';
  const type       = (searchParams.get('type') ?? '') as QuestionType | '';
  const difficulty = searchParams.get('difficulty') ?? '';
  const page       = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));

  const { data: categories = [] } = useCategories();
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const categoryOptions = buildCategoryOptions(categories);
  const selectedOption = categoryOptions.find((o) => o.id === categoryId) ?? null;

  const filterActive = Boolean(categoryId || type || difficulty);
  const diffRange = difficulty ? DIFFICULTY_RANGES[difficulty] : null;

  const { data, isLoading, isError, isFetching } = useBrowseQuestions({
    category_id:    categoryId || undefined,
    type:           type || undefined,
    difficulty_min: diffRange?.min,
    difficulty_max: diffRange?.max,
    limit:          PAGE_SIZE,
    offset:         (page - 1) * PAGE_SIZE,
  });
  const questions = data?.items ?? [];
  const total     = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function updateFilter(key: string, value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      if (key !== 'page') next.set('page', '1');
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

  return (
    <Box sx={{ px: 2, pt: 3, pb: 2 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 2.5 }}>
        Baza pytań
      </Typography>

      {/* Search + filters (all sources) */}
      <Stack spacing={1.5} sx={{ mb: 3 }}>
        <Autocomplete
          options={categoryOptions}
          value={selectedOption}
          onChange={(_, opt) => updateFilter('category', opt?.id ?? '')}
          getOptionLabel={(o) => o.label}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          size="small"
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Szukaj kategorii…"
              slotProps={{
                ...params.slotProps,
                input: {
                  ...params.slotProps.input,
                  startAdornment: (
                    <>
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                      {params.slotProps.input.startAdornment}
                    </>
                  ),
                },
              }}
            />
          )}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
        />

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

      {/* Results (only when a filter is active) */}
      {filterActive && (
        <Box sx={{ mb: 3 }}>
          {isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Nie udało się pobrać pytań.
            </Alert>
          )}
          {isLoading ? (
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
                  onReport={() => setReportTarget(q.id)}
                  showSource
                />
              ))}
            </Stack>
          )}

          {!isLoading && questions.length > 0 && (
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
      )}

      {!filterActive && (
        <>
          <Paper sx={{ mb: 3 }}>
            {[
              {
                label: 'Moje pytania',
                Icon: CollectionsBookmarkIcon,
                color: '#7c6ff0',
                path: '/questions/mine',
              },
              {
                label: 'Dodaj nowe pytanie',
                Icon: AddCircleOutlineIcon,
                color: '#5cb85c',
                path: '/questions/new',
              },
            ].map(({ label, Icon, color, path }, i) => (
              <Box key={path}>
                {i > 0 && <Divider />}
                <ButtonBase
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    px: 2,
                    py: 1.5,
                    gap: 2,
                    textAlign: 'left',
                  }}
                  onClick={() => navigate(path)}
                >
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: 2,
                      bgcolor: `${color}22`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon sx={{ color, fontSize: 22 }} />
                  </Box>
                  <Typography sx={{ flex: 1, fontWeight: 500 }}>{label}</Typography>
                  <ChevronRightIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </ButtonBase>
              </Box>
            ))}
          </Paper>

          <Paper>
            {SOURCES.map(({ key, Icon, color }, i) => (
              <Box key={key}>
                {i > 0 && <Divider />}
                <ButtonBase
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    px: 2,
                    py: 1.5,
                    gap: 2,
                    textAlign: 'left',
                  }}
                  onClick={() => navigate(`/browse/${key}`)}
                >
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: 2,
                      bgcolor: `${color}22`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon sx={{ color, fontSize: 22 }} />
                  </Box>
                  <Typography sx={{ flex: 1, fontWeight: 500 }}>
                    {SOURCE_LABELS[key]}
                  </Typography>
                  <ChevronRightIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </ButtonBase>
              </Box>
            ))}
          </Paper>
        </>
      )}

      <ReportQuestionDialog
        open={reportTarget !== null}
        questionId={reportTarget}
        onClose={() => setReportTarget(null)}
      />
    </Box>
  );
}
