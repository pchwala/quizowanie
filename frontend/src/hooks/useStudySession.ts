import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type StudySession, type StudyMode, type QuestionDetail, type QuestionSource, type AnswerQuality } from '../types/api';
import { startLocalSession, getNextForSession, submitLocalAnswer } from '../local/engine';
import { syncNow } from '../sync/syncEngine';

interface UseStudySessionOptions {
  showOptions?: boolean;
}

export function useStudySession({ showOptions = true }: UseStudySessionOptions = {}) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<StudySession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionDetail | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const sessionRef = useRef(session);
  const isFlippedRef = useRef(isFlipped);
  const currentQuestionRef = useRef(currentQuestion);
  sessionRef.current = session;
  isFlippedRef.current = isFlipped;
  currentQuestionRef.current = currentQuestion;

  const fetchNext = async (s: StudySession): Promise<boolean> => {
    // Local store holds the full row — no separate detail fetch needed.
    const detail = await getNextForSession(s);
    if (detail === null) {
      setCurrentQuestion(null);
      setIsFlipped(false);
      setSelectedOption(null);
      return false;
    }
    // Batched: back face clears (isFlipped=false stops rendering answer),
    // front face loads new question — no flash of new answer during flip animation.
    setCurrentQuestion(detail);
    setIsFlipped(false);
    setSelectedOption(null);
    return true;
  };

  const startSession = async (
    categoryIds?: string[],
    mode: StudyMode = 'mixed',
    sources?: QuestionSource[],
  ) => {
    const s = startLocalSession(
      categoryIds?.length ? categoryIds : null,
      mode,
      sources?.length ? sources : null,
    );
    setIsComplete(false);
    setIsEmpty(false);
    setAnswered(0);
    if (await fetchNext(s)) {
      setSession(s);
    } else {
      // Nothing to study for this mode
      setIsEmpty(true);
    }
  };

  const flipCard = useCallback(() => setIsFlipped(true), []);

  const selectOption = useCallback((option: string) => {
    setSelectedOption(option);
    setIsFlipped(true);
  }, []);

  const submitAnswer = async (quality: AnswerQuality) => {
    const s = sessionRef.current;
    if (!s || !currentQuestion) return;
    setAnswered((n) => n + 1);
    await submitLocalAnswer(s, currentQuestion.id, quality);
    // The daily-goal counter is derived from answer_events — refresh it.
    void queryClient.invalidateQueries({ queryKey: ['newLearnedToday'] });
    if (!(await fetchNext(s))) {
      setIsComplete(true);
    }
  };

  const submitAnswerRef = useRef(submitAnswer);
  submitAnswerRef.current = submitAnswer;

  const selectOptionRef = useRef(selectOption);
  selectOptionRef.current = selectOption;

  const endSession = async () => {
    setSession(null);
    setCurrentQuestion(null);
    setIsFlipped(false);
    setSelectedOption(null);
    setIsComplete(false);
    setIsEmpty(false);
    setAnswered(0);
    queryClient.invalidateQueries({ queryKey: ['userStats'] });
    queryClient.invalidateQueries({ queryKey: ['dailyActivity'] });
    // Opportunistic push of the session's answers (no-op offline/anonymous-only).
    void syncNow();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!sessionRef.current) return;

      if (!isFlippedRef.current) {
        // Option selection via keyboard (1-4) when options are shown
        const q = currentQuestionRef.current;
        if (showOptions && q && q.type !== 'question' && q.options) {
          const idx = parseInt(e.key) - 1;
          if (!isNaN(idx) && idx >= 0 && idx < q.options.length) {
            e.preventDefault();
            selectOptionRef.current(q.options[idx]);
            return;
          }
        }
        // Space flips when not picking options
        if (e.code === 'Space') {
          e.preventDefault();
          setIsFlipped(true);
        }
        return;
      }

      // Post-flip: 1-3 rate quality
      if (isFlippedRef.current) {
        const map: Record<string, AnswerQuality> = { '1': 0, '2': 3, '3': 5 };
        const quality = map[e.key];
        if (quality !== undefined) submitAnswerRef.current(quality);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showOptions]);

  return {
    session,
    currentQuestion,
    isFlipped,
    isComplete,
    isEmpty,
    selectedOption,
    progress: { answered },
    startSession,
    flipCard,
    selectOption,
    submitAnswer,
    endSession,
  };
}
