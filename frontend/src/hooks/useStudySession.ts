import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type StudySession, type QuestionDetail, type AnswerQuality } from '../types/api';
import * as studyApi from '../api/study';
import { getQuestion } from '../api/questions';

export function useStudySession() {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<StudySession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionDetail | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [answered, setAnswered] = useState(0);

  // Refs so the keyboard handler always sees current values without re-registering
  const sessionRef = useRef(session);
  const isFlippedRef = useRef(isFlipped);
  sessionRef.current = session;
  isFlippedRef.current = isFlipped;

  const fetchNext = async (sessionId: string) => {
    setIsFlipped(false);
    const brief = await studyApi.getNextQuestion(sessionId);
    if (brief === null) {
      setCurrentQuestion(null);
      setIsComplete(true);
      return;
    }
    const detail = await getQuestion(brief.id);
    setCurrentQuestion(detail);
  };

  const startSession = async (categoryIds?: string[]) => {
    const s = await studyApi.startSession(categoryIds);
    setSession(s);
    setIsComplete(false);
    setAnswered(0);
    await fetchNext(s.id);
  };

  const flipCard = useCallback(() => setIsFlipped(true), []);

  const submitAnswer = async (quality: AnswerQuality) => {
    const s = sessionRef.current;
    if (!s || !currentQuestion) return;
    setAnswered((n) => n + 1);
    await studyApi.submitAnswer(s.id, currentQuestion.id, quality);
    await fetchNext(s.id);
  };

  // Keep a ref to submitAnswer so the keyboard handler always calls the latest version
  const submitAnswerRef = useRef(submitAnswer);
  submitAnswerRef.current = submitAnswer;

  const endSession = async () => {
    if (sessionRef.current) {
      await studyApi.endSession(sessionRef.current.id).catch(() => {});
    }
    setSession(null);
    setCurrentQuestion(null);
    setIsFlipped(false);
    setIsComplete(false);
    setAnswered(0);
    queryClient.invalidateQueries({ queryKey: ['userStats'] });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!sessionRef.current) return;
      if (!isFlippedRef.current && e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(true);
        return;
      }
      if (isFlippedRef.current) {
        const map: Record<string, AnswerQuality> = { '1': 0, '2': 3, '3': 4, '4': 5 };
        const quality = map[e.key];
        if (quality !== undefined) submitAnswerRef.current(quality);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return {
    session,
    currentQuestion,
    isFlipped,
    isComplete,
    progress: { answered },
    startSession,
    flipCard,
    submitAnswer,
    endSession,
  };
}
