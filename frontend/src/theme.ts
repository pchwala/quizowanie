import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0e0e0e',
      paper: '#1c1c1e',
    },
    primary: {
      main: '#4f6ef7',
    },
    text: {
      primary: '#ffffff',
      secondary: '#8e8e93',
    },
    divider: 'rgba(255,255,255,0.08)',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        'html, body': { height: '100%', margin: 0, padding: 0 },
        '#root': {
          height: '100%',
          maxWidth: 480,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
        },
      },
    },
  },
});

export default theme;
