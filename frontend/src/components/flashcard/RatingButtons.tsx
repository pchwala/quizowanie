import { Box, Button } from '@mui/material';
import { type AnswerQuality } from '../../types/api';

interface Props {
  onRate: (quality: AnswerQuality) => void;
  disabled?: boolean;
}

const BUTTONS: {
  label: string;
  key: string;
  quality: AnswerQuality;
  color: 'error' | 'warning' | 'success' | 'info';
}[] = [
  { label: 'Źle', key: '1', quality: 0, color: 'error' },
  { label: 'Dobrze', key: '2', quality: 3, color: 'success' },
  { label: 'Łatwe', key: '3', quality: 5, color: 'info' },
];

export default function RatingButtons({ onRate, disabled }: Props) {
  return (
    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap', mt: 3 }}>
      {BUTTONS.map(({ label, key, quality, color }) => (
        <Button
          key={quality}
          variant="outlined"
          color={color}
          disabled={disabled}
          onClick={() => onRate(quality)}
          sx={{ minWidth: 110 }}
        >
          {label}
          <Box component="span" sx={{ ml: 0.5, opacity: 0.5, fontSize: '0.75em' }}>
            [{key}]
          </Box>
        </Button>
      ))}
    </Box>
  );
}
