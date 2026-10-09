import { useEffect, useState } from 'react';
import { Box, Button, Paper, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, CheckCircle2 } from 'lucide-react';
import { getClosingCash, saveClosingCash } from '../api/closingStockApi';
import { vibrate, haptics } from '../theme/tokens';

interface ClosingCashCardProps {
  date: string;
  onSaved: () => void;
  onError: (message: string) => void;
}

/** Staff record the cash in hand at close. Only the amount is shown; admin sees the difference. */
export default function ClosingCashCard({ date, onSaved, onError }: ClosingCashCardProps) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['closingCash', date], queryFn: () => getClosingCash(date) });
  const [value, setValue] = useState('');
  const [seededFor, setSeededFor] = useState<string | null>(null);

  useEffect(() => {
    if (data && seededFor !== date) {
      setValue(data.amount === null ? '' : String(data.amount));
      setSeededFor(date);
    }
  }, [data, date, seededFor]);

  const amount = value.trim() === '' ? NaN : Number(value);
  const isValid = Number.isFinite(amount) && amount >= 0;

  const mutation = useMutation({
    mutationFn: () => saveClosingCash(date, Math.round(amount * 100) / 100),
    onSuccess: (saved) => {
      qc.setQueryData(['closingCash', date], saved);
      vibrate(haptics.success);
      onSaved();
    },
    onError: () => onError('Failed to save closing cash'),
  });

  return (
    <Paper data-testid="closing-cash-card" sx={{ mt: 2, p: 2, borderRadius: 2, border: 1, borderColor: data?.amount != null ? 'success.main' : 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Banknote size={18} />
        <Typography sx={{ fontWeight: 700 }}>Closing Cash</Typography>
        {data?.amount != null && (
          <Typography data-testid="closing-cash-saved" sx={{ ml: 'auto', fontSize: '0.75rem', color: 'success.main', fontWeight: 700 }}>
            Saved ₹{data.amount}
          </Typography>
        )}
      </Box>
      <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1.5 }}>
        Count the cash collected today and enter the total.
      </Typography>
      <TextField
        fullWidth
        size="small"
        label="Cash collected (₹)"
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        inputProps={{ inputMode: 'decimal', min: 0, step: '0.01' }}
      />
      <Button
        fullWidth
        variant="contained"
        disabled={!isValid || mutation.isPending}
        onClick={() => mutation.mutate()}
        startIcon={<CheckCircle2 size={18} />}
        sx={{ mt: 1.5, textTransform: 'none', fontWeight: 700, borderRadius: 2, py: 1.25 }}
      >
        {mutation.isPending ? 'Saving...' : data?.amount != null ? 'Update Closing Cash' : 'Save Closing Cash'}
      </Button>
    </Paper>
  );
}
