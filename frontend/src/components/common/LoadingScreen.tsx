import { Box, CircularProgress } from '@mui/material';

export default function LoadingScreen() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <CircularProgress />
    </Box>
  );
}
