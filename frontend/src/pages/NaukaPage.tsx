import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Divider,
  ButtonBase,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlined';
import HistoryIcon from '@mui/icons-material/History';
import { useNavigate } from 'react-router-dom';
import { useUserStats } from '../hooks/useUserStats';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { useNewLearnedToday } from '../store/dailyProgress';
import WeakCategoriesChart from '../components/stats/WeakCategoriesChart';
import CategoryPickerModal from '../components/study/CategoryPickerModal';

const DAYS = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

function DayTracker() {
  const today = new Date().getDay();
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-around', mb: 1.5 }}>
      {DAYS.map((d, i) => {
        const active = i === today;
        return (
          <Box key={d} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: '1px solid',
                borderColor: active ? 'primary.main' : 'rgba(255,255,255,0.12)',
                bgcolor: active ? 'primary.main' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography sx={{ fontSize: '0.7rem', color: active ? '#fff' : 'text.secondary', fontWeight: active ? 700 : 400 }}>
                {d}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.6rem', color: active ? 'primary.main' : 'transparent', lineHeight: 1 }}>
              ▲
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

function categoryLabel(count: number): string {
  if (count === 0) return 'Wszystkie kategorie';
  if (count === 1) return '1 kategoria wybrana';
  if (count <= 4) return `${count} kategorie wybrane`;
  return `${count} kategorii wybranych`;
}

export default function NaukaPage() {
  const navigate = useNavigate();
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const { data: stats } = useUserStats();
  const { preferences } = useUserPreferences();

  const dueCount = stats?.due_today ?? 0;
  const dailyLimit = preferences.daily_limit ?? 15;
  const learnedToday = useNewLearnedToday();
  const weakCategories = stats?.weak_categories ?? [];

  function startSession(mode: 'new' | 'review') {
    navigate('/study/session', {
      state: {
        categoryIds: selectedCategoryIds.length ? selectedCategoryIds : undefined,
        mode,
      },
    });
  }

  return (
    <Box sx={{ px: 2, pt: 3, pb: 2 }}>
      {/* Title */}
      <Typography
        variant="h4"
        align="center"
        sx={{ mb: 3, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1 }}
      >
        <Box component="span" sx={{ color: 'primary.main' }}>quiz</Box>owanie
      </Typography>

      {/* Spaced repetition section */}
      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block', px: 0.5 }}>
        Powtarzanie z przerwami
      </Typography>
      <Paper sx={{ mb: 3 }}>
        {/* Category row */}
        <ButtonBase
          sx={{ width: '100%', display: 'flex', alignItems: 'center', px: 2, py: 1.75, gap: 2, textAlign: 'left' }}
          onClick={() => setCategoryModalOpen(true)}
        >
          <EditIcon sx={{ color: 'text.secondary', fontSize: 22, flexShrink: 0 }} />
          <Typography sx={{ flex: 1, fontWeight: 500 }}>
            {categoryLabel(selectedCategoryIds.length)}
          </Typography>
        </ButtonBase>

        <Divider />

        {/* New questions row */}
        <ButtonBase
          sx={{ width: '100%', display: 'flex', alignItems: 'center', px: 2, py: 1.75, gap: 2, textAlign: 'left' }}
          onClick={() => startSession('new')}
        >
          <AddCircleOutlineIcon sx={{ color: '#e06c75', fontSize: 26, flexShrink: 0 }} />
          <Box>
            <Typography sx={{ fontWeight: 500, lineHeight: 1.4 }}>Ucz się nowych pytań</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Nauczyłeś się dziś: {learnedToday} z {dailyLimit}
            </Typography>
          </Box>
        </ButtonBase>

        <Divider />

        {/* Review row */}
        <ButtonBase
          sx={{ width: '100%', display: 'flex', alignItems: 'center', px: 2, py: 1.75, gap: 2, textAlign: 'left' }}
          onClick={() => startSession('review')}
        >
          <HistoryIcon sx={{ color: '#e5c07b', fontSize: 26, flexShrink: 0 }} />
          <Box>
            <Typography sx={{ fontWeight: 500, lineHeight: 1.4 }}>Powtórz pytania</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Pytań do powtórki: {dueCount}
            </Typography>
          </Box>
        </ButtonBase>
      </Paper>

      {/* Stats section */}
      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block', px: 0.5 }}>
        Statystyki
      </Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <DayTracker />
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
          <Box sx={{ flex: 1, bgcolor: 'background.default', borderRadius: 2, p: 1.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
              Seria
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{stats?.streak_days ?? 0}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>dni</Typography>
            </Box>
          </Box>
          <Box sx={{ flex: 1, bgcolor: 'background.default', borderRadius: 2, p: 1.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
              Razem
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{stats?.total_studied ?? 0}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>pytań</Typography>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
          Słabe kategorie
        </Typography>
        <WeakCategoriesChart categories={weakCategories} />
      </Paper>

      <CategoryPickerModal
        open={categoryModalOpen}
        selected={selectedCategoryIds}
        onClose={() => setCategoryModalOpen(false)}
        onConfirm={(ids) => {
          setSelectedCategoryIds(ids);
          setCategoryModalOpen(false);
        }}
      />
    </Box>
  );
}
