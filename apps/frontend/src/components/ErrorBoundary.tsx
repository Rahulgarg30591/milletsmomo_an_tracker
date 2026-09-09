import { keyframes } from '@emotion/react';
import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Box, Typography, Button } from '@mui/material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

// CSS rather than framer-motion: ErrorBoundary wraps the whole app, so a
// static framer-motion import put ~126 kB on the critical path of every page
// load to animate a screen that virtually never renders.
const popIn = keyframes`
  from { opacity: 0; transform: scale(0.9); }
  to   { opacity: 1; transform: scale(1); }
`;

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
            background: (theme) => theme.palette.background.default,
          }}
        >
          <Box sx={{ animation: `${popIn} 260ms ease-out both` }}>
            <Box
              sx={{
                textAlign: 'center',
                maxWidth: 400,
                p: 4,
                borderRadius: 4,
                background: (theme) => theme.palette.background.paper,
                boxShadow: (theme) => theme.shadows[4],
              }}
            >
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #FEE2E2, #FECACA)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <AlertTriangle size={32} color="#DC2626" />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                Something went wrong
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {this.state.error?.message || 'An unexpected error occurred.'}
              </Typography>
              <Button
                variant="contained"
                startIcon={<RefreshCw size={18} />}
                onClick={this.handleRetry}
                sx={{ borderRadius: 10 }}
              >
                Reload App
              </Button>
            </Box>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}