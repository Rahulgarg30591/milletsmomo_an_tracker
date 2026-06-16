import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography, TextField } from '@mui/material';
import { getToday, getYesterday, formatDateLabel, isToday, isYesterday } from '../utils/dateUtils';

export default function DateSelectPage() {
  const [selectedDate, setSelectedDate] = useState(getToday());
  const navigate = useNavigate();

  const handleGo = () => {
    navigate(`/day/${selectedDate}`);
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#F0F4F1', p: 2 }}>
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>
        <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', mb: 3, color: '#111827', letterSpacing: '-0.3px' }}>
          Select Date
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            fullWidth
            variant={isToday(selectedDate) ? 'contained' : 'outlined'}
            onClick={() => setSelectedDate(getToday())}
            sx={{
              borderRadius: 3,
              py: 1,
              fontWeight: 600,
              textTransform: 'none',
              backgroundColor: isToday(selectedDate) ? '#1B6B3A' : 'transparent',
              borderColor: '#E5E7EB',
              color: isToday(selectedDate) ? '#FFFFFF' : '#374151',
            }}
          >
            Today
          </Button>
          <Button
            fullWidth
            variant={isYesterday(selectedDate) ? 'contained' : 'outlined'}
            onClick={() => setSelectedDate(getYesterday())}
            sx={{
              borderRadius: 3,
              py: 1,
              fontWeight: 600,
              textTransform: 'none',
              backgroundColor: isYesterday(selectedDate) ? '#1B6B3A' : 'transparent',
              borderColor: '#E5E7EB',
              color: isYesterday(selectedDate) ? '#FFFFFF' : '#374151',
            }}
          >
            Yesterday
          </Button>
        </Box>

        <TextField
          type="date"
          fullWidth
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          sx={{
            mb: 3,
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
              backgroundColor: '#FFFFFF',
            },
          }}
        />

        <Button
          fullWidth
          variant="contained"
          onClick={handleGo}
          sx={{
            borderRadius: 3,
            py: 1.5,
            fontWeight: 700,
            fontSize: '1rem',
            textTransform: 'none',
            backgroundColor: '#1B6B3A',
            '&:hover': { backgroundColor: '#124D29' },
          }}
        >
          Go to {formatDateLabel(selectedDate)}
        </Button>
      </Box>
    </Box>
  );
}
