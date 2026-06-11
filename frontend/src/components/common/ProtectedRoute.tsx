import { type ReactNode } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { hasLocalQuestions, refreshBundle } from '../../local/bundle';

/**
 * Bootstrap gate (formerly the login redirect — the app is now usable
 * anonymously). Ensures the local question pool exists before rendering:
 *  - first run: blocks on the bundle download (the one network-required step);
 *  - later runs: renders immediately and refreshes the bundle in background.
 */
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isError, refetch } = useQuery<'ready' | 'offline'>({
    queryKey: ['bundleBootstrap'],
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      if (await hasLocalQuestions()) {
        // Background refresh; refetch local-backed queries if the pool moved.
        void refreshBundle().then((res) => {
          if (res === 'updated') queryClient.invalidateQueries();
        });
        return 'ready';
      }
      const res = await refreshBundle();
      return res === 'offline' ? 'offline' : 'ready';
    },
  });

  // Unexpected failures (e.g. local DB init) get the same retry screen.
  const state = isError ? 'offline' : data;

  if (state === undefined) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography color="text.secondary">Pobieranie pytań…</Typography>
      </Box>
    );
  }

  if (state === 'offline') {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          px: 3,
          textAlign: 'center',
        }}
      >
        <WifiOffIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
        <Typography variant="h6">Brak połączenia z internetem</Typography>
        <Typography color="text.secondary">
          Przy pierwszym uruchomieniu potrzebne jest połączenie, aby pobrać bazę pytań.
          Później aplikacja działa offline.
        </Typography>
        <Button variant="contained" onClick={() => void refetch()}>
          Spróbuj ponownie
        </Button>
      </Box>
    );
  }

  return <>{children}</>;
}
