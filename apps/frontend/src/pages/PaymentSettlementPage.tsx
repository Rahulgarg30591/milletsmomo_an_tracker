import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Button, Typography, Paper, useTheme, TextField, Chip,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, CheckCircle2, Banknote, Smartphone, AlertTriangle, Calculator, Save,
} from 'lucide-react';
import { getPaymentSettlement, submitPaymentSettlement } from '../api/paymentSettlementApi';
import { getToday } from '../utils/dateUtils';
import { trackPageView } from '../utils/tracking';
import Toast from '../components/Toast';
import { vibrate, haptics } from '../theme/tokens';

export default function PaymentSettlementPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const { date } = useParams<{ date: string }>();
  const qc = useQueryClient();
  const targetDate = date || getToday();

  const [actualCash, setActualCash] = useState<string>('');
  const [actualUpi, setActualUpi] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { data: settlement, isLoading } = useQuery({
    queryKey: ['paymentSettlement', targetDate],
    queryFn: () => getPaymentSettlement(targetDate),
    enabled: !!targetDate,
  });

  useEffect(() => {
    trackPageView('payment_settlement', `Opened payment settlement for ${targetDate}`);
  }, [targetDate]);

  useEffect(() => {
    if (settlement?.settlement) {
      setActualCash(String(settlement.settlement.actualCash));
      setActualUpi(String(settlement.settlement.actualUpi));
      setNotes(settlement.settlement.notes || '');
    } else {
      setActualCash('');
      setActualUpi('');
      setNotes('');
    }
  }, [settlement]);

  const cashDiff = settlement ? parseFloat(actualCash || '0') - settlement.expectedCash : 0;
  const upiDiff = settlement ? parseFloat(actualUpi || '0') - settlement.expectedUpi : 0;
  const cashConflict = Math.abs(cashDiff) > 0.01;
  const upiConflict = Math.abs(upiDiff) > 0.01;

  const submitMutation = useMutation({
    mutationFn: () => {
      return submitPaymentSettlement({
        orderDate: targetDate,
        actualCash: parseFloat(actualCash || '0'),
        actualUpi: parseFloat(actualUpi || '0'),
        notes: notes || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paymentSettlement', targetDate] });
      setToast({ message: 'Settlement saved!', type: 'success' });
      vibrate(haptics.success);
    },
    onError: () => {
      setToast({ message: 'Failed to save settlement', type: 'error' });
      vibrate(haptics.error);
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ minHeight: 'calc(100vh - 56px)', backgroundColor: 'background.default', p: { xs: 1, md: 2 }, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ color: 'text.secondary' }}>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: 'calc(100vh - 56px)', backgroundColor: 'background.default', p: { xs: 1, md: 2 }, pb: { xs: 8, md: 4 } }}>
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 1.5, md: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 1 } }}>
            <Button
              size="small"
              startIcon={<ArrowLeft size={16} />}
              onClick={() => navigate('/admin')}
              sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary', minWidth: 0, px: 1 }}
            >
              Back
            </Button>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: '1rem', md: '1.25rem' }, color: 'text.primary', letterSpacing: '-0.3px' }}>
              Payment Settlement
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
            <Calculator size={14} />
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{targetDate}</Typography>
          </Box>
        </Box>

        {/* Status */}
        {settlement?.isSettled && (
          <Paper sx={{
            borderRadius: 2,
            p: 1.5,
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            background: isDark ? 'rgba(45,138,78,0.08)' : '#F0FDF4',
            border: `1px solid ${isDark ? 'rgba(45,138,78,0.2)' : 'rgba(45,138,78,0.15)'}`,
          }}>
            <CheckCircle2 size={18} color="#16A34A" />
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'success.main' }}>
              Settlement recorded for this date
            </Typography>
          </Paper>
        )}

        {/* Expected Summary */}
        <Paper sx={{
          borderRadius: 2,
          overflow: 'hidden',
          border: 1,
          borderColor: 'divider',
          mb: 2,
        }}>
          <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Expected Amounts (from {settlement?.totalOrders || 0} orders)
            </Typography>
          </Box>
          <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* Cash Expected */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, borderRadius: 1.5, background: isDark ? 'rgba(27,107,58,0.06)' : '#F0FDF4', border: '1px solid', borderColor: isDark ? 'rgba(27,107,58,0.15)' : 'rgba(27,107,58,0.1)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Banknote size={20} color="#1B6B3A" />
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'text.primary' }}>
                    Cash Expected
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    Based on all cash & split orders
                  </Typography>
                </Box>
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: '#1B6B3A' }}>
                ₹{(settlement?.expectedCash || 0).toLocaleString()}
              </Typography>
            </Box>

            {/* UPI Expected */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, borderRadius: 1.5, background: isDark ? 'rgba(29,78,216,0.06)' : '#EFF6FF', border: '1px solid', borderColor: isDark ? 'rgba(29,78,216,0.15)' : 'rgba(29,78,216,0.1)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Smartphone size={20} color="#1D4ED8" />
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'text.primary' }}>
                    UPI Expected
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    Based on all UPI & split orders
                  </Typography>
                </Box>
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: '#1D4ED8' }}>
                ₹{(settlement?.expectedUpi || 0).toLocaleString()}
              </Typography>
            </Box>

            {/* Total Expected */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, borderRadius: 1.5, background: isDark ? 'rgba(124,58,237,0.06)' : '#F3E8FF', border: '1px solid', borderColor: isDark ? 'rgba(124,58,237,0.15)' : 'rgba(124,58,237,0.1)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Calculator size={20} color="#7C3AED" />
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'text.primary' }}>
                    Total Expected
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    Cash + UPI
                  </Typography>
                </Box>
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: '#7C3AED' }}>
                ₹{((settlement?.expectedCash || 0) + (settlement?.expectedUpi || 0)).toLocaleString()}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Actual Input */}
        <Paper sx={{
          borderRadius: 2,
          overflow: 'hidden',
          border: 1,
          borderColor: 'divider',
          mb: 2,
        }}>
          <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Actual Amounts Received
            </Typography>
          </Box>
          <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Cash Actual */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'text.primary', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Banknote size={16} />
                  Cash Received
                </Typography>
                {cashConflict && (
                  <Chip
                    size="small"
                    label="Conflict"
                    color="error"
                    sx={{ height: 20, fontSize: '0.6rem', fontWeight: 700 }}
                  />
                )}
              </Box>
              <Box
                component="input"
                type="number"
                value={actualCash}
                placeholder="0"
                onChange={(e) => setActualCash(e.target.value)}
                sx={{
                  width: '100%',
                  textAlign: 'center',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  py: 1,
                  px: 1,
                  border: `2px solid ${cashConflict ? '#DC2626' : theme.palette.divider}`,
                  borderRadius: 1.5,
                  background: 'transparent',
                  color: cashConflict ? '#DC2626' : 'inherit',
                  outline: 'none',
                  '&:focus': {
                    borderColor: cashConflict ? '#DC2626' : theme.palette.primary.main,
                  },
                  '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': { WebkitAppearance: 'none' },
                  '-moz-appearance': 'textfield',
                }}
              />
              {cashConflict && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
                  <AlertTriangle size={12} color="#DC2626" />
                  <Typography sx={{ fontSize: '0.75rem', color: 'error.main', fontWeight: 600 }}>
                    Difference: ₹{cashDiff.toLocaleString()} (expected ₹{settlement?.expectedCash || 0})
                  </Typography>
                </Box>
              )}
            </Box>

            {/* UPI Actual */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'text.primary', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Smartphone size={16} />
                  UPI Received
                </Typography>
                {upiConflict && (
                  <Chip
                    size="small"
                    label="Conflict"
                    color="error"
                    sx={{ height: 20, fontSize: '0.6rem', fontWeight: 700 }}
                  />
                )}
              </Box>
              <Box
                component="input"
                type="number"
                value={actualUpi}
                placeholder="0"
                onChange={(e) => setActualUpi(e.target.value)}
                sx={{
                  width: '100%',
                  textAlign: 'center',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  py: 1,
                  px: 1,
                  border: `2px solid ${upiConflict ? '#DC2626' : theme.palette.divider}`,
                  borderRadius: 1.5,
                  background: 'transparent',
                  color: upiConflict ? '#DC2626' : 'inherit',
                  outline: 'none',
                  '&:focus': {
                    borderColor: upiConflict ? '#DC2626' : theme.palette.primary.main,
                  },
                  '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': { WebkitAppearance: 'none' },
                  '-moz-appearance': 'textfield',
                }}
              />
              {upiConflict && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
                  <AlertTriangle size={12} color="#DC2626" />
                  <Typography sx={{ fontSize: '0.75rem', color: 'error.main', fontWeight: 600 }}>
                    Difference: ₹{upiDiff.toLocaleString()} (expected ₹{settlement?.expectedUpi || 0})
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Notes */}
            <TextField
              fullWidth
              label="Notes / Reason for difference"
              multiline
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />

            {/* Summary */}
            <Box sx={{
              p: 1.5,
              borderRadius: 1.5,
              background: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
              border: '1px solid',
              borderColor: 'divider',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 600 }}>
                  Total Actual
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: 'text.primary' }}>
                  ₹{(parseFloat(actualCash || '0') + parseFloat(actualUpi || '0')).toLocaleString()}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 600 }}>
                  Total Expected
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: 'text.primary' }}>
                  ₹{((settlement?.expectedCash || 0) + (settlement?.expectedUpi || 0)).toLocaleString()}
                </Typography>
              </Box>
              {(cashConflict || upiConflict) && (
                <Box sx={{ mt: 0.75, pt: 0.75, borderTop: 1, borderColor: 'divider' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'error.main', fontWeight: 700, textAlign: 'center' }}>
                    Overall difference: ₹{(cashDiff + upiDiff).toLocaleString()}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Paper>

        <Button
          fullWidth
          variant="contained"
          size="large"
          disabled={submitMutation.isPending}
          onClick={() => submitMutation.mutate()}
          startIcon={<Save size={18} />}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: 2,
            py: 1.5,
            fontSize: '0.95rem',
          }}
        >
          {submitMutation.isPending ? 'Saving...' : settlement?.isSettled ? 'Update Settlement' : 'Save Settlement'}
        </Button>
      </Box>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Box>
  );
}
