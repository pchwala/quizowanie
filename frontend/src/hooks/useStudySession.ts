import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type StudySession, type StudyMode, type QuestionDetail, type AnswerQuality } from '../types/api';
import * as studyApi from '../api/study';
import { getQuestion } from '../api/questions';

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

  const fetchNext = async (sessionId: string): Promise<boolean> => {
    const brief = await studyApi.getNextQuestion(sessionId);
    if (brief === null) {
      setCurrentQuestion(null);
      setIsFlipped(false);
      setSelectedOption(null);
      return false;
    }
    const detail = await getQuestion(brief.id);
    // Batched: back face clears (isFlipped=false stops rendering answer),
    // front face loads new question — no flash of new answer during flip animation.
    setCurrentQuestion(detail);
    setIsFlipped(false);
    setSelectedOption(null);
    return true;
  };

  const startSession = async (categoryIds?: string[], mode: StudyMode = 'mixed') => {
    const s = await studyApi.startSession(categoryIds, mode);
    setIsComplete(false);
    setIsEmpty(false);
    setAnswered(0);
    if (await fetchNext(s.id)) {
      setSession(s);
    } else {
      // Nothing to study for this mode — discard the just-created session
      await studyApi.endSession(s.id).catch(() => {});
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
    await studyApi.submitAnswer(s.id, currentQuestion.id, quality);
    if (!(await fetchNext(s.id))) {
      setIsComplete(true);
    }
  };

  const submitAnswerRef = useRef(submitAnswer);
  submitAnswerRef.current = submitAnswer;

  const selectOptionRef = useRef(selectOption);
  selectOptionRef.current = selectOption;

  const endSession = async () => {
    if (sessionRef.current) {
      await studyApi.endSession(sessionRef.current.id).catch(() => {});
    }
    setSession(null);
    setCurrentQuestion(null);
    setIsFlipped(false);
    setSelectedOption(null);
    setIsComplete(false);
    setIsEmpty(false);
    setAnswered(0);
    queryClient.invalidateQueries({ queryKey: ['userStats'] });
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

      // Post-flip: 1-4 rate quality
      if (isFlippedRef.current) {
        const map: Record<string, AnswerQuality> = { '1': 0, '2': 3, '3': 4, '4': 5 };
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
