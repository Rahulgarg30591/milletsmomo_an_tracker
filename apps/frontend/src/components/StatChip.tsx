import { Box, Typography } from '@mui/material';

interface StatChipProps {
  label: string;
  value: string | number;
  color?: string;
}

export default function StatChip({ label, value, color = '#1B6B3A' }: StatChipProps) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 3,
        backgroundColor: '#FFFFFF',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        textAlign: 'center',
        flex: 1,
      }}
    >
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#6B7280', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: color, letterSpacing: '-0.2px' }}>
        {value}
      </Typography>
    </Box>
  );
}
