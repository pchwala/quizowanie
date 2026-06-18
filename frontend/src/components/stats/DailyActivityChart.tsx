import { useState } from 'react';
import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { useDailyActivity } from '../../hooks/useDailyActivity';
import { type DailyActivity, type Timeline } from '../../types/api';

// Same new=red / review=amber semantics as the new/review rows on NaukaPage.
const LEARNED_COLOR = '#e06c75';
const REVIEWED_COLOR = '#e5c07b';

// Keep the bar count low enough that a 2-digit number always fits inside each
// bar; denser ranges are aggregated into this many buckets instead.
const MAX_BARS = 7;

const TIMELINES: { value: Timeline; label: string }[] = [
  { value: 'week', label: 'Tydzień' },
  { value: 'month', label: 'Miesiąc' },
  { value: '3months', label: '3 miesiące' },
  { value: 'year', label: 'Rok' },
  { value: 'all', label: 'Cały czas' },
];

interface Bucket {
  label: string;
  learned: number;
  reviewed: number;
}

// dd.mm of a YYYY-MM-DD day.
function dayLabel(day: string): string {
  const [, m, d] = day.split('-');
  return `${d}.${m}`;
}

// Collapse the per-day rows into at most MAX_BARS equally-spaced buckets, summing
// learned/reviewed within each. Each bucket is labelled by its first day. Summing
// is safe: a question's first-ever answer falls on exactly one day, so `learned`
// never double-counts across days.
function bucketize(rows: DailyActivity[]): Bucket[] {
  const size = Math.max(1, Math.ceil(rows.length / MAX_BARS));
  const buckets: Bucket[] = [];
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    buckets.push({
      label: dayLabel(chunk[0].day),
      learned: chunk.reduce((s, r) => s + r.learned, 0),
      reviewed: chunk.reduce((s, r) => s + r.reviewed, 0),
    });
  }
  return buckets;
}

export default function DailyActivityChart() {
  const [timeline, setTimeline] = useState<Timeline>('week');
  const { data: activity = [] } = useDailyActivity(timeline);

  const hasData = activity.some((a) => a.learned > 0 || a.reviewed > 0);
  const buckets = bucketize(activity);

  return (
    <Box>
      <ToggleButtonGroup
        value={timeline}
        exclusive
        size="small"
        onChange={(_, v: Timeline | null) => v && setTimeline(v)}
        sx={{ mb: 1.5, flexWrap: 'wrap' }}
      >
        {TIMELINES.map((t) => (
          <ToggleButton key={t.value} value={t.value} sx={{ textTransform: 'none', py: 0.25 }}>
            {t.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {hasData ? (
        <BarChart
          xAxis={[{ scaleType: 'band', data: buckets.map((b) => b.label) }]}
          series={[
            {
              data: buckets.map((b) => b.learned),
              label: 'Poznane',
              stack: 'activity',
              color: LEARNED_COLOR,
              barLabel: (item) => (item.value ? `${item.value}` : ''),
            },
            {
              data: buckets.map((b) => b.reviewed),
              label: 'Powtórzone',
              stack: 'activity',
              color: REVIEWED_COLOR,
              barLabel: (item) => (item.value ? `${item.value}` : ''),
            },
          ]}
          height={280}
        />
      ) : (
        <Typography color="text.secondary">
          Brak danych — odpowiedz na więcej pytań.
        </Typography>
      )}
    </Box>
  );
}
