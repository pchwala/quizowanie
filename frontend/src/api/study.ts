import client from './client';
import { StudySession, Question, AnswerQuality } from '../types/api';

export const startSession = (categoryIds?: string[]): Promise<StudySession> =>
  client.post('/study/sessions', { category_id: categoryIds?.[0] ?? null }).then((r) => r.data);

export const getNextQuestion = (sessionId: string): Promise<Question | null> =>
  client
    .get(`/study/sessions/${sessionId}/next`)
    .then((r) => r.data)
    .catch((err) => {
      if (err.response?.status === 404) return null;
      throw err;
    });

export const submitAnswer = (
  sessionId: string,
  questionId: string,
  quality: AnswerQuality,
): Promise<void> =>
  client
    .post(`/study/sessions/${sessionId}/answer`, { question_id: questionId, quality })
    .then((r) => r.data);

export const endSession = (sessionId: string): Promise<void> =>
  client.post(`/study/sessions/${sessionId}/end`).then((r) => r.data);
