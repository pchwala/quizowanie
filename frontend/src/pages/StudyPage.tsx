import { Box } from '@mui/material';
import { useStudySession } from '../hooks/useStudySession';
import { useUserPreferences } from '../hooks/useUserPreferences';
import SessionSetup from '../components/study/SessionSetup';
import SessionComplete from '../components/study/SessionComplete';
import FlashCard from '../components/flashcard/FlashCard';
import RatingButtons from '../components/flashcard/RatingButtons';
import SessionProgress from '../components/flashcard/SessionProgress';
import LoadingScreen from '../components/common/LoadingScreen';

export default function StudyPage() {
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

  if (!session) {
    return <SessionSetup onStart={startSession} />;
  }

  if (isComplete) {
    return <SessionComplete answered={progress.answered} onReset={endSession} />;
  }

  if (!currentQuestion) {
    return <LoadingScreen />;
  }

  return (
    <Box sx={{ maxWidth: 680, mx: 'auto', pt: 2 }}>
      <SessionProgress answered={progress.answered} />
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
