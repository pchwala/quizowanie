import { Box, Typography, Button } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';

interface Props {
  answered: number;
  onReset: () => void;
}

export default function SessionComplete({ answered, onReset }: Props) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, pt: 6 }}>
      <CheckCircleOutlineIcon sx={{ fontSize: 80, color: 'success.main' }} />
      <Typography variant="h5">Sesja zakończona!</Typography>
      <Typography color="text.secondary">
        Odpowiedziałeś na {answered} {answered === 1 ? 'pytanie' : 'pytań'}.
      </Typography>
      <Button variant="contained" onClick={onReset}>
        Nowa sesja
      </Button>
    </Box>
  );
}
