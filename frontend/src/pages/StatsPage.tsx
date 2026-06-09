import { Alert, Box, Skeleton, Typography } from '@mui/material';
import TodayIcon from '@mui/icons-material/Today';
import SchoolIcon from '@mui/icons-material/School';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import StorageIcon from '@mui/icons-material/Storage';
import { useUserStats } from '../hooks/useUserStats';
import StatCard from '../components/stats/StatCard';
import WeakCategoriesChart from '../components/stats/WeakCategoriesChart';

export default function StatsPage() {
  const { data: stats, isLoading, isError } = useUserStats();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} variant="rounded" sx={{ flex: '1 1 150px', height: 100 }} />
          ))}
        </Box>
        <Skeleton variant="rounded" height={280} />
      </Box>
    );
  }

  if (isError || !stats) {
    return <Alert severity="error">Nie udało się załadować statystyk. Spróbuj ponownie.</Alert>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Typography variant="h5">Statystyki</Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <StatCard label="Dzisiaj do powtórki" value={stats.due_today} icon={<TodayIcon fontSize="small" />} />
        <StatCard label="Pytań poznanych" value={stats.total_studied} icon={<SchoolIcon fontSize="small" />} />
        <StatCard label="Seria dni" value={stats.streak_days} icon={<LocalFireDepartmentIcon fontSize="small" />} />
        <StatCard label="Pytań w bazie" value={stats.total_questions} icon={<StorageIcon fontSize="small" />} />
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>
          Słabe kategorie
        </Typography>
        <WeakCategoriesChart categories={stats.weak_categories} />
      </Box>
    </Box>
  );
}
