import { Box, IconButton, TextField } from '@mui/material';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { getToday } from '../utils/dateUtils';

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** The `?month=YYYY-MM` a month view shows, defaulting to this month. */
export function useMonthParam(): [string, (month: string) => void, string] {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentMonth = getToday().slice(0, 7);
  const raw = searchParams.get('month') || '';
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : currentMonth;
  return [month, (m: string) => setSearchParams({ month: m }), currentMonth];
}

interface MonthPickerProps {
  month: string;
  currentMonth: string;
  onChange: (month: string) => void;
}

/** Previous/next arrows around a month input; the future is out of reach. */
export default function MonthPicker({ month, currentMonth, onChange }: MonthPickerProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      <IconButton aria-label="Previous month" onClick={() => onChange(shiftMonth(month, -1))}>
        <ChevronLeft size={20} />
      </IconButton>
      <TextField
        type="month"
        size="small"
        value={month}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        inputProps={{ 'aria-label': 'Month', max: currentMonth }}
        sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
      />
      <IconButton
        aria-label="Next month"
        disabled={month >= currentMonth}
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <ChevronRight size={20} />
      </IconButton>
    </Box>
  );
}
