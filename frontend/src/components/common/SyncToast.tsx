import { useEffect, useState } from 'react';
import { Snackbar } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { SYNC_DONE_EVENT } from '../../sync/syncEngine';

/** Listens for completed syncs and confirms them ("Zsynchronizowano X odpowiedzi"). */
export default function SyncToast() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const synced = (e as CustomEvent<{ synced: number }>).detail.synced;
      setMessage(`Zsynchronizowano ${synced} odpowiedzi`);
      // Server may have merged progress from other devices — refresh local-backed views.
      void queryClient.invalidateQueries({ queryKey: ['userStats'] });
      void queryClient.invalidateQueries({ queryKey: ['newLearnedToday'] });
    };
    window.addEventListener(SYNC_DONE_EVENT, handler);
    return () => window.removeEventListener(SYNC_DONE_EVENT, handler);
  }, [queryClient]);

  return (
    <Snackbar
      open={message !== null}
      autoHideDuration={4000}
      onClose={() => setMessage(null)}
      message={message}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    />
  );
}
