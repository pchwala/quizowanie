import { Box, Paper, Typography } from '@mui/material';
import { Question } from '../../types/api';

interface Props {
  question: Question;
  isFlipped: boolean;
  onFlip: () => void;
}

const cardFace = {
  position: 'absolute' as const,
  width: '100%',
  height: '100%',
  backfaceVisibility: 'hidden' as const,
  WebkitBackfaceVisibility: 'hidden' as const,
  display: 'flex',
  flexDirection: 'column' as const,
  justifyContent: 'center',
  p: 3,
};

export default function FlashCard({ question, isFlipped, onFlip }: Props) {
  return (
    <Box
      onClick={onFlip}
      sx={{
        width: '100%',
        maxWidth: 600,
        height: 280,
        perspective: '1000px',
        cursor: isFlipped ? 'default' : 'pointer',
        mx: 'auto',
      }}
    >
      <Box
        sx={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.45s ease',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front — question */}
        <Paper elevation={3} sx={{ ...cardFace, alignItems: 'center' }}>
          <Typography variant="h5" align="center">
            {question.text}
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ mt: 2 }}>
            Kliknij lub naciśnij Spację, aby odkryć odpowiedź
          </Typography>
        </Paper>

        {/* Back — answer + explanation + mnemonic */}
        <Paper
          elevation={3}
          sx={{ ...cardFace, transform: 'rotateY(180deg)', gap: 1.5, overflowY: 'auto' }}
        >
          <Typography variant="h5" align="center" fontWeight="bold">
            {question.answer}
          </Typography>
          {question.explanation && (
            <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                {question.explanation}
              </Typography>
            </Box>
          )}
          {question.mnemonic && (
            <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1.5 }}>
              <Typography variant="body2" color="text.secondary" fontStyle="italic">
                Mnemonika: {question.mnemonic}
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
