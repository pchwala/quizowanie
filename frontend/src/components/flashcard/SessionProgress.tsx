import { Box, LinearProgress, Typography } from '@mui/material';

interface Props {
  count: number;
  goal: number;
}

export default function SessionProgress({ count, goal }: Props) {
  const value = goal > 0 ? Math.min((count / goal) * 100, 100) : 0;
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="body2" color="text.secondary" align="right" sx={{ mb: 0.5 }}>
        {count} / {goal} odpowiedzi
      </Typography>
      <LinearProgress variant="determinate" value={value} sx={{ borderRadius: 1 }} />
    </Box>
  );
}
