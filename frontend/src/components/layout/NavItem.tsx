import { ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { type ReactNode } from 'react';

interface Props {
  label: string;
  to: string;
  icon: ReactNode;
  onClick?: () => void;
}

export default function NavItem({ label, to, icon, onClick }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname.startsWith(to);

  return (
    <ListItem disablePadding>
      <ListItemButton
        selected={isActive}
        onClick={() => { navigate(to); onClick?.(); }}
      >
        <ListItemIcon>{icon}</ListItemIcon>
        <ListItemText primary={label} />
      </ListItemButton>
    </ListItem>
  );
}
