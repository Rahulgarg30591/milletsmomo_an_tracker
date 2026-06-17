import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography, TextField, Paper, Chip } from '@mui/material';
import { motion } from 'framer-motion';
import { Calendar, ArrowRight, Clock } from 'lucide-react';
import { getToday, getYesterday, formatDateLabel, isToday, isYesterday } from '../utils/dateUtils';
import StaggerContainer, { StaggerItem } from '../components/animations/StaggerContainer';
import { vibrate, haptics } from '../theme/tokens';

export default function DateSelectPage() {
  const [selectedDate, setSelectedDate] = useState(getToday());
  const navigate = useNavigate();

  const handleGo = () => {
    vibrate(haptics.medium);
    navigate(`/day/${selectedDate}`);
  };

  const recentDays = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  });

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', p: 2, pb: 10, pt: 1 }}>
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>
        <Typography
          sx={{ fontWeight: 800, fontSize: '1.25rem', mb: 1, color: 'text.primary', letterSpacing: '-0.3px' }}
        >
          Select Date
        </Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem', mb: 4 }}>
          Choose the business day to view orders
        </Typography>

        {/* Quick select buttons */}
        <StaggerContainer sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
          <StaggerItem>
            <Paper
              onClick={() => {
                vibrate(haptics.light);
                setSelectedDate(getToday());
              }}
              sx={{
                p: 2,
                borderRadius: 4,
                cursor: 'pointer',
                border: isToday(selectedDate) ? 2 : 1,
                borderColor: isToday(selectedDate) ? 'primary.main' : 'divider',
                background: isToday(selectedDate) ? 'primary.light' : 'background.paper',
                transition: 'all 0.2s ease',
                '&:hover': { borderColor: 'primary.main' },
                minWidth: 140,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Clock size={16} color={isToday(selectedDate) ? '#FFFFFF' : 'currentColor'} style={{ opacity: 0.7 }} />
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: isToday(selectedDate) ? 'primary.contrastText' : 'text.primary' }}>
                  Today
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.8rem', color: isToday(selectedDate) ? 'rgba(255,255,255,0.8)' : 'text.secondary' }}>
                {formatDateLabel(getToday())}
              </Typography>
            </Paper>
          </StaggerItem>

          <StaggerItem>
            <Paper
              onClick={() => {
                vibrate(haptics.light);
                setSelectedDate(getYesterday());
              }}
              sx={{
                p: 2,
                borderRadius: 4,
                cursor: 'pointer',
                border: isYesterday(selectedDate) ? 2 : 1,
                borderColor: isYesterday(selectedDate) ? 'primary.main' : 'divider',
                background: isYesterday(selectedDate) ? 'primary.light' : 'background.paper',
                transition: 'all 0.2s ease',
                '&:hover': { borderColor: 'primary.main' },
                minWidth: 140,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Calendar size={16} color={isYesterday(selectedDate) ? '#FFFFFF' : 'currentColor'} style={{ opacity: 0.7 }} />
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: isYesterday(selectedDate) ? 'primary.contrastText' : 'text.primary' }}>
                  Yesterday
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.8rem', color: isYesterday(selectedDate) ? 'rgba(255,255,255,0.8)' : 'text.secondary' }}>
                {formatDateLabel(getYesterday())}
              </Typography>
            </Paper>
          </StaggerItem>
        </StaggerContainer>

        {/* Recent days chips */}
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: 'text.secondary', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recent
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {recentDays.map((d) => (
              <Chip
                key={d}
                label={formatDateLabel(d)}
                onClick={() => {
                  vibrate(haptics.light);
                  setSelectedDate(d);
                }}
                variant={selectedDate === d ? 'filled' : 'outlined'}
                color={selectedDate === d ? 'primary' : 'default'}
                sx={{ fontWeight: 600, borderRadius: 2 }}
              />
            ))}
          </Box>
        </Box>

        {/* Date input */}
        <TextField
          type="date"
          fullWidth
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          sx={{
            mb: 3,
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
              backgroundColor: 'background.paper',
            },
          }}
          InputLabelProps={{ shrink: true }}
        />

        <motion.div whileTap={{ scale: 0.98 }}>
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleGo}
            endIcon={<ArrowRight size={18} />}
            sx={{
              borderRadius: 3,
              py: 1.5,
              fontWeight: 700,
              fontSize: '1rem',
              textTransform: 'none',
            }}
          >
            Go to {formatDateLabel(selectedDate)}
          </Button>
        </motion.div>
      </Box>
    </Box>
  );
}