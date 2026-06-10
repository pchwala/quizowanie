import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Divider,
  ButtonBase,
  TextField,
  InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import QuizIcon from '@mui/icons-material/Quiz';
import TvIcon from '@mui/icons-material/Tv';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useNavigate } from 'react-router-dom';
import type { QuestionSource } from '../types/api';
import { SOURCE_LABELS } from '../types/api';

interface SourceConfig {
  key: QuestionSource;
  Icon: React.ElementType;
  color: string;
}

const SOURCES: SourceConfig[] = [
  { key: 'opentdb',            Icon: QuizIcon,         color: '#4f6ef7' },
  { key: '1z10_archive',       Icon: TvIcon,           color: '#e5c07b' },
  { key: 'milionerzy_archive', Icon: EmojiEventsIcon,  color: '#56b6c2' },
];

export default function PytaniaPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filtered = SOURCES.filter(({ key }) =>
    SOURCE_LABELS[key].toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Box sx={{ px: 2, pt: 3, pb: 2 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 2.5 }}>
        Baza pytań
      </Typography>

      <TextField
        fullWidth
        placeholder="Szukaj…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        sx={{
          mb: 3,
          '& .MuiOutlinedInput-root': { borderRadius: 3 },
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
              </InputAdornment>
            ),
          },
        }}
      />

      <Paper>
        {filtered.map(({ key, Icon, color }, i) => (
          <Box key={key}>
            {i > 0 && <Divider />}
            <ButtonBase
              sx={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                px: 2,
                py: 1.5,
                gap: 2,
                textAlign: 'left',
              }}
              onClick={() => navigate(`/browse/${key}`)}
            >
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2,
                  bgcolor: `${color}22`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon sx={{ color, fontSize: 22 }} />
              </Box>
              <Typography sx={{ flex: 1, fontWeight: 500 }}>
                {SOURCE_LABELS[key]}
              </Typography>
              <ChevronRightIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
            </ButtonBase>
          </Box>
        ))}
      </Paper>
    </Box>
  );
}
