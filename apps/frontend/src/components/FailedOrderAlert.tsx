import { useState } from 'react';
import { Box, Button, Paper, Typography, CircularProgress, useTheme } from '@mui/material';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { createOrder, updateOrder } from '../api/ordersApi';
import { useFailedOrders, removeFailedOrder, type FailedOrder } from '../utils/failedOrders';
import { vibrate, haptics } from '../theme/tokens';
import { trackButtonClick } from '../utils/tracking';

interface FailedOrderAlertProps {
  date: string;
  onRetried: (message: string, type: 'success' | 'error') => void;
}

/**
 * Shows orders the server rejected, so a failed order is recoverable instead
 * of silently lost. Stays on screen until the staff retry it or discard it.
 */
export default function FailedOrderAlert({ date, onRetried }: FailedOrderAlertProps) {
  const failed = useFailedOrders(date);
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [retryingId, setRetryingId] = useState<string | null>(null);

  if (failed.length === 0) return null;

  const retry = async (order: FailedOrder) => {
    if (retryingId) return;
    vibrate(haptics.light);
    trackButtonClick('day_view', 'retry_failed_order');
    setRetryingId(order.id);
    try {
      if (order.kind === 'update' && order.orderId) {
        await updateOrder(order.orderId, order.payload as any);
      } else {
        await createOrder(order.payload as any);
      }
      removeFailedOrder(order.id);
      queryClient.invalidateQueries({ queryKey: ['orders', date] });
      vibrate(haptics.success);
      onRetried('Order saved', 'success');
    } catch {
      vibrate(haptics.error);
      onRetried('Still not saving. Check with the admin.', 'error');
    } finally {
      setRetryingId(null);
    }
  };

  const discard = (order: FailedOrder) => {
    vibrate(haptics.light);
    trackButtonClick('day_view', 'discard_failed_order');
    removeFailedOrder(order.id);
    onRetried('Order discarded', 'error');
  };

  return (
    <Box sx={{ mb: { xs: 1.5, md: 2 }, display: 'flex', flexDirection: 'column', gap: { xs: 0.75, md: 1 } }}>
      {failed.map((order) => {
        const busy = retryingId === order.id;
        return (
          <Paper
            key={order.id}
            elevation={0}
            sx={{
              p: { xs: 1.25, md: 1.5 },
              borderRadius: { xs: 1, md: 1.25 },
              border: 2,
              borderColor: 'error.main',
              backgroundColor: isDark ? 'rgba(248,113,113,0.10)' : '#FEF2F2',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: { xs: 1, md: 1.25 } }}>
              <Box sx={{ color: 'error.main', mt: 0.25, flexShrink: 0 }}>
                <AlertTriangle size={18} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: { xs: '0.8rem', md: '0.9rem' }, color: 'error.main', lineHeight: 1.3 }}>
                  Not saved — ₹{order.totalAmount}
                </Typography>
                <Typography sx={{ fontSize: { xs: '0.72rem', md: '0.8rem' }, color: 'text.secondary', fontWeight: 500, mt: 0.25 }}>
                  {order.summary}
                </Typography>
                <Typography sx={{ fontSize: { xs: '0.68rem', md: '0.75rem' }, color: 'text.secondary', mt: 0.5 }}>
                  This order did not reach the server. Retry it, or discard it if you already re-entered it.
                </Typography>

                <Box sx={{ display: 'flex', gap: { xs: 0.75, md: 1 }, mt: { xs: 1, md: 1.25 }, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    size="small"
                    color="error"
                    disabled={busy}
                    onClick={() => retry(order)}
                    startIcon={busy ? <CircularProgress size={13} color="inherit" /> : <RefreshCw size={14} />}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1, fontSize: { xs: '0.75rem', md: '0.8rem' }, py: 0.5, px: 1.75, minHeight: 0 }}
                  >
                    {busy ? 'Retrying...' : 'Retry'}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={busy}
                    onClick={() => discard(order)}
                    startIcon={<Trash2 size={14} />}
                    sx={{
                      textTransform: 'none', fontWeight: 600, borderRadius: 1,
                      fontSize: { xs: '0.75rem', md: '0.8rem' }, py: 0.5, px: 1.5, minHeight: 0,
                      borderColor: 'divider', color: 'text.secondary',
                    }}
                  >
                    Discard
                  </Button>
                </Box>
              </Box>
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
}
