import { useMutation } from '@tanstack/react-query';
import { type FlagReason } from '../types/api';
import { reportQuestion } from '../local/flags';

interface ReportInput {
  questionId: string;
  reason: FlagReason;
  detail?: string;
}

export function useReportQuestion() {
  return useMutation({
    mutationFn: ({ questionId, reason, detail }: ReportInput) =>
      reportQuestion(questionId, reason, detail),
  });
}
