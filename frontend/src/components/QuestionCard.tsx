import { Box, Typography, IconButton, Chip, Paper, Divider } from '@mui/material';
import OutlinedFlagIcon from '@mui/icons-material/OutlinedFlag';
import type { QuestionDetail } from '../types/api';
import { SOURCE_LABELS } from '../types/api';
import { TYPE_LABELS, difficultyLabel, difficultyColor } from '../utils/questionDisplay';

function AnswerSection({ question }: { question: QuestionDetail }) {
  const payload = question.payload as Record<string, unknown>;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {question.type === 'multiple' &&
        (question.options ?? []).map((opt) => (
          <Chip
            key={opt}
            label={opt}
            size="small"
            color={opt === question.answer ? 'success' : 'default'}
            variant={opt === question.answer ? 'filled' : 'outlined'}
          />
        ))}
      {question.type === 'boolean' &&
        ['Prawda', 'Fałsz'].map((opt) => (
          <Chip
            key={opt}
            label={opt}
            size="small"
            color={opt === question.answer ? 'success' : 'default'}
            variant={opt === question.answer ? 'filled' : 'outlined'}
          />
        ))}
      {question.type === 'question' && (
        <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 600 }}>
          {(payload['accepted'] as string[] | undefined)?.join(' / ') ?? question.answer}
        </Typography>
      )}
    </Box>
  );
}

export default function QuestionCard({
  question,
  categoryName,
  onReport,
  showSource = false,
}: {
  question: QuestionDetail;
  categoryName: string;
  onReport: () => void;
  showSource?: boolean;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mb: 1 }}>
        {showSource && (
          <Chip label={SOURCE_LABELS[question.source] ?? question.source} size="small" color="primary" variant="outlined" />
        )}
        {categoryName && <Chip label={categoryName} size="small" variant="outlined" />}
        <Chip
          label={difficultyLabel(question.difficulty)}
          size="small"
          color={difficultyColor(question.difficulty)}
          variant="outlined"
        />
        <Chip
          label={TYPE_LABELS[question.type]}
          size="small"
          variant="outlined"
          sx={{ color: 'text.disabled', borderColor: 'divider' }}
        />
        <IconButton
          size="small"
          onClick={onReport}
          aria-label="Zgłoś pytanie"
          sx={{ ml: 'auto', color: 'text.disabled' }}
        >
          <OutlinedFlagIcon fontSize="small" />
        </IconButton>
      </Box>
      <Typography variant="body1" sx={{ mb: 1.5 }}>{question.text}</Typography>
      <Divider sx={{ mb: 1.5 }} />
      <AnswerSection question={question} />
      {question.explanation && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {question.explanation}
        </Typography>
      )}
    </Paper>
  );
}
