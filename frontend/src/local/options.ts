import { type QuestionType } from '../types/api';

/**
 * Port of `_build_options` (backend/app/routers/questions.py): shuffled
 * choices for multiple/boolean, null for open questions — never marks which
 * option is correct.
 */
export function buildOptions(
  type: QuestionType,
  payload: Record<string, unknown>,
): string[] | null {
  if (type === 'multiple') {
    const options = [payload.correct as string, ...(payload.incorrect as string[])];
    // Fisher–Yates
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return options;
  }
  if (type === 'boolean') return ['Prawda', 'Fałsz'];
  return null;
}
