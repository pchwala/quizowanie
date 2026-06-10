import { useEffect } from 'react';
import { Box, Button, IconButton, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CelebrationIcon from '@mui/icons-material/Celebration';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStudySession } from '../hooks/useStudySession';
import { useUserPreferences } from '../hooks/useUserPreferences';
import SessionComplete from '../components/study/SessionComplete';
import FlashCard from '../components/flashcard/FlashCard';
import RatingButtons from '../components/flashcard/RatingButtons';
import SessionProgress from '../components/flashcard/SessionProgress';
import LoadingScreen from '../components/common/LoadingScreen';

interface SessionState {
  categoryIds?: string[];
  mode?: 'new' | 'review';
}

function EmptyState({ mode, onBack }: { mode: 'new' | 'review'; onBack: () => void }) {
  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        px: 3,
        textAlign: 'center',
      }}
    >
      <CelebrationIcon sx={{ fontSize: 48, color: 'primary.main' }} />
      <Typography variant="h6">
        {mode === 'review' ? 'Brak pytań do powtórki 🎉' : 'Brak nowych pytań'}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {mode === 'review'
          ? 'Wszystko powtórzone. Wróć jutro lub ucz się nowych pytań.'
          : 'Brak nowych pytań w wybranych kategoriach.'}
      </Typography>
      <Button variant="contained" onClick={onBack} sx={{ mt: 1 }}>
        Wróć do nauki
      </Button>
    </Box>
  );
}

export default function StudySessionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as SessionState | null;
  const { categoryIds, mode } = state ?? {};

  const { preferences } = useUserPreferences();
  const {
    session,
    currentQuestion,
    isFlipped,
    isComplete,
    isEmpty,
    selectedOption,
    progress,
    startSession,
    flipCard,
    selectOption,
    submitAnswer,
    endSession,
  } = useStudySession({ showOptions: preferences.show_options });

  useEffect(() => {
    // Direct URL hit without navigation state — nothing to start, go home
    if (!state) {
      navigate('/study', { replace: true });
      return;
    }
    startSession(categoryIds, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBack = async () => {
    await endSession();
    navigate('/study');
  };

  const handleComplete = async () => {
    await endSession();
    navigate('/study');
  };

  if (isEmpty) {
    return <EmptyState mode={mode ?? 'review'} onBack={handleBack} />;
  }

  if (isComplete) {
    return <SessionComplete answered={progress.answered} onReset={handleComplete} />;
  }

  if (!session || !currentQuestion) {
    return <LoadingScreen />;
  }

  return (
    <Box sx={{ px: 2, pt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <IconButton onClick={handleBack} size="small" sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <SessionProgress answered={progress.answered} />
      </Box>
      <FlashCard
        question={currentQuestion}
        isFlipped={isFlipped}
        showOptions={preferences.show_options}
        selectedOption={selectedOption}
        onFlip={flipCard}
        onOptionSelect={selectOption}
      />
      {isFlipped && <RatingButtons onRate={submitAnswer} />}
    </Box>
  );
}
