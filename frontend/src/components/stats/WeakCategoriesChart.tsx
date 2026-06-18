import { Typography } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { type WeakCategory } from '../../types/api';

interface Props {
  categories: WeakCategory[];
}

export default function WeakCategoriesChart({ categories }: Props) {
  if (categories.length === 0) {
    return (
      <Typography color="text.secondary">
        Brak danych — odpowiedz na więcej pytań.
      </Typography>
    );
  }

  return (
    <BarChart
      xAxis={[{ scaleType: 'band', data: categories.map((c) => c.category_name) }]}
      series={[
        {
          data: categories.map((c) => c.avg_quality),
          label: 'Średnia jakość',
          barLabel: (item) => `${item.value ?? 0}`,
        },
      ]}
      yAxis={[{ min: 0, max: 5 }]}
      height={280}
    />
  );
}
