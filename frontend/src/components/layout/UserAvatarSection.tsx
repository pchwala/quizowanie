import { Box, Avatar, Typography } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

export default function UserAvatarSection() {
  const { user } = useAuth();
  const initials = user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main' }}>{initials}</Avatar>
      <Typography variant="body2" noWrap>
        {user?.email}
      </Typography>
    </Box>
  );
}
