import { useEffect, useState } from 'react';
import { Box, Button, IconButton, LinearProgress, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OutlinedFlagIcon from '@mui/icons-material/OutlinedFlag';
import CelebrationIcon from '@mui/icons-material/Celebration';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStudySession } from '../hooks/useStudySession';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { useNewLearnedToday } from '../hooks/useNewLearnedToday';
import SessionComplete from '../components/study/SessionComplete';
import FlashCard from '../components/flashcard/FlashCard';
import RatingButtons from '../components/flashcard/RatingButtons';
import SessionProgress from '../components/flashcard/SessionProgress';
import LoadingScreen from '../components/common/LoadingScreen';
import ReportQuestionDialog from '../components/ReportQuestionDialog';
import type { QuestionSource } from '../types/api';

interface SessionState {
  categoryIds?: string[];
  sources?: QuestionSource[];
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

// Smoothly draining countdown bar for the answer timer. Mounted per question
// (keyed on the question id) and only while the question is showing, so its
// rAF animation restarts cleanly each question. Isolated here so only this
// small component re-renders each frame — not the page or the FlashCard. The
// actual auto-flip on timeout is owned by useStudySession's setTimeout.
function AnswerTimerBar({ durationSeconds }: { durationSeconds: number }) {
  const [remaining, setRemaining] = useState(durationSeconds);

  useEffect(() => {
    const deadline = performance.now() + durationSeconds * 1000;
    let raf = 0;
    const tick = () => {
      const r = Math.max(0, (deadline - performance.now()) / 1000);
      setRemaining(r);
      if (r > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationSeconds]);

  // Red in the final 3 seconds regardless of the configured duration.
  const danger = remaining <= 3;

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mb: 1.5 }}>
      <LinearProgress
        variant="determinate"
        value={(remaining / durationSeconds) * 100}
        color={danger ? 'error' : 'primary'}
        sx={{ height: 6, borderRadius: 3 }}
      />
      <Typography
        variant="caption"
        color={danger ? 'error.main' : 'text.secondary'}
        sx={{ display: 'block', textAlign: 'right', mt: 0.25 }}
      >
        {Math.ceil(remaining)} s
      </Typography>
    </Box>
  );
}

export default function StudySessionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as SessionState | null;
  const { categoryIds, sources, mode } = state ?? {};

  const { preferences } = useUserPreferences();
  const learnedToday = useNewLearnedToday();
  const [reportOpen, setReportOpen] = useState(false);
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
  } = useStudySession({
    showOptions: preferences.show_options,
    timerEnabled: preferences.timer_enabled,
    timerSeconds: preferences.timer_seconds,
  });

  useEffect(() => {
    // Direct URL hit without navigation state — nothing to start, go home
    if (!state) {
      navigate('/study', { replace: true });
      return;
    }
    startSession(categoryIds, mode, sources);
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
        <SessionProgress count={learnedToday} goal={preferences.daily_limit ?? 15} />
        <IconButton
          onClick={() => setReportOpen(true)}
          size="small"
          aria-label="Zgłoś pytanie"
          sx={{ ml: 'auto', alignSelf: 'flex-start', color: 'text.disabled' }}
        >
          <OutlinedFlagIcon fontSize="small" />
        </IconButton>
      </Box>
      {preferences.timer_enabled && !isFlipped && (
        <AnswerTimerBar
          key={currentQuestion.id}
          durationSeconds={preferences.timer_seconds ?? 5}
        />
      )}
      <FlashCard
        question={currentQuestion}
        isFlipped={isFlipped}
        showOptions={preferences.show_options}
        selectedOption={selectedOption}
        onFlip={flipCard}
        onOptionSelect={selectOption}
      />
      {isFlipped && <RatingButtons onRate={submitAnswer} />}

      <ReportQuestionDialog
        open={reportOpen}
        questionId={currentQuestion.id}
        onClose={() => setReportOpen(false)}
      />
    </Box>
  );
}
