import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Button, Typography, Paper, useTheme, IconButton,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, CheckCircle2, AlertTriangle, Truck, Minus, Plus,
} from 'lucide-react';
import { getSupplyVerification, submitSupplyVerification } from '../api/supplyVerificationApi';
import { trackPageView, trackActionStart, trackActionEnd, trackVerificationSubmit, trackNavigation } from '../utils/tracking';
import Toast from '../components/Toast';
import { vibrate, haptics } from '../theme/tokens';
import type { SupplyVerification } from '../types';

export default function SupplyVerificationPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const { date } = useParams<{ date: string }>();
  const qc = useQueryClient();
  const targetDate = date || '';

  const [verificationItems, setVerificationItems] = useState<Record<number, number>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const actionIdRef = useRef<string | null>(null);

  useEffect(() => {
    trackPageView('supply_verification', `Opened supply verification for ${targetDate}`);
    actionIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    trackActionStart('supply_verification', 'verification_flow', { actionId: actionIdRef.current, date: targetDate });
    return () => {
      if (actionIdRef.current) {
        trackActionEnd('supply_verification', 'verification_flow', actionIdRef.current);
      }
    };
  }, [targetDate]);

  const { data: supplyVerification } = useQuery<SupplyVerification>({
    queryKey: ['supplyVerification', targetDate],
    queryFn: () => getSupplyVerification(targetDate),
    enabled: !!targetDate,
  });

  useEffect(() => {
    if (supplyVerification?.items) {
      const q: Record<number, number> = {};
      supplyVerification.items.forEach((item) => {
        q[item.supplyItemId] = item.actualQty ?? item.expectedQty;
      });
      setVerificationItems(q);
    }
  }, [supplyVerification]);

  const verifyMutation = useMutation({
    mutationFn: () => {
      if (!supplyVerification) return Promise.reject(new Error('No supply to verify'));
      const items = supplyVerification.items.map((item) => ({
        supplyItemId: item.supplyItemId,
        expectedQty: item.expectedQty,
        actualQty: verificationItems[item.supplyItemId] ?? item.expectedQty,
      }));
      return submitSupplyVerification({ orderDate: targetDate, items });
    },
    onSuccess: (result) => {
      trackVerificationSubmit(targetDate, { conflicts: result.conflictCount, items: result.items.length });
      if (actionIdRef.current) {
        trackActionEnd('supply_verification', 'verification_submit', actionIdRef.current, { conflicts: result.conflictCount });
      }
      qc.invalidateQueries({ queryKey: ['supplyVerification', targetDate] });
      qc.invalidateQueries({ queryKey: ['staffLogs', targetDate, 'verification'] });
      setToast({
        message: result.conflictCount > 0
          ? `Verification submitted. ${result.conflictCount} conflict(s) reported.`
          : 'Supply verified successfully!',
        type: result.conflictCount > 0 ? 'error' : 'success',
      });
      vibrate(haptics.success);
      trackNavigation('supply_verification', `day/${targetDate}`, { reason: 'verification_complete' });
      navigate(`/day/${targetDate}`);
    },
    onError: () => {
      setToast({ message: 'Failed to submit verification', type: 'error' });
      vibrate(haptics.error);
    },
  });

  const updateQty = (id: number, delta: number) => {
    vibrate(haptics.light);
    setVerificationItems((prev) => {
      const current = prev[id] ?? (supplyVerification?.items.find((i) => i.supplyItemId === id)?.expectedQty ?? 0);
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: next };
    });
  };

  const setQty = (id: number, val: string) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0) return;
    setVerificationItems((prev) => ({ ...prev, [id]: num }));
  };

  if (!supplyVerification || supplyVerification.items.length === 0) {
    return (
      <Box sx={{ minHeight: 'calc(100vh - 56px)', backgroundColor: 'background.default', p: { xs: 1, md: 2 } }}>
        <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, textAlign: 'center' }}>
          <Typography sx={{ color: 'text.secondary', fontSize: '1rem', fontWeight: 600 }}>
            No supply order for this date
          </Typography>
          <Button
            sx={{ mt: 2, textTransform: 'none', fontWeight: 600 }}
            startIcon={<ArrowLeft size={16} />}
            onClick={() => navigate(`/day/${targetDate}`)}
          >
            Back
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: 'calc(100vh - 56px)', backgroundColor: 'background.default', p: { xs: 1, md: 2 }, pb: { xs: 8, md: 4 } }}>
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 1.5, md: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 1 } }}>
            <Button
              size="small"
              startIcon={<ArrowLeft size={16} />}
              onClick={() => navigate(`/day/${targetDate}`)}
              sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary', minWidth: 0, px: 1 }}
            >
              Back
            </Button>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: '1rem', md: '1.25rem' }, color: 'text.primary', letterSpacing: '-0.3px' }}>
              Supply Verification
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
            <Truck size={14} />
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{targetDate}</Typography>
          </Box>
        </Box>

        <Paper
          sx={{
            borderRadius: { xs: 1, md: 1.5 },
            overflow: 'hidden',
            border: '1px solid',
            borderColor: supplyVerification.isFullyVerified
              ? (supplyVerification.conflictCount > 0 ? 'error.main' : 'success.main')
              : 'divider',
            background: isDark
              ? (supplyVerification.isFullyVerified
                ? (supplyVerification.conflictCount > 0 ? 'rgba(220,38,38,0.08)' : 'rgba(45,138,78,0.08)')
                : 'linear-gradient(135deg, #1E1E26 0%, #252530 100%)')
              : (supplyVerification.isFullyVerified
                ? (supplyVerification.conflictCount > 0 ? '#FEF2F2' : '#F0FDF4')
                : undefined),
          }}
        >
          <Box sx={{ p: { xs: 1.25, md: 1.5 }, borderBottom: 1, borderColor: 'divider' }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Verify each item
            </Typography>
            {supplyVerification.isFullyVerified && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                {supplyVerification.conflictCount > 0 ? (
                  <AlertTriangle size={14} color="#DC2626" />
                ) : (
                  <CheckCircle2 size={14} color="#16A34A" />
                )}
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: supplyVerification.conflictCount > 0 ? 'error.main' : 'success.main' }}>
                  {supplyVerification.conflictCount > 0 ? `${supplyVerification.conflictCount} conflict(s) reported` : 'All items verified'}
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ p: { xs: 1.25, md: 1.5 } }}>
            {supplyVerification.items.map((item) => {
              const current = verificationItems[item.supplyItemId] ?? item.expectedQty;
              const hasConflict = current !== item.expectedQty;
              return (
                <Box
                  key={item.supplyItemId}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    py: { xs: 1, md: 1.25 },
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:last-child': { borderBottom: 0 },
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: { xs: '0.85rem', md: '0.95rem' }, color: 'text.primary' }}>
                      {item.displayName.replace(/\s*\(\d+\s*Pcs\)/i, '')}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      Expected: {item.expectedQty} {item.category === 'momo_packet' ? 'pkt' : 'pack'}
                    </Typography>
                    {hasConflict && (
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'error.main', mt: 0.25 }}>
                        Conflict: expected {item.expectedQty}, found {current}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton
                      size="small"
                      onClick={() => updateQty(item.supplyItemId, -1)}
                      sx={{ width: 32, height: 32, border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : theme.palette.divider}`, borderRadius: 1 }}
                    >
                      <Minus size={14} />
                    </IconButton>
                    <Box
                      component="input"
                      type="number"
                      value={current}
                      onChange={(e) => setQty(item.supplyItemId, e.target.value)}
                      sx={{
                        width: 56,
                        textAlign: 'center',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        py: 0.5,
                        px: 0,
                        border: `1px solid ${hasConflict ? '#DC2626' : theme.palette.divider}`,
                        borderRadius: 1,
                        background: 'transparent',
                        color: hasConflict ? '#DC2626' : 'inherit',
                        outline: 'none',
                        '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': { WebkitAppearance: 'none' },
                        '-moz-appearance': 'textfield',
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => updateQty(item.supplyItemId, 1)}
                      sx={{ width: 32, height: 32, border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : theme.palette.divider}`, borderRadius: 1 }}
                    >
                      <Plus size={14} />
                    </IconButton>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Paper>

        <Button
          fullWidth
          variant="contained"
          size="large"
          disabled={verifyMutation.isPending}
          onClick={() => verifyMutation.mutate()}
          startIcon={<CheckCircle2 size={18} />}
          sx={{ mt: 2, textTransform: 'none', fontWeight: 700, borderRadius: 2, py: 1.5, fontSize: '0.95rem' }}
        >
          {verifyMutation.isPending ? 'Submitting...' : 'Submit Verification'}
        </Button>
      </Box>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Box>
  );
}
