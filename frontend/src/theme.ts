import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    // Customise here — primary.main, background.default, etc.
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
  },
});

export default theme;
