import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Alert, Box, Button } from '@mui/material';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3 }}>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => window.location.reload()}>
                Odśwież stronę
              </Button>
            }
          >
            Coś poszło nie tak. Spróbuj odświeżyć stronę.
          </Alert>
        </Box>
      );
    }
    return this.props.children;
  }
}
