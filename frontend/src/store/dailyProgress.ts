import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Local-calendar YYYY-MM-DD (not UTC) so the rollover matches the user's day.
function todayKey(): string {
  return new Date().toLocaleDateString('sv-SE'); // 'YYYY-MM-DD'
}

interface DailyProgressState {
  date: string;
  newCount: number;
  recordNew: () => void;
}

export const useDailyProgressStore = create<DailyProgressState>()(
  persist(
    (set, get) => ({
      date: todayKey(),
      newCount: 0,
      recordNew: () => {
        const today = todayKey();
        // Roll the day over on first answer of a new day.
        if (get().date !== today) set({ date: today, newCount: 1 });
        else set({ newCount: get().newCount + 1 });
      },
    }),
    { name: 'quizowanie-daily-progress' },
  ),
);

// Selector hook: returns 0 if the stored count is from a previous day.
export function useNewLearnedToday(): number {
  return useDailyProgressStore((s) => (s.date === todayKey() ? s.newCount : 0));
}
