import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Stack,
  Snackbar,
  Alert,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { type FlagReason, FLAG_REASON_LABELS } from '../types/api';
import { useReportQuestion } from '../hooks/useReportQuestion';

interface Props {
  open: boolean;
  questionId: string | null;
  onClose: () => void;
}

const REASONS = Object.entries(FLAG_REASON_LABELS) as [FlagReason, string][];

export default function ReportQuestionDialog({ open, questionId, onClose }: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { mutateAsync, isPending } = useReportQuestion();

  const [reason, setReason] = useState<FlagReason>('wrong_answer');
  const [detail, setDetail] = useState('');
  const [confirmation, setConfirmation] = useState(false);

  // Reset on every close path so the next open starts fresh (no derived-state effect).
  function handleClose() {
    setReason('wrong_answer');
    setDetail('');
    onClose();
  }

  async function handleSubmit() {
    if (!questionId) return;
    await mutateAsync({ questionId, reason, detail });
    setConfirmation(true);
    handleClose();
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        fullScreen={fullScreen}
        maxWidth="sm"
        slotProps={{
          paper: {
            sx: fullScreen
              ? undefined
              : {
                  m: 0,
                  mt: 'auto',
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                  maxHeight: '75vh',
                },
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
          Zgłoś pytanie
          <IconButton onClick={handleClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Powód</InputLabel>
              <Select
                value={reason}
                label="Powód"
                onChange={(e) => setReason(e.target.value as FlagReason)}
              >
                {REASONS.map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Szczegóły (opcjonalne)"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button onClick={handleClose} color="inherit">Anuluj</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={isPending}>
            Zgłoś
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={confirmation}
        autoHideDuration={4000}
        onClose={() => setConfirmation(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setConfirmation(false)}>
          Dziękujemy, pytanie zostało zgłoszone.
        </Alert>
      </Snackbar>
    </>
  );
}
