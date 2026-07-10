import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Paper,
  useTheme,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { ArrowLeft, Plus, Trash2, Save, ClipboardCopy, FlaskConical, Droplets } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDayExpenses, saveDayExpenses } from '../api/expenseApi';
import { getToday, formatDateLabel } from '../utils/dateUtils';
import Toast from '../components/Toast';
import { vibrate, haptics } from '../theme/tokens';
import type { ExpenseItem } from '../types';

interface LocalExpense {
  localId: number;
  description: string;
  amount: string;
}

const PRESETS = [
  { label: 'Oil', description: 'Oil', amount: 130, icon: FlaskConical },
  { label: 'Water', description: 'Water', amount: 40, icon: Droplets },
];

function toDDMMYYYY(dateStr: string): string {
  return dateStr.split('-').reverse().join('-');
}

function copyToClipboard(text: string): Promise<boolean> {
  return (async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall through
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  })();
}

export default function AdminExpensesPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get('date') || getToday();
  const qc = useQueryClient();

  const [expenses, setExpenses] = useState<LocalExpense[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [clipboardFallback, setClipboardFallback] = useState<string | null>(null);
  const idCounter = useRef(0);

  const { data: existingData, isLoading } = useQuery({
    queryKey: ['dayExpenses', date],
    queryFn: () => getDayExpenses(date),
    enabled: !!date,
  });

  useEffect(() => {
    if (existingData?.items) {
      idCounter.current = 0;
      setExpenses(
        existingData.items.map((item: ExpenseItem) => ({
          localId: idCounter.current++,
          description: item.description,
          amount: String(item.amount),
        })),
      );
    } else if (!isLoading) {
      setExpenses([]);
    }
  }, [existingData, isLoading, date]);

  const total = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  const handleDateChange = useCallback(
    (newDate: string) => {
      setSearchParams({ date: newDate });
    },
    [setSearchParams],
  );

  const addExpense = useCallback((description = '', amount = '') => {
    vibrate(haptics.light);
    setExpenses((prev) => [...prev, { localId: idCounter.current++, description, amount }]);
  }, []);

  const updateExpense = useCallback(
    (localId: number, field: 'description' | 'amount', value: string) => {
      setExpenses((prev) => prev.map((e) => (e.localId === localId ? { ...e, [field]: value } : e)));
    },
    [],
  );

  const deleteExpense = useCallback((localId: number) => {
    vibrate(haptics.light);
    setExpenses((prev) => prev.filter((e) => e.localId !== localId));
  }, []);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveDayExpenses({
        orderDate: date,
        items: expenses
          .filter((e) => e.description.trim() && parseFloat(e.amount) > 0)
          .map((e) => ({ description: e.description.trim(), amount: parseFloat(e.amount) })),
      }),
    onSuccess: () => {
      vibrate(haptics.success);
      setToast({ message: 'Expenses saved!', type: 'success' });
      qc.invalidateQueries({ queryKey: ['dayExpenses', date] });
    },
    onError: () => {
      vibrate(haptics.error);
      setToast({ message: 'Failed to save expenses', type: 'error' });
    },
  });

  const createCopyText = useCallback((): string => {
    const valid = expenses.filter((e) => e.description.trim() && parseFloat(e.amount) > 0);
    const lines = [`Expenses`, toDDMMYYYY(date)];
    valid.forEach((e, i) => {
      lines.push(`${i + 1}. ${e.description.trim()} \u20B9${parseFloat(e.amount)}`);
    });
    lines.push(`Total: \u20B9${total.toFixed(2)}`);
    return lines.join('\n');
  }, [expenses, date, total]);

  const handleCopy = useCallback(async () => {
    vibrate(haptics.light);
    const text = createCopyText();
    const copied = await copyToClipboard(text);
    if (copied) {
      vibrate(haptics.success);
      setToast({ message: 'Expenses copied to clipboard!', type: 'success' });
    } else {
      setClipboardFallback(text);
    }
  }, [createCopyText]);

  const handleSave = useCallback(() => {
    const valid = expenses.filter((e) => e.description.trim() && parseFloat(e.amount) > 0);
    if (valid.length === 0) {
      setToast({ message: 'Add at least one expense', type: 'error' });
      return;
    }
    saveMutation.mutate();
  }, [expenses, saveMutation]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'background.default',
        p: 1.5,
        pb: 8,
        pt: 1,
        overflowY: 'auto',
        '&::-webkit-scrollbar': { display: 'none' },
        scrollbarWidth: 'none',
      }}
    >
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Button
            size="small"
            startIcon={<ArrowLeft size={16} />}
            onClick={() => navigate('/admin')}
            sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary', minWidth: 0, px: 1 }}
          >
            Back
          </Button>
          <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', color: 'text.primary', letterSpacing: '-0.3px' }}>
            Expenses
          </Typography>
          <Box sx={{ ml: 'auto' }}>
            <TextField
              type="date"
              size="small"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 }, width: 150 }}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </Box>

        {/* Date label */}
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2 }}>
          {formatDateLabel(date)}
        </Typography>

        {/* Preset buttons */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {PRESETS.map((preset) => {
            const Icon = preset.icon;
            return (
              <Button
                key={preset.label}
                size="small"
                variant="outlined"
                startIcon={<Icon size={16} />}
                onClick={() => addExpense(preset.description, String(preset.amount))}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: 2,
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  background: isDark ? 'rgba(27,107,58,0.08)' : '#F0FDF4',
                  fontSize: { xs: '0.75rem', md: '0.85rem' },
                }}
              >
                {preset.label} ₹{preset.amount}
              </Button>
            );
          })}
        </Box>

        {/* Expense list */}
        {expenses.length === 0 && !isLoading ? (
          <Paper
            sx={{
              p: 3,
              textAlign: 'center',
              border: `2px dashed ${isDark ? 'rgba(255,255,255,0.12)' : theme.palette.divider}`,
              background: 'transparent',
              borderRadius: 2,
              mb: 2,
            }}
          >
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
              No expenses for this date. Use presets or add manually.
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
            {expenses.map((expense) => (
              <Paper
                key={expense.localId}
                sx={{
                  p: 1.25,
                  borderRadius: 2,
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 1,
                  alignItems: { xs: 'stretch', sm: 'center' },
                  background: isDark ? 'rgba(255,255,255,0.03)' : '#FAFAFA',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : theme.palette.divider}`,
                }}
              >
                <TextField
                  size="small"
                  placeholder="Expense detail"
                  value={expense.description}
                  onChange={(e) => updateExpense(expense.localId, 'description', e.target.value)}
                  fullWidth
                  sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                />
                <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                  <Box
                    component="input"
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={expense.amount}
                    onChange={(e) => updateExpense(expense.localId, 'amount', e.target.value)}
                    sx={{
                      width: 80,
                      textAlign: 'center',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : theme.palette.divider}`,
                      borderRadius: 1.5,
                      background: 'transparent',
                      color: 'inherit',
                      outline: 'none',
                      py: 0.75,
                      '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': { WebkitAppearance: 'none' },
                      '-moz-appearance': 'textfield',
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => deleteExpense(expense.localId)}
                    aria-label="Delete expense"
                    sx={{
                      color: 'error.main',
                      '&:focus-visible': { outline: '2px solid', outlineColor: 'error.main', outlineOffset: 2 },
                    }}
                  >
                    <Trash2 size={18} />
                  </IconButton>
                </Box>
              </Paper>
            ))}
          </Box>
        )}

        {/* Add Expense button */}
        <Button
          fullWidth
          variant="outlined"
          startIcon={<Plus size={18} />}
          onClick={() => addExpense()}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: 2,
            py: 1.25,
            mb: 2,
            borderStyle: 'dashed',
          }}
        >
          Add Expense
        </Button>

        {/* Total + actions */}
        <Paper
          sx={{
            p: 2,
            borderRadius: 2,
            position: 'sticky',
            bottom: 0,
            background: isDark ? theme.palette.background.paper : '#FFFFFF',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: 'text.primary' }}>
            Total:{' '}
            <Box component="span" sx={{ color: 'primary.main' }}>
              ₹{total.toFixed(2)}
            </Box>
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ClipboardCopy size={16} />}
              onClick={handleCopy}
              disabled={expenses.length === 0}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
            >
              Copy
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<Save size={16} />}
              onClick={handleSave}
              disabled={saveMutation.isPending || expenses.length === 0}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
            >
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </Box>
        </Paper>
      </Box>

      {/* Clipboard fallback dialog */}
      {clipboardFallback && (
        <Dialog open onClose={() => setClipboardFallback(null)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Copy Expenses</DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1.5 }}>
              Clipboard copy failed. Select the text below and copy manually.
            </Typography>
            <TextField
              multiline
              fullWidth
              rows={8}
              value={clipboardFallback}
              variant="outlined"
              inputProps={{ readOnly: true, sx: { fontSize: '0.85rem', fontFamily: 'monospace' } }}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={async () => {
                const ok = await copyToClipboard(clipboardFallback);
                if (ok) {
                  vibrate(haptics.success);
                  setToast({ message: 'Expenses copied to clipboard!', type: 'success' });
                  setClipboardFallback(null);
                } else {
                  setToast({ message: 'Copy failed \u2014 select text manually', type: 'error' });
                }
              }}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Retry Copy
            </Button>
            <Button onClick={() => setClipboardFallback(null)} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Box>
  );
}
