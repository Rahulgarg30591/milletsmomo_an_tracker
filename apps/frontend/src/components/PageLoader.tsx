import { Box, Typography, CircularProgress } from '@mui/material';

export default function PageLoader() {
  return (
    <Box sx={{
      minHeight: 'calc(100vh - 56px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'background.default',
      gap: 2,
    }}>
      <CircularProgress size={36} thickness={4} sx={{ color: 'primary.main' }} />
      <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', fontWeight: 600 }}>
        Loading...
      </Typography>
    </Box>
  );
}