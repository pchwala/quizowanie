import { Box, Drawer, List, Divider } from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import NavItem from './NavItem';
import UserAvatarSection from './UserAvatarSection';

const DRAWER_WIDTH = 240;
const APPBAR_HEIGHT = 64;

const NAV_ITEMS = [
  { label: 'Nauka', to: '/study', icon: <SchoolIcon /> },
  { label: 'Pytania', to: '/browse', icon: <LibraryBooksIcon /> },
  { label: 'Statystyki', to: '/stats', icon: <BarChartIcon /> },
  { label: 'Ustawienia', to: '/settings', icon: <SettingsIcon /> },
];

interface Props {
  mobileOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
}

function DrawerContent({ isMobile, onClose }: { isMobile: boolean; onClose: () => void }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', mt: `${APPBAR_HEIGHT}px` }}>
      <List sx={{ flexGrow: 1 }}>
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} onClick={isMobile ? onClose : undefined} />
        ))}
      </List>
      {!isMobile && (
        <>
          <Divider />
          <UserAvatarSection />
        </>
      )}
    </Box>
  );
}

export default function Sidebar({ mobileOpen, onClose, isMobile }: Props) {
  const paperSx = { width: DRAWER_WIDTH, boxSizing: 'border-box' as const };

  return (
    <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={onClose}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': paperSx }}
        >
          <DrawerContent isMobile={isMobile} onClose={onClose} />
        </Drawer>
      ) : (
        <Drawer variant="permanent" sx={{ '& .MuiDrawer-paper': paperSx }} open>
          <DrawerContent isMobile={isMobile} onClose={onClose} />
        </Drawer>
      )}
    </Box>
  );
}
