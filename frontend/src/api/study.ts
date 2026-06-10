import client from './client';
import { type StudySession, type StudyMode, type BrowseQuestion, type AnswerQuality } from '../types/api';

export const startSession = (categoryIds?: string[], mode: StudyMode = 'mixed'): Promise<StudySession> =>
  client
    .post('/study/sessions', { category_ids: categoryIds?.length ? categoryIds : null, mode })
    .then((r) => r.data);

export const getNextQuestion = (sessionId: string): Promise<BrowseQuestion | null> =>
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
