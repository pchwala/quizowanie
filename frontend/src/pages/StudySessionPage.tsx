import { useEffect } from 'react';
import { Box, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
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

export default function StudySessionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { categoryIds } = (location.state as SessionState) ?? {};

  const { preferences } = useUserPreferences();
  const {
    session,
    currentQuestion,
    isFlipped,
    isComplete,
    selectedOption,
    progress,
    startSession,
    flipCard,
    selectOption,
    submitAnswer,
    endSession,
  } = useStudySession({ showOptions: preferences.show_options });

  useEffect(() => {
    startSession(categoryIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBack = async () => {
    await endSession();
    navigate('/nauka');
  };

  const handleComplete = async () => {
    await endSession();
    navigate('/nauka');
  };

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
