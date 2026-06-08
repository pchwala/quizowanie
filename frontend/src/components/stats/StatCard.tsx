import { Card, CardContent, Typography, Box, type ReactNode } from '@mui/material';

interface Props {
  label: string;
  value: number | string;
  icon?: ReactNode;
}

export default function StatCard({ label, value, icon }: Props) {
  return (
    <Card sx={{ flex: '1 1 150px', minWidth: 140 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'text.secondary' }}>
          {icon}
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </Box>
        <Typography variant="h4" fontWeight="bold">
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}
