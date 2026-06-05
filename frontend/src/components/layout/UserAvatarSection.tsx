import { useState } from 'react';
import { Box, Avatar, Typography, Menu, MenuItem, ButtonBase } from '@mui/material';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  onNavigate?: () => void;
}

export default function UserAvatarSection({ onNavigate }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const initials = user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left' }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main' }}>{initials}</Avatar>
          <Typography variant="body2" noWrap>
            {user?.email}
          </Typography>
        </Box>
      </ButtonBase>
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <MenuItem
          onClick={() => {
            navigate('/settings');
            setAnchorEl(null);
            onNavigate?.();
          }}
        >
          Ustawienia
        </MenuItem>
        <MenuItem onClick={() => signOut(auth)}>Wyloguj</MenuItem>
      </Menu>
    </>
  );
}
