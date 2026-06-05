import { Box, LinearProgress, Typography } from '@mui/material';

interface Props {
  answered: number;
}

export default function SessionProgress({ answered }: Props) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="body2" color="text.secondary" align="right" sx={{ mb: 0.5 }}>
        {answered} {answered === 1 ? 'odpowiedź' : 'odpowiedzi'}
      </Typography>
      <LinearProgress variant="indeterminate" sx={{ borderRadius: 1 }} />
    </Box>
  );
}
