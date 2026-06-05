import { useState } from 'react';
import { Avatar, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

export default function UserAvatarMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const initials = user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <>
      <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>{initials}</Avatar>
      </IconButton>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        <MenuItem disabled>
          <Typography variant="body2">{user?.email}</Typography>
        </MenuItem>
        <MenuItem onClick={() => { navigate('/settings'); setAnchorEl(null); }}>
          Ustawienia
        </MenuItem>
        <MenuItem onClick={() => signOut(auth)}>Wyloguj</MenuItem>
      </Menu>
    </>
  );
}
