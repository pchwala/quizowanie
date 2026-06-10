import { Box, Button, Paper, Typography } from '@mui/material';
import { type QuestionDetail, SOURCE_LABELS } from '../../types/api';

interface Props {
  question: QuestionDetail;
  isFlipped: boolean;
  showOptions: boolean;
  selectedOption: string | null;
  onFlip: () => void;
  onOptionSelect: (option: string) => void;
}

// Both faces share the same grid cell, so the card grows to fit the taller face
// instead of clipping long content (no fixed height).
const cardFace = {
  gridArea: '1 / 1',
  width: '100%',
  backfaceVisibility: 'hidden' as const,
  WebkitBackfaceVisibility: 'hidden' as const,
  display: 'flex',
  flexDirection: 'column' as const,
  justifyContent: 'center',
  p: 3,
};

export default function FlashCard({
  question,
  isFlipped,
  showOptions,
  selectedOption,
  onFlip,
  onOptionSelect,
}: Props) {
  const hasOptions = showOptions && question.type !== 'question' && !!question.options?.length;
  // When options are shown, outer click does nothing — user must pick an option
  const handleOuterClick = hasOptions && !isFlipped ? undefined : !isFlipped ? onFlip : undefined;

  return (
    <Box
      onClick={handleOuterClick}
      sx={{
        width: '100%',
        maxWidth: 600,
        minHeight: 280,
        perspective: '1000px',
        cursor: handleOuterClick ? 'pointer' : 'default',
        mx: 'auto',
      }}
    >
      <Box
        sx={{
          width: '100%',
          minHeight: 280,
          display: 'grid',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.45s ease',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front — question */}
        <Paper
          elevation={3}
          sx={{
            ...cardFace,
            alignItems: 'center',
            gap: hasOptions ? 1 : 0,
            justifyContent: hasOptions ? 'flex-start' : 'center',
          }}
        >
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ mb: hasOptions ? 0 : 1, alignSelf: 'flex-end', textAlign: 'right', width: '100%' }}
          >
            {SOURCE_LABELS[question.source]}
          </Typography>
          <Typography variant="h5" align="center" sx={{ mb: hasOptions ? 1.5 : 0 }}>
            {question.text}
          </Typography>

          {hasOptions && question.options ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
              {question.options.map((opt) => (
                <Button
                  key={opt}
                  variant="outlined"
                  fullWidth
                  size="small"
                  onClick={(e) => { e.stopPropagation(); onOptionSelect(opt); }}
                  sx={{ textTransform: 'none', textAlign: 'left', justifyContent: 'flex-start' }}
                >
                  {opt}
                </Button>
              ))}
            </Box>
          ) : (
            <Typography variant="caption" color="text.disabled" sx={{ mt: 2 }}>
              Kliknij lub naciśnij Spację, aby odkryć odpowiedź
            </Typography>
          )}
        </Paper>

        {/* Back — answer + explanation + mnemonic; only rendered while flipped so the
            new question's answer is never visible during the flip-back animation. */}
        <Paper
          elevation={3}
          sx={{ ...cardFace, transform: 'rotateY(180deg)', gap: 1.5, overflowY: 'auto' }}
        >
          {isFlipped && (
            <>
              {hasOptions && question.options ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
                  {question.options.map((opt) => {
                    const isCorrect = opt === question.answer;
                    const isWrong = opt === selectedOption && !isCorrect;
                    return (
                      <Box
                        key={opt}
                        sx={{
                          border: 1,
                          borderRadius: 1,
                          px: 1.5,
                          py: 0.75,
                          borderColor: isCorrect
                            ? 'success.main'
                            : isWrong
                            ? 'error.main'
                            : 'divider',
                          bgcolor: isCorrect
                            ? 'success.dark'
                            : isWrong
                            ? 'error.dark'
                            : 'transparent',
                          opacity: isCorrect || isWrong ? 1 : 0.4,
                        }}
                      >
                        <Typography variant="body2">{opt}</Typography>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Typography variant="h5" align="center" sx={{ fontWeight: 'bold' }}>
                  {question.answer}
                </Typography>
              )}

              {question.explanation && (
                <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    {question.explanation}
                  </Typography>
                </Box>
              )}
              {question.mnemonic && (
                <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1.5 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    Mnemonika: {question.mnemonic}
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
