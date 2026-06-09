import { Box, ButtonBase, Typography } from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import ListIcon from '@mui/icons-material/List';
import SettingsIcon from '@mui/icons-material/Settings';
import { useLocation, useNavigate } from 'react-router-dom';

const TABS = [
  { label: 'Nauka', Icon: SchoolIcon, path: '/nauka' },
  { label: 'Pytania', Icon: ListIcon, path: '/pytania' },
  { label: 'Menu', Icon: SettingsIcon, path: '/menu' },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        flexShrink: 0,
        height: 64,
        bgcolor: '#1c1c1e',
        borderTop: '1px solid',
        borderColor: 'divider',
        display: 'flex',
      }}
    >
      {TABS.map(({ label, Icon, path }) => {
        const active = pathname === path;
        return (
          <ButtonBase
            key={path}
            onClick={() => navigate(path)}
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              color: active ? 'primary.main' : 'text.secondary',
            }}
          >
            <Icon sx={{ fontSize: 22 }} />
            <Typography sx={{ fontSize: '0.68rem', lineHeight: 1 }}>{label}</Typography>
          </ButtonBase>
        );
      })}
    </Box>
  );
}
